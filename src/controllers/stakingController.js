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

    // Staking Bonus Logic
    try {
      const stakingCommissionPercent = 5.0;
      const stakingBonus = (stakeAmount * stakingCommissionPercent) / 100;
      if (stakingBonus > 0) {
        const bonusNewBalance = newBalance + stakingBonus;
        await prisma.$transaction([
          prisma.users.update({
            where: { id: userId },
            data: { balance: bonusNewBalance },
          }),
          prisma.transactions.create({
            data: {
              user_id: userId,
              type: 'STAKING_COMMISSION',
              amount: stakingBonus,
              balance_before: newBalance,
              balance_after: bonusNewBalance,
              description: `Staking Bonus from investing $${stakeAmount} into ${plan.title}`,
            },
          }),
        ]);
      }
    } catch (err) {
      console.error('Staking bonus processing error:', err);
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

    let totalNewProfitToCredit = 0;
    const now = new Date();

    for (const s of stakes) {
      if (s.status === 'ACTIVE' && s.plan) {
        const lastClaim = s.last_claim_date || s.start_date || s.created_at;
        const elapsedHours = (now - new Date(lastClaim)) / (1000 * 60 * 60);

        if (elapsedHours >= 24) {
          const daysToCredit = Math.floor(elapsedHours / 24);
          const baseAmount = parseFloat(s.amount) + parseFloat(s.total_earned || 0);
          const dailyPercent = parseFloat(s.plan.daily_return_percent || 0);

          let profitAdded = 0;
          let currentBase = baseAmount;
          for (let d = 0; d < daysToCredit; d++) {
            const dayProfit = (currentBase * dailyPercent) / 100;
            profitAdded += dayProfit;
            currentBase += dayProfit;
          }

          totalNewProfitToCredit += profitAdded;

          const nextClaimDate = new Date(new Date(lastClaim).getTime() + daysToCredit * 24 * 60 * 60 * 1000);
          const isCompleted = s.end_date && now >= new Date(s.end_date);

          await prisma.user_stakes.update({
            where: { id: s.id },
            data: {
              total_earned: parseFloat(s.total_earned || 0) + profitAdded,
              last_claim_date: nextClaimDate,
              status: isCompleted ? 'COMPLETED' : 'ACTIVE',
            },
          }).catch(() => null);

          await prisma.transactions.create({
            data: {
              user_id: userId,
              type: 'STAKE_PROFIT',
              amount: profitAdded,
              balance_before: 0,
              balance_after: profitAdded,
              reference_id: s.id,
              description: `Auto-credited daily yield of $${profitAdded.toFixed(2)} from ${s.plan.title || 'Staking Plan'}`,
            },
          }).catch(() => null);
        }
      }
    }

    if (totalNewProfitToCredit > 0) {
      const dbUser = await prisma.users.findUnique({ where: { id: userId } });
      if (dbUser) {
        await prisma.users.update({
          where: { id: userId },
          data: {
            staked_balance: parseFloat(dbUser.staked_balance || 0) + totalNewProfitToCredit,
            total_earned: parseFloat(dbUser.total_earned || 0) + totalNewProfitToCredit,
          },
        }).catch(() => null);
      }
    }

    const updatedStakes = await prisma.user_stakes.findMany({
      where: { user_id: userId },
      include: { plan: true },
      orderBy: { created_at: 'desc' },
    });

    const formattedStakes = updatedStakes.map((s) => {
      const amount = parseFloat(s.amount || 0);
      const dailyReturnPercent = parseFloat(s.plan?.daily_return_percent || 0);
      const durationDays = s.plan?.duration_days || 30;
      const dailyProfit = (amount * dailyReturnPercent) / 100;
      const expectedTotalReturn = amount + (dailyProfit * durationDays);

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

export const claimStakeProfit = async (req, res) => {
  try {
    const { stake_id } = req.body;
    const userId = req.user.id;

    const stake = await prisma.user_stakes.findFirst({
      where: { id: stake_id, user_id: userId },
      include: { plan: true },
    });

    if (!stake || stake.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Active stake not found' });
    }

    const now = new Date();
    const lastClaim = stake.last_claim_date || stake.start_date;
    const hoursElapsed = (now - new Date(lastClaim)) / (1000 * 60 * 60);

    if (hoursElapsed < 24) {
      return res.status(400).json({
        success: false,
        message: `Daily profit compiles and pays every 24 hours. Next payout in ${Math.ceil(24 - hoursElapsed)} hours.`,
      });
    }

    // Compounding profit calculation:FV = PV * (1 + r)
    const baseAmount = parseFloat(stake.amount) + parseFloat(stake.total_earned);
    const dailyReturnPercent = parseFloat(stake.plan.daily_return_percent);
    const claimAmount = (baseAmount * dailyReturnPercent) / 100;

    const user = await prisma.users.findUnique({ where: { id: userId } });

    const newProfitBalance = parseFloat(user.staked_balance || 0) + claimAmount;
    const newTotalEarned = parseFloat(user.total_earned || 0) + claimAmount;
    const newStakeEarned = parseFloat(stake.total_earned || 0) + claimAmount;

    let isCompleted = false;
    if (now >= new Date(stake.end_date) && stake.plan.duration_days > 0) {
      isCompleted = true;
    }

    const [updatedStake, updatedUser] = await prisma.$transaction([
      prisma.user_stakes.update({
        where: { id: stake.id },
        data: {
          total_earned: newStakeEarned,
          last_claim_date: now,
          status: isCompleted ? 'COMPLETED' : 'ACTIVE',
        },
      }),
      prisma.users.update({
        where: { id: userId },
        data: {
          staked_balance: newProfitBalance,
          total_earned: newTotalEarned,
        },
      }),
      prisma.transactions.create({
        data: {
          user_id: userId,
          type: 'STAKE_PROFIT',
          amount: claimAmount,
          balance_before: user.staked_balance,
          balance_after: newProfitBalance,
          reference_id: stake.id,
          description: `Claimed compounding profit of $${claimAmount.toFixed(2)} from stake #${stake.id.substring(0, 8)}`,
        },
      }),
    ]);

    return res.json({
      success: true,
      message: `Claimed compounding profit of $${claimAmount.toFixed(2)} successfully!`,
      claimed_amount: claimAmount,
      stake: updatedStake,
      user: { balance: updatedUser.balance, total_earned: updatedUser.total_earned },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to claim profit', error: error.message });
  }
};
