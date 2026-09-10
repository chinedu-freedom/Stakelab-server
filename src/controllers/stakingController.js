import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import { sendEmail, sendAdminNotificationEmail, sendStakeActivatedEmail, sendStakeCompletedEmail } from '../services/emailService.js';
import { processReferralCommissions } from './adminController.js';

export const getStakingPlans = async (req, res) => {
  try {
    const plans = await prisma.staking_plans.findMany({
      orderBy: { sort_order: 'asc' },
    });

    let userId = req.user?.id;
    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'stakelab_jwt_secret_key_2026');
          if (decoded && decoded.userId) userId = decoded.userId;
        } catch (e) {}
      }
    }

    let userStakeCounts = {};
    if (userId) {
      const userStakes = await prisma.user_stakes.groupBy({
        by: ['plan_id'],
        where: { user_id: userId },
        _count: { id: true },
      });
      userStakes.forEach((item) => {
        userStakeCounts[item.plan_id] = item._count.id;
      });
    }

    const plansWithCounts = plans.map((p) => ({
      ...p,
      user_stake_count: userStakeCounts[p.id] || 0,
    }));

    return res.json({ success: true, plans: plansWithCounts });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch staking plans', error: error.message });
  }
};

export const createStake = async (req, res) => {
  try {
    const { plan_id, amount, wallet_type = 'main', is_compounding = true } = req.body;
    const userId = req.user.id;

    if (!req.user.email_verified) {
      return res.status(403).json({
        success: false,
        require_email_verification: true,
        message: 'Please verify your email address to perform staking.',
      });
    }

    if (!plan_id || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Plan ID and valid amount required' });
    }

    const stakeAmount = parseFloat(amount);

    const plan = await prisma.staking_plans.findUnique({ where: { id: plan_id } });
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Staking plan not found.' });
    }

    const rawSt = (plan.status || plan.badge || '').toUpperCase();
    const isComingSoon = rawSt === 'COMING_SOON' || rawSt === 'COMING SOON';
    if (isComingSoon) {
      return res.status(400).json({ success: false, message: 'This staking plan is coming soon and is not available for purchase yet.' });
    }

    const isPlanUnavailable = !plan.is_active || rawSt === 'UNAVAILABLE' || rawSt === 'INACTIVE';
    if (isPlanUnavailable) {
      return res.status(400).json({ success: false, message: 'This staking plan is currently unavailable for purchase.' });
    }

    // Check maximum investment limit per user for this plan
    if (plan.max_invest_limit && plan.max_invest_limit > 0) {
      const existingStakeCount = await prisma.user_stakes.count({
        where: { user_id: userId, plan_id: plan.id },
      });
      if (existingStakeCount >= plan.max_invest_limit) {
        return res.status(400).json({
          success: false,
          message: 'You have reached the maximum allowed investments for this plan.',
        });
      }
    }

    // Prerequisite Check: User must have an investment in Flexible Tier before investing in Dynamic Tier
    const planTierUpper = (plan.tier || '').toUpperCase();
    const planTitleUpper = (plan.title || plan.name || '').toUpperCase();
    const planBadgeUpper = (plan.badge || '').toUpperCase();
    const isDynamicTier = planTierUpper.includes('DYNAMIC') || planTitleUpper.includes('DYNAMIC') || planBadgeUpper.includes('DYNAMIC');

    if (isDynamicTier) {
      const userStakes = await prisma.user_stakes.findMany({
        where: { user_id: userId },
        include: { plan: true },
      });

      const hasFlexibleStake = userStakes.some((s) => {
        if (!s.plan) return false;
        const pTierUpper = (s.plan.tier || '').toUpperCase();
        const pTitleUpper = (s.plan.title || s.plan.name || '').toUpperCase();
        const pBadgeUpper = (s.plan.badge || '').toUpperCase();
        return (
          pTierUpper.includes('FLEXIBLE') ||
          pTitleUpper.includes('FLEXIBLE') ||
          pBadgeUpper.includes('FLEXIBLE') ||
          (pTierUpper !== '' && !pTierUpper.includes('DYNAMIC')) ||
          (!pTitleUpper.includes('DYNAMIC') && !pBadgeUpper.includes('DYNAMIC'))
        );
      });

      if (!hasFlexibleStake) {
        return res.status(400).json({
          success: false,
          message: 'You must have an investment in the Flexible Tier before investing in the Dynamic Tier.',
        });
      }
    }

    if (stakeAmount < parseFloat(plan.min_amount) || stakeAmount > parseFloat(plan.max_amount)) {
      return res.status(400).json({
        success: false,
        message: `Amount must be between $${plan.min_amount} and $${plan.max_amount}`,
      });
    }

    const user = await prisma.users.findUnique({ where: { id: userId } });

    let sourceBalance = wallet_type === 'profit' ? parseFloat(user.staked_balance || 0) : parseFloat(user.balance || 0);

    if (sourceBalance < stakeAmount) {
      const walletName = wallet_type === 'profit' ? 'Profits Wallet' : 'Staking Wallet';
      return res.status(400).json({ success: false, message: `Insufficient balance in ${walletName}` });
    }

    const dailyProfit = (stakeAmount * parseFloat(plan.daily_return_percent)) / 100;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration_days);

    const newBalance = wallet_type === 'main' ? parseFloat(user.balance || 0) - stakeAmount : parseFloat(user.balance || 0);
    const newStaked = wallet_type === 'profit' ? parseFloat(user.staked_balance || 0) - stakeAmount : parseFloat(user.staked_balance || 0);

    const [stake, updatedUser, tx] = await prisma.$transaction([
      prisma.user_stakes.create({
        data: {
          user_id: userId,
          plan_id: plan.id,
          amount: stakeAmount,
          daily_profit: dailyProfit,
          start_date: startDate,
          end_date: endDate,
          status: 'ACTIVE',
        },
      }),
      prisma.users.update({
        where: { id: userId },
        data: {
          balance: newBalance,
          staked_balance: newStaked,
        },
      }),
      prisma.transactions.create({
        data: {
          user_id: userId,
          type: 'STAKE',
          amount: stakeAmount,
          balance_before: sourceBalance,
          balance_after: sourceBalance - stakeAmount,
          description: `Staked $${stakeAmount} into ${plan.title} using ${wallet_type === 'profit' ? 'Profit Wallet' : 'Main Wallet'}`,
        },
      }),
    ]);

    // Referral Commission Logic (Dynamic Admin Configured)
    if (user.referred_by) {
      await processReferralCommissions({
        userId: user.id,
        amount: stakeAmount,
        sourceUser: user,
      });
    }



    sendStakeActivatedEmail({ user, stake, plan }).catch(() => null);

    sendAdminNotificationEmail({
      subject: `New Investment: $${stakeAmount.toFixed(2)} in ${plan.title} by @${user.username || user.full_name}`,
      title: 'New Staking Investment Created',
      details: `<p>A user invested in a staking plan:</p><ul><li><b>User:</b> @${user.username || user.full_name} (${user.email})</li><li><b>Plan:</b> ${plan.title}</li><li><b>Amount:</b> $${stakeAmount.toFixed(2)} USDT</li><li><b>Daily Return:</b> ${plan.daily_return_percent}%</li></ul>`,
    }).catch(() => null);

    return res.status(201).json({
      success: true,
      message: `Your staking plan has been successfully activated.`,
      stake: { ...stake, is_compounding: is_compounding },
      user: {
        balance: updatedUser.balance,
        staked_balance: updatedUser.staked_balance,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create stake', error: error.message });
  }
};

export async function processStakingYields(targetUserId = null) {
  try {
    const whereClause = {
      status: 'ACTIVE',
      ...(targetUserId ? { user_id: targetUserId } : {}),
    };

    const activeStakes = await prisma.user_stakes.findMany({
      where: whereClause,
      include: { plan: true, user: true },
    });

    const now = new Date();

    for (const stake of activeStakes) {
      if (!stake.plan || !stake.user) continue;

      const plan = stake.plan;
      const user = stake.user;
      const amount = parseFloat(stake.amount || 0);
      const dailyReturnPercent = parseFloat(plan.daily_return_percent || 0);
      const isFixedDeposit = plan.is_fixed_deposit !== false;
      const capitalReturn = plan.capital_return !== false;
      const isCompounding = plan.is_compounding !== false;
      const durationDays = plan.duration_days || 1;
      const startDate = new Date(stake.start_date || stake.created_at);
      const endDate = new Date(stake.end_date);
      const isCompleted = now >= endDate;

      if (!isFixedDeposit) {
        // --- NON-FIXED / FLEXIBLE DEPOSIT PLAN: 24-HOUR DAILY INCOME PAYOUT ---
        const baseDate = stake.last_claim_date ? new Date(stake.last_claim_date) : startDate;
        const effectiveNow = isCompleted ? endDate : now;
        const elapsedMs = effectiveNow.getTime() - baseDate.getTime();
        const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

        if (elapsedDays > 0) {
          const dailyProfitRate = dailyReturnPercent / 100;
          const totalYieldForPeriod = amount * dailyProfitRate * elapsedDays;

          const oldStakedBal = parseFloat(user.staked_balance || 0);
          const oldTotalEarned = parseFloat(user.total_earned || 0);
          const newStakedBal = oldStakedBal + totalYieldForPeriod;
          const newTotalEarned = oldTotalEarned + totalYieldForPeriod;

          const newLastClaimDate = new Date(baseDate.getTime() + elapsedDays * 24 * 60 * 60 * 1000);

          await prisma.$transaction([
            prisma.users.update({
              where: { id: user.id },
              data: {
                staked_balance: newStakedBal,
                total_earned: newTotalEarned,
              },
            }),
            prisma.user_stakes.update({
              where: { id: stake.id },
              data: {
                total_earned: { increment: totalYieldForPeriod },
                last_claim_date: newLastClaimDate,
              },
            }),
            prisma.transactions.create({
              data: {
                user_id: user.id,
                type: 'STAKE_PROFIT',
                amount: totalYieldForPeriod,
                balance_before: oldStakedBal,
                balance_after: newStakedBal,
                reference_id: stake.id,
                description: `Daily Yield Payout: $${totalYieldForPeriod.toFixed(2)} (${elapsedDays} day${elapsedDays > 1 ? 's' : ''}) from ${plan.title}`,
              },
            }),
          ]).catch((err) => console.error('Daily yield payout error:', err));
        }

        // If Non-Fixed plan has reached end_date, mark COMPLETED & return principal capital if enabled
        if (isCompleted) {
          const freshUser = await prisma.users.findUnique({ where: { id: user.id } });
          const oldMainBal = parseFloat(freshUser?.balance || 0);
          const newMainBal = capitalReturn ? oldMainBal + amount : oldMainBal;

          const updateOps = [
            prisma.user_stakes.update({
              where: { id: stake.id },
              data: { status: 'COMPLETED' },
            }),
          ];

          if (capitalReturn) {
            updateOps.push(
              prisma.users.update({
                where: { id: user.id },
                data: { balance: newMainBal },
              }),
              prisma.transactions.create({
                data: {
                  user_id: user.id,
                  type: 'CAPITAL_RETURN',
                  amount: amount,
                  balance_before: oldMainBal,
                  balance_after: newMainBal,
                  reference_id: stake.id,
                  description: `Capital Return: $${amount.toFixed(2)} principal returned from completed ${plan.title}`,
                },
              })
            );
          }

          await prisma.$transaction(updateOps).catch((err) => console.error('Non-fixed completion error:', err));

          sendStakeCompletedEmail({
            user,
            stake,
            plan,
            totalProfit: parseFloat(stake.total_earned || 0),
            capitalReturned: capitalReturn ? amount : 0,
          }).catch(() => null);
        }
      } else {
        // --- FIXED DEPOSIT PLAN: MATURITY PAYOUT ---
        if (isCompleted) {
          let expectedTotalReturn = amount;
          if (isCompounding) {
            expectedTotalReturn = amount * Math.pow(1 + dailyReturnPercent / 100, durationDays);
          } else {
            expectedTotalReturn = amount + amount * (dailyReturnPercent / 100) * durationDays;
          }

          const totalProfitEarned = Math.max(0, expectedTotalReturn - amount);

          const dbUser = await prisma.users.findUnique({ where: { id: user.id } });
          if (dbUser) {
            const currentStaked = parseFloat(dbUser.staked_balance || 0);
            const currentBalance = parseFloat(dbUser.balance || 0);
            const currentTotalEarned = parseFloat(dbUser.total_earned || 0);

            const newStakedBalance = currentStaked + totalProfitEarned;
            const newTotalEarned = currentTotalEarned + totalProfitEarned;
            const newMainBalance = capitalReturn ? currentBalance + amount : currentBalance;

            const ops = [
              prisma.user_stakes.update({
                where: { id: stake.id },
                data: {
                  total_earned: totalProfitEarned,
                  status: 'COMPLETED',
                },
              }),
              prisma.users.update({
                where: { id: user.id },
                data: {
                  balance: newMainBalance,
                  staked_balance: newStakedBalance,
                  total_earned: newTotalEarned,
                },
              }),
            ];

            if (totalProfitEarned > 0) {
              ops.push(
                prisma.transactions.create({
                  data: {
                    user_id: user.id,
                    type: 'STAKE_PROFIT',
                    amount: totalProfitEarned,
                    balance_before: currentStaked,
                    balance_after: newStakedBalance,
                    reference_id: stake.id,
                    description: `Maturity Payout: $${totalProfitEarned.toFixed(2)} total profit earned from completed ${plan.title}`,
                  },
                })
              );
            }

            if (capitalReturn) {
              ops.push(
                prisma.transactions.create({
                  data: {
                    user_id: user.id,
                    type: 'CAPITAL_RETURN',
                    amount: amount,
                    balance_before: currentBalance,
                    balance_after: newMainBalance,
                    reference_id: stake.id,
                    description: `Capital Return: $${amount.toFixed(2)} principal returned from completed ${plan.title}`,
                  },
                })
              );
            }

            await prisma.$transaction(ops).catch((err) => console.error('Fixed maturity payout error:', err));

            sendStakeCompletedEmail({
              user,
              stake,
              plan,
              totalProfit: totalProfitEarned,
              capitalReturned: capitalReturn ? amount : 0,
            }).catch(() => null);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error processing staking yields:', err);
  }
}

export const getUserStakes = async (req, res) => {
  try {
    const userId = req.user.id;

    // Process daily 24h yields and maturity payouts for user
    await processStakingYields(userId);

    const stakes = await prisma.user_stakes.findMany({
      where: { user_id: userId },
      include: { plan: true },
      orderBy: { created_at: 'desc' },
    });

    const formattedStakes = stakes.map((s) => {
      const amount = parseFloat(s.amount || 0);
      const dailyReturnPercent = parseFloat(s.plan?.daily_return_percent || 0);
      const durationDays = s.plan?.duration_days || 30;
      const isCompounding = s.plan?.is_compounding !== false;
      const capitalReturn = s.plan?.capital_return !== false;

      const dailyProfit = (amount * dailyReturnPercent) / 100;

      let expectedTotalReturn = amount;
      if (isCompounding) {
        expectedTotalReturn = amount * Math.pow(1 + dailyReturnPercent / 100, durationDays);
      } else {
        expectedTotalReturn = amount + (dailyProfit * durationDays);
      }

      if (!capitalReturn) {
        expectedTotalReturn = Math.max(0, expectedTotalReturn - amount);
      }

      return {
        ...s,
        daily_profit: dailyProfit,
        expected_total_return: expectedTotalReturn,
      };
    });

    return res.json({ success: true, stakes: formattedStakes });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch user stakes', error: error.message });
  }
};
