import { prisma } from '../config/db.js';
import { sendEmail } from '../services/emailService.js';

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
    if (!plan || !plan.is_active) {
      return res.status(404).json({ success: false, message: 'Staking plan not found or inactive' });
    }

    if (stakeAmount < parseFloat(plan.min_amount) || stakeAmount > parseFloat(plan.max_amount)) {
      return res.status(400).json({
        success: false,
        message: `Amount must be between $${plan.min_amount} and $${plan.max_amount}`,
      });
    }

    const user = await prisma.users.findUnique({ where: { id: userId } });

    let sourceBalance = parseFloat(user.balance);
    if (wallet_type === 'profit') {
      sourceBalance = parseFloat(user.total_earned || 0);
    }

    if (sourceBalance < stakeAmount) {
      const walletName = wallet_type === 'profit' ? 'Profit Wallet' : 'Main Wallet';
      return res.status(400).json({ success: false, message: `Insufficient balance in ${walletName}` });
    }

    const dailyProfit = (stakeAmount * parseFloat(plan.daily_return_percent)) / 100;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration_days);

    const newBalance = wallet_type === 'profit' ? parseFloat(user.balance) : parseFloat(user.balance) - stakeAmount;
    const newTotalEarned = wallet_type === 'profit' ? parseFloat(user.total_earned || 0) - stakeAmount : parseFloat(user.total_earned || 0);
    const newStaked = parseFloat(user.staked_balance) + stakeAmount;

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
          total_earned: newTotalEarned,
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

    // Referral Commission & Free Spin Reward Logic
    if (user.referred_by) {
      try {
        const commissionPercents = [10.0, 5.0, 3.0, 2.0, 1.0];
        let currentInviterId = user.referred_by;

        for (let level = 0; level < commissionPercents.length && currentInviterId; level++) {
          const inviter = await prisma.users.findUnique({ where: { id: currentInviterId } });
          if (!inviter) break;

          const commissionAmount = (stakeAmount * commissionPercents[level]) / 100;
          if (commissionAmount > 0) {
            const inviterNewBalance = parseFloat(inviter.balance) + commissionAmount;
            const inviterNewEarned = parseFloat(inviter.total_earned) + commissionAmount;

            await prisma.$transaction([
              prisma.users.update({
                where: { id: inviter.id },
                data: {
                  balance: inviterNewBalance,
                  total_earned: inviterNewEarned,
                },
              }),
              prisma.transactions.create({
                data: {
                  user_id: inviter.id,
                  type: 'REFERRAL_COMMISSION',
                  amount: commissionAmount,
                  balance_before: inviter.balance,
                  balance_after: inviterNewBalance,
                  description: `Level ${level + 1} Referral Commission from @${user.username || user.full_name}'s $${stakeAmount} investment`,
                },
              }),
            ]);
          }

          // Level 1 Direct Inviter receives +1 Free Spin reward when referred user deposits and invests
          if (level === 0) {
            try {
              await prisma.transactions.create({
                data: {
                  user_id: inviter.id,
                  type: 'FREE_SPIN_REWARD',
                  amount: 1,
                  balance_before: inviter.balance,
                  balance_after: inviter.balance,
                  description: `Earned +1 Lucky Free Spin because @${user.username || user.full_name} deposited & invested $${stakeAmount}`,
                },
              });

              sendEmail({
                to: inviter.email,
                subject: '🎁 You Earned 1 Lucky Free Spin! - StakeLab',
                html: `<h2>Congratulations ${inviter.full_name}!</h2><p>Your invited referral <b>@${user.username || user.full_name}</b> has completed a deposit and invested $${stakeAmount}.</p><p>You have earned <b>+1 Lucky Free Spin</b> to win crypto prizes on StakeLab!</p>`,
                emailType: 'FREE_SPIN_REWARD',
                userId: inviter.id,
              });
            } catch (spinErr) {
              console.error('Free spin reward logging error:', spinErr);
            }
          }

          currentInviterId = inviter.referred_by;
        }
      } catch (err) {
        console.error('Referral commission processing error:', err);
      }
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
    const stakes = await prisma.user_stakes.findMany({
      where: { user_id: req.user.id },
      include: { plan: true },
      orderBy: { created_at: 'desc' },
    });

    const stakesWithCompounding = stakes.map((s) => {
      const amount = parseFloat(s.amount);
      const dailyReturnPercent = parseFloat(s.plan.daily_return_percent);
      const daysElapsed = Math.min(
        s.plan.duration_days || 30,
        Math.max(1, Math.floor((new Date() - new Date(s.start_date)) / (1000 * 60 * 60 * 24)))
      );

      // FV = PV * (1 + r)^n (Compounding mathematical calculation)
      const compoundedValue = amount * Math.pow(1 + dailyReturnPercent / 100, daysElapsed);
      const compoundedProfit = compoundedValue - amount;

      return {
        ...s,
        is_compounding: true,
        current_compounded_value: compoundedValue.toFixed(2),
        compounded_profit_earned: compoundedProfit.toFixed(2),
      };
    });

    return res.json({ success: true, stakes: stakesWithCompounding });
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

    const newBalance = parseFloat(user.balance) + claimAmount;
    const newTotalEarned = parseFloat(user.total_earned) + claimAmount;
    const newStakeEarned = parseFloat(stake.total_earned) + claimAmount;

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
          balance: newBalance,
          total_earned: newTotalEarned,
          ...(isCompleted ? { staked_balance: parseFloat(user.staked_balance) - parseFloat(stake.amount) } : {}),
        },
      }),
      prisma.transactions.create({
        data: {
          user_id: userId,
          type: 'STAKE_PROFIT',
          amount: claimAmount,
          balance_before: user.balance,
          balance_after: newBalance,
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
