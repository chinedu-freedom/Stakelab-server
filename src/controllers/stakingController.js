import { prisma } from '../config/db.js';
import { sendEmail, sendAdminNotificationEmail } from '../services/emailService.js';
import { processReferralCommissions } from './adminController.js';

export const getStakingPlans = async (req, res) => {
  try {
    const plans = await prisma.staking_plans.findMany({
      orderBy: { sort_order: 'asc' },
    });
    return res.json({ success: true, plans });
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

    // Prerequisite Check: User must have an investment in Flexible Tier before investing in Dynamic Tier
    const planTitleUpper = (plan.title || plan.name || '').toUpperCase();
    const planBadgeUpper = (plan.badge || '').toUpperCase();
    const isDynamicTier = planTitleUpper.includes('DYNAMIC') || planBadgeUpper.includes('DYNAMIC');

    if (isDynamicTier) {
      const userStakes = await prisma.user_stakes.findMany({
        where: { user_id: userId },
        include: { plan: true },
      });

      const hasFlexibleStake = userStakes.some((s) => {
        const pTitle = (s.plan?.title || s.plan?.name || '').toUpperCase();
        const pBadge = (s.plan?.badge || '').toUpperCase();
        return (
          pTitle.includes('FLEXIBLE') ||
          pBadge.includes('FLEXIBLE') ||
          pTitle.includes('STANDARD') ||
          pBadge.includes('STANDARD') ||
          (!pTitle.includes('DYNAMIC') && !pBadge.includes('DYNAMIC'))
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

    // Referral Commission & Free Spin Reward Logic (Dynamic Admin Configured)
    if (user.referred_by) {
      await processReferralCommissions({
        userId: user.id,
        amount: stakeAmount,
        sourceUser: user,
        eventType: 'STAKING',
      });
    }



    sendAdminNotificationEmail({
      subject: `New Investment: $${stakeAmount.toFixed(2)} in ${plan.title} by @${user.username || user.full_name}`,
      title: 'New Staking Investment Created',
      details: `<p>A user invested in a staking plan:</p><ul><li><b>User:</b> @${user.username || user.full_name} (${user.email})</li><li><b>Plan:</b> ${plan.title}</li><li><b>Amount:</b> $${stakeAmount.toFixed(2)} USDT</li><li><b>Daily Return:</b> ${plan.daily_return_percent}%</li></ul>`,
    }).catch(() => null);

    return res.status(201).json({
      success: true,
      message: `Successfully staked $${stakeAmount} with compounding daily yield!`,
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

export const getUserStakes = async (req, res) => {
  try {
    const userId = req.user.id;
    const stakes = await prisma.user_stakes.findMany({
      where: { user_id: userId },
      include: { plan: true },
      orderBy: { created_at: 'desc' },
    });

    const now = new Date();

    for (const s of stakes) {
      if (s.status === 'ACTIVE' && s.plan) {
        const isCompleted = s.end_date && now >= new Date(s.end_date);

        if (isCompleted) {
          const amount = parseFloat(s.amount || 0);
          const dailyReturnPercent = parseFloat(s.plan.daily_return_percent || 0);
          const durationDays = s.plan.duration_days || 1;
          const isCompounding = s.plan.is_compounding !== false;
          const capitalReturn = s.plan.capital_return !== false;

          let expectedTotalReturn = amount;
          if (isCompounding) {
            expectedTotalReturn = amount * Math.pow(1 + dailyReturnPercent / 100, durationDays);
          } else {
            expectedTotalReturn = amount + (amount * (dailyReturnPercent / 100) * durationDays);
          }

          const totalProfitEarned = Math.max(0, expectedTotalReturn - amount);

          // Update stake status to COMPLETED and set total_earned
          await prisma.user_stakes.update({
            where: { id: s.id },
            data: {
              total_earned: totalProfitEarned,
              status: 'COMPLETED',
            },
          }).catch(() => null);

          // Credit profit to Profits Wallet and return capital to Staking Wallet upon maturity
          const dbUser = await prisma.users.findUnique({ where: { id: userId } });
          if (dbUser) {
            const currentStaked = parseFloat(dbUser.staked_balance || 0);
            const currentBalance = parseFloat(dbUser.balance || 0);
            const currentTotalEarned = parseFloat(dbUser.total_earned || 0);

            const newStakedBalance = currentStaked + totalProfitEarned;
            const newTotalEarned = currentTotalEarned + totalProfitEarned;
            const newMainBalance = capitalReturn ? currentBalance + amount : currentBalance;

            await prisma.users.update({
              where: { id: userId },
              data: {
                balance: newMainBalance,
                staked_balance: newStakedBalance,
                total_earned: newTotalEarned,
              },
            }).catch(() => null);

            // Transaction log for Profit Maturity Payout
            if (totalProfitEarned > 0) {
              await prisma.transactions.create({
                data: {
                  user_id: userId,
                  type: 'STAKE_PROFIT',
                  amount: totalProfitEarned,
                  balance_before: currentStaked,
                  balance_after: newStakedBalance,
                  reference_id: s.id,
                  description: `Maturity Payout: $${totalProfitEarned.toFixed(2)} total profit earned from completed ${s.plan.title || 'Staking Plan'}`,
                },
              }).catch(() => null);
            }

            // Transaction log for Capital Return (if enabled)
            if (capitalReturn) {
              await prisma.transactions.create({
                data: {
                  user_id: userId,
                  type: 'CAPITAL_RETURN',
                  amount: amount,
                  balance_before: currentBalance,
                  balance_after: newMainBalance,
                  reference_id: s.id,
                  description: `Capital Return: $${amount.toFixed(2)} principal returned from completed ${s.plan.title || 'Staking Plan'}`,
                },
              }).catch(() => null);
            }
          }
        }
      }
    }

    // Re-fetch updated stakes after maturity payouts
    const updatedStakes = await prisma.user_stakes.findMany({
      where: { user_id: userId },
      include: { plan: true },
      orderBy: { created_at: 'desc' },
    });

    const formattedStakes = updatedStakes.map((s) => {
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
