import { prisma } from '../config/db.js';
import { sendEmail } from '../services/emailService.js';

export const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await prisma.users.count();
    const totalDeposits = await prisma.deposits.aggregate({
      where: { status: 'APPROVED' },
      _sum: { amount: true },
    });
    const totalWithdrawals = await prisma.withdrawals.aggregate({
      where: { status: 'APPROVED' },
      _sum: { amount: true },
    });
    const totalStaked = await prisma.user_stakes.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { amount: true },
    });
    const pendingDepositsCount = await prisma.deposits.count({ where: { status: 'PENDING' } });
    const pendingWithdrawalsCount = await prisma.withdrawals.count({ where: { status: 'PENDING' } });

    return res.json({
      success: true,
      stats: {
        totalUsers,
        totalDeposits: totalDeposits._sum.amount || 0,
        totalWithdrawals: totalWithdrawals._sum.amount || 0,
        totalStaked: totalStaked._sum.amount || 0,
        pendingDepositsCount,
        pendingWithdrawalsCount,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch admin stats', error: error.message });
  }
};

export const getAdminDeposits = async (req, res) => {
  try {
    const deposits = await prisma.deposits.findMany({
      include: { user: { select: { id: true, full_name: true, email: true } } },
      orderBy: { created_at: 'desc' },
    });
    return res.json({ success: true, deposits });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch deposits', error: error.message });
  }
};

export const approveDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.admin.id;

    const deposit = await prisma.deposits.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!deposit || deposit.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Deposit not found or already processed' });
    }

    const newBalance = parseFloat(deposit.user.balance) + parseFloat(deposit.amount);

    const [updatedDeposit] = await prisma.$transaction([
      prisma.deposits.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approved_by: adminId,
          approved_at: new Date(),
        },
      }),
      prisma.users.update({
        where: { id: deposit.user_id },
        data: { balance: newBalance },
      }),
      prisma.transactions.create({
        data: {
          user_id: deposit.user_id,
          type: 'DEPOSIT',
          amount: deposit.amount,
          balance_before: deposit.user.balance,
          balance_after: newBalance,
          reference_id: deposit.id,
          description: `Deposit approved: $${deposit.amount} via ${deposit.payment_method}`,
        },
      }),
    ]);

    sendEmail({
      to: deposit.user.email,
      subject: 'Deposit Approved - Stakelab',
      html: `<h2>Deposit Approved!</h2><p>Your deposit of $${deposit.amount} has been approved and credited to your account balance.</p>`,
      emailType: 'DEPOSIT_APPROVED',
      userId: deposit.user_id,
    });

    return res.json({ success: true, message: 'Deposit approved successfully', deposit: updatedDeposit });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to approve deposit', error: error.message });
  }
};

export const rejectDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const deposit = await prisma.deposits.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!deposit || deposit.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Deposit not found or already processed' });
    }

    const updatedDeposit = await prisma.deposits.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejection_reason: reason || 'Deposit proof verification failed',
      },
    });

    sendEmail({
      to: deposit.user.email,
      subject: 'Deposit Rejected - Stakelab',
      html: `<h2>Deposit Rejected</h2><p>Your deposit of $${deposit.amount} was rejected. Reason: ${reason || 'Proof verification failed'}</p>`,
      emailType: 'DEPOSIT_REJECTED',
      userId: deposit.user_id,
    });

    return res.json({ success: true, message: 'Deposit rejected', deposit: updatedDeposit });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to reject deposit', error: error.message });
  }
};

export const getAdminWithdrawals = async (req, res) => {
  try {
    const withdrawals = await prisma.withdrawals.findMany({
      include: { user: { select: { id: true, full_name: true, email: true } } },
      orderBy: { created_at: 'desc' },
    });
    return res.json({ success: true, withdrawals });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch withdrawals', error: error.message });
  }
};

export const approveWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.admin.id;

    const withdrawal = await prisma.withdrawals.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!withdrawal || withdrawal.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Withdrawal not found or already processed' });
    }

    const updatedWithdrawal = await prisma.withdrawals.update({
      where: { id },
      data: {
        status: 'APPROVED',
        processed_by: adminId,
        processed_at: new Date(),
      },
    });

    sendEmail({
      to: withdrawal.user.email,
      subject: 'Withdrawal Approved - Stakelab',
      html: `<h2>Withdrawal Sent!</h2><p>Your withdrawal request for $${withdrawal.net_amount} has been processed to your address: ${withdrawal.wallet_address}</p>`,
      emailType: 'WITHDRAWAL_APPROVED',
      userId: withdrawal.user_id,
    });

    return res.json({ success: true, message: 'Withdrawal approved', withdrawal: updatedWithdrawal });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to approve withdrawal', error: error.message });
  }
};

export const rejectWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const withdrawal = await prisma.withdrawals.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!withdrawal || withdrawal.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Withdrawal not found or already processed' });
    }

    const newBalance = parseFloat(withdrawal.user.balance) + parseFloat(withdrawal.amount);

    const [updatedWithdrawal] = await prisma.$transaction([
      prisma.withdrawals.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejection_reason: reason || 'Invalid wallet address or security check',
        },
      }),
      prisma.users.update({
        where: { id: withdrawal.user_id },
        data: { balance: newBalance },
      }),
      prisma.transactions.create({
        data: {
          user_id: withdrawal.user_id,
          type: 'WITHDRAWAL_REFUND',
          amount: withdrawal.amount,
          balance_before: withdrawal.user.balance,
          balance_after: newBalance,
          description: `Withdrawal refunded due to rejection: $${withdrawal.amount}`,
        },
      }),
    ]);

    sendEmail({
      to: withdrawal.user.email,
      subject: 'Withdrawal Rejected & Refunded - Stakelab',
      html: `<h2>Withdrawal Rejected</h2><p>Your withdrawal of $${withdrawal.amount} was rejected and refunded to your balance. Reason: ${reason || 'Security check'}</p>`,
      emailType: 'WITHDRAWAL_REJECTED',
      userId: withdrawal.user_id,
    });

    return res.json({ success: true, message: 'Withdrawal rejected and refunded', withdrawal: updatedWithdrawal });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to reject withdrawal', error: error.message });
  }
};

export const createStakingPlan = async (req, res) => {
  try {
    const { title, badge, min_amount, max_amount, apy_percent, daily_return_percent, duration_days, capital_return } = req.body;

    const plan = await prisma.staking_plans.create({
      data: {
        title,
        badge,
        min_amount: parseFloat(min_amount),
        max_amount: parseFloat(max_amount),
        apy_percent: parseFloat(apy_percent),
        daily_return_percent: parseFloat(daily_return_percent),
        duration_days: parseInt(duration_days),
        capital_return: capital_return !== undefined ? capital_return : true,
      },
    });

    return res.status(201).json({ success: true, plan });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create plan', error: error.message });
  }
};

export const updateEmailSettings = async (req, res) => {
  try {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, from_email, from_name } = req.body;

    const existing = await prisma.email_settings.findFirst();

    let settings;
    if (existing) {
      settings = await prisma.email_settings.update({
        where: { id: existing.id },
        data: {
          smtp_host,
          smtp_port: parseInt(smtp_port),
          smtp_user,
          smtp_pass,
          from_email,
          from_name,
        },
      });
    } else {
      settings = await prisma.email_settings.create({
        data: {
          smtp_host,
          smtp_port: parseInt(smtp_port),
          smtp_user,
          smtp_pass,
          from_email,
          from_name,
        },
      });
    }

    return res.json({ success: true, message: 'Email settings saved successfully', settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to save email settings', error: error.message });
  }
};

export const updateUserBalance = async (req, res) => {
  try {
    const { user_id, action, wallet_type, amount, remark } = req.body;

    if (!user_id || !action || !amount || parseFloat(amount) <= 0 || !remark) {
      return res.status(400).json({ success: false, message: 'User ID, action (add/subtract), amount, and remark are required' });
    }

    const user = await prisma.users.findUnique({ where: { id: user_id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const numAmount = parseFloat(amount);
    const targetWallet = wallet_type || 'Main Balance';
    let balanceField = 'balance';

    if (targetWallet === 'Staked Balance') {
      balanceField = 'staked_balance';
    } else if (targetWallet === 'Referral Earnings Balance' || targetWallet === 'Total Earned Profit Balance') {
      balanceField = 'total_earned';
    }

    const currentVal = parseFloat(user[balanceField] || 0);
    const newVal = action === 'add' ? currentVal + numAmount : Math.max(0, currentVal - numAmount);

    const [updatedUser, tx] = await prisma.$transaction([
      prisma.users.update({
        where: { id: user_id },
        data: { [balanceField]: newVal },
      }),
      prisma.transactions.create({
        data: {
          user_id: user_id,
          type: action === 'add' ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
          amount: numAmount,
          balance_before: currentVal,
          balance_after: newVal,
          description: `Admin ${action === 'add' ? 'added' : 'subtracted'} $${numAmount.toFixed(2)} ${action === 'add' ? 'to' : 'from'} ${targetWallet}. Remark: ${remark}`,
        },
      }),
    ]);

    return res.json({
      success: true,
      message: `Successfully ${action === 'add' ? 'added' : 'subtracted'} $${numAmount.toFixed(2)} ${action === 'add' ? 'to' : 'from'} ${targetWallet}!`,
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update user balance', error: error.message });
  }
};
