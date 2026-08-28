import { prisma } from '../config/db.js';
import { sendEmail } from '../services/emailService.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export const getAdminStats = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const totalUsers = await prisma.users.count();
    const activeUsers = await prisma.users.count({ where: { is_active: true } });
    const todayUsers = await prisma.users.count({ where: { created_at: { gte: todayStart } } });
    const emailUnverified = await prisma.users.count({ where: { email_verified: false } });
    const mobileUnverified = await prisma.users.count({
      where: {
        OR: [{ mobile: null }, { mobile: '' }],
      },
    });
    const kycUnverified = await prisma.users.count({ where: { profile_complete: false } });
    const kycPending = await prisma.users.count({ where: { profile_complete: false } });

    const totalDepositsAgg = await prisma.deposits.aggregate({
      where: { status: 'APPROVED' },
      _sum: { amount: true },
      _count: { id: true },
    });
    const todaysDepositAgg = await prisma.deposits.aggregate({
      where: { status: 'APPROVED', created_at: { gte: todayStart } },
      _sum: { amount: true },
    });
    const pendingDepositsAgg = await prisma.deposits.aggregate({
      where: { status: 'PENDING' },
      _sum: { amount: true },
      _count: { id: true },
    });
    const approvedDepositsCount = await prisma.deposits.count({ where: { status: 'APPROVED' } });
    const pendingDepositsCount = pendingDepositsAgg._count.id || 0;
    const pendingDepositsSum = pendingDepositsAgg._sum.amount || 0;
    const rejectedDepositsCount = await prisma.deposits.count({ where: { status: 'REJECTED' } });

    const totalWithdrawalsAgg = await prisma.withdrawals.aggregate({
      where: { status: 'APPROVED' },
      _sum: { amount: true },
    });
    const todaysWithdrawalAgg = await prisma.withdrawals.aggregate({
      where: { status: 'APPROVED', created_at: { gte: todayStart } },
      _sum: { amount: true },
    });
    const pendingWithdrawalsAgg = await prisma.withdrawals.aggregate({
      where: { status: 'PENDING' },
      _sum: { amount: true },
      _count: { id: true },
    });
    const approvedWithdrawalsCount = await prisma.withdrawals.count({ where: { status: 'APPROVED' } });
    const pendingWithdrawalsCount = pendingWithdrawalsAgg._count.id || 0;
    const pendingWithdrawalsSum = pendingWithdrawalsAgg._sum.amount || 0;
    const rejectedWithdrawalsCount = await prisma.withdrawals.count({ where: { status: 'REJECTED' } });
    const pendingTicketsCount = await prisma.support_tickets.count({ where: { status: 'OPEN' } });

    const totalStakedAgg = await prisma.user_stakes.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { amount: true },
    });
    const todaysStakingAgg = await prisma.user_stakes.aggregate({
      where: { created_at: { gte: todayStart } },
      _sum: { amount: true },
    });
    const activeStakingCount = await prisma.user_stakes.count({ where: { status: 'ACTIVE' } });

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const recentDeposits = await prisma.deposits.findMany({
      where: { status: 'APPROVED', created_at: { gte: fourteenDaysAgo } },
      select: { amount: true, created_at: true },
    });

    const recentWithdrawals = await prisma.withdrawals.findMany({
      where: { status: 'APPROVED', created_at: { gte: fourteenDaysAgo } },
      select: { amount: true, created_at: true },
    });

    const recentUsers = await prisma.users.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        full_name: true,
        username: true,
        email: true,
        created_at: true,
        balance: true,
      },
    });

    const [recentTx, recentUserLogs, recentAdminLogs] = await Promise.all([
      prisma.transactions.findMany({
        take: 10,
        orderBy: { created_at: 'desc' },
        include: {
          user: { select: { username: true, full_name: true } },
        },
      }),
      prisma.activity_logs.findMany({
        take: 10,
        orderBy: { created_at: 'desc' },
        include: {
          user: { select: { username: true, full_name: true } },
        },
      }),
      prisma.admin_logs.findMany({
        take: 10,
        orderBy: { created_at: 'desc' },
        include: {
          admin: { select: { username: true } },
        },
      }),
    ]);

    const combinedActivities = [
      ...recentTx.map((t) => ({
        id: `tx-${t.id}`,
        userName: t.user?.full_name || t.user?.username || 'User',
        action: t.type || 'TRANSACTION',
        details: t.description || `${t.type}: $${parseFloat(t.amount || 0).toFixed(2)}`,
        createdAt: t.created_at,
      })),
      ...recentUserLogs.map((a) => ({
        id: `act-${a.id}`,
        userName: a.user?.full_name || a.user?.username || 'User',
        action: a.action || 'ACTIVITY',
        details: `User performed ${a.action} action (IP: ${a.ip_address || 'N/A'})`,
        createdAt: a.created_at,
      })),
      ...recentAdminLogs.map((ad) => ({
        id: `adm-${ad.id}`,
        userName: ad.admin?.username || 'Admin',
        action: ad.action || 'ADMIN ACTION',
        details: `Admin performed ${ad.action}`,
        createdAt: ad.created_at,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const revenueTrendData = [6, 5, 4, 3, 2, 1, 0].map((d) => {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const dayName = daysOfWeek[date.getDay()];
      return {
        name: dayName,
        Deposits: 0,
        Staking: 0,
      };
    });

    return res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        todayUsers,
        emailUnverified,
        mobileUnverified,
        kycUnverified,
        kycPending,
        totalDeposited: totalDepositsAgg._sum.amount || 0,
        todaysDeposit: todaysDepositAgg._sum.amount || 0,
        pendingDeposits: pendingDepositsCount,
        pendingDepositsSum,
        approvedDepositsCount,
        rejectedDeposits: rejectedDepositsCount,
        depositCharge: 0,
        depositChargeCount: totalDepositsAgg._count.id || 0,
        totalWithdrawn: totalWithdrawalsAgg._sum.amount || 0,
        todaysWithdrawal: todaysWithdrawalAgg._sum.amount || 0,
        pendingWithdrawals: pendingWithdrawalsCount,
        pendingWithdrawalsSum,
        approvedWithdrawalsCount,
        rejectedWithdrawals: rejectedWithdrawalsCount,
        pendingTickets: pendingTicketsCount,
        withdrawalCharge: 0,
        totalStaked: totalStakedAgg._sum.amount || 0,
        todaysStaking: todaysStakingAgg._sum.amount || 0,
        activeStakingCount,
        recentDeposits,
        recentWithdrawals,
        userCountries: [],
        recentUsers: recentUsers.map((u) => ({
          id: u.id,
          name: u.full_name || u.username || 'New User',
          email: u.email,
          createdAt: u.created_at,
          usdBalance: parseFloat(u.balance || 0),
        })),
        recentActivities: combinedActivities,
        revenueTrendData,
        browserStats: [],
        osStats: [],
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
    const { title, badge, min_amount, max_amount, apy_percent, daily_return_percent, duration_days, capital_return, tier } = req.body;

    const plan = await prisma.staking_plans.create({
      data: {
        title,
        badge,
        min_amount: parseFloat(min_amount),
        max_amount: parseFloat(max_amount),
        apy_percent: parseFloat(apy_percent || 0),
        daily_return_percent: parseFloat(daily_return_percent),
        duration_days: parseInt(duration_days),
        tier: tier || 'Flexible Tier',
        capital_return: capital_return !== undefined ? capital_return : true,
      },
    });

    return res.status(201).json({ success: true, plan });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create plan', error: error.message });
  }
};

export const updateStakingPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, badge, min_amount, max_amount, apy_percent, daily_return_percent, duration_days, capital_return, tier, is_active } = req.body;

    const updated = await prisma.staking_plans.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(badge !== undefined && { badge }),
        ...(min_amount !== undefined && { min_amount: parseFloat(min_amount) }),
        ...(max_amount !== undefined && { max_amount: parseFloat(max_amount) }),
        ...(apy_percent !== undefined && { apy_percent: parseFloat(apy_percent) }),
        ...(daily_return_percent !== undefined && { daily_return_percent: parseFloat(daily_return_percent) }),
        ...(duration_days !== undefined && { duration_days: parseInt(duration_days) }),
        ...(tier !== undefined && { tier }),
        ...(capital_return !== undefined && { capital_return: Boolean(capital_return) }),
        ...(is_active !== undefined && { is_active: Boolean(is_active) }),
      },
    });

    return res.json({ success: true, plan: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update plan', error: error.message });
  }
};

export const deleteStakingPlan = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.staking_plans.delete({ where: { id } });
    return res.json({ success: true, message: 'Staking plan deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete plan', error: error.message });
  }
};

export const deleteAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.users.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await prisma.users.updateMany({
      where: { referred_by: id },
      data: { referred_by: null },
    });

    await prisma.users.delete({
      where: { id },
    });

    return res.json({
      success: true,
      message: `User ${user.full_name || user.email} deleted successfully!`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete user', error: error.message });
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
    const isStaked = targetWallet === 'Staked Balance';
    const currentVal = parseFloat(isStaked ? (user.staked_balance || 0) : (user.balance || 0));
    const newVal = action === 'add' ? currentVal + numAmount : Math.max(0, currentVal - numAmount);

    const userUpdateData = isStaked
      ? { staked_balance: newVal }
      : { balance: newVal };

    const [updatedUser] = await prisma.$transaction([
      prisma.users.update({
        where: { id: user_id },
        data: userUpdateData,
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

export const sendBatchNotification = async (req, res) => {
  try {
    const { subject, message, channel, target_users } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Subject and message are required' });
    }

    const where = {};
    if (target_users === 'Active Users') where.is_active = true;
    if (target_users === 'Banned Users') where.is_active = false;
    if (target_users === 'Email Unverified') where.email_verified = false;
    if (target_users === 'KYC Unverified') where.profile_complete = false;

    const targetList = await prisma.users.findMany({ where, select: { email: true, full_name: true } });

    targetList.forEach((u) => {
      sendEmail({
        to: u.email,
        subject: subject,
        html: `<h2>${subject}</h2><p>Dear ${u.full_name},</p><p>${message}</p>`,
      }).catch(() => null);
    });

    return res.json({
      success: true,
      message: `Batch notification queued successfully for ${targetList.length} users via ${(channel || 'email').toUpperCase()}!`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to send batch notification', error: error.message });
  }
};

export const getAdminUsers = async (req, res) => {
  try {
    const { status, filter } = req.query;

    const where = {};
    if (status === 'banned') where.is_active = false;
    if (status === 'active') where.is_active = true;
    if (filter === 'email_unverified' || filter === 'email-unverified') where.email_verified = false;
    if (filter === 'mobile_unverified' || filter === 'mobile-unverified') {
      where.OR = [{ mobile: null }, { mobile: '' }];
    }
    if (filter === 'kyc_unverified' || filter === 'kyc-unverified' || filter === 'kyc_pending' || filter === 'kyc-pending') {
      where.profile_complete = false;
    }

    const users = await prisma.users.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        email: true,
        full_name: true,
        username: true,
        mobile: true,
        country: true,
        balance: true,
        staked_balance: true,
        total_earned: true,
        is_active: true,
        email_verified: true,
        profile_complete: true,
        created_at: true,
      },
    });

    const mappedUsers = users.map((u) => ({
      ...u,
      name: u.full_name || u.username || 'User',
      mobile_verified: !!(u.mobile && u.mobile.trim() !== ''),
      kyc_status: u.profile_complete ? 'verified' : 'unverified',
    }));

    return res.json({ success: true, users: mappedUsers });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
  }
};

export const getAdminUserDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.users.findFirst({
      where: {
        OR: [{ id }, { username: id }, { email: id }],
      },
      include: {
        deposits: { orderBy: { created_at: 'desc' }, take: 10 },
        withdrawals: { orderBy: { created_at: 'desc' }, take: 10 },
        stakes: { orderBy: { start_date: 'desc' }, take: 10 },
        transactions: { orderBy: { created_at: 'desc' }, take: 10 },
        user_wallets: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch user detail', error: error.message });
  }
};

export const getAdminTransactions = async (req, res) => {
  try {
    const { type } = req.query;

    const where = {};
    if (type && type !== 'All') {
      where.type = type;
    }

    const transactions = await prisma.transactions.findMany({
      where,
      include: {
        user: {
          select: { id: true, full_name: true, username: true, email: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return res.json({ success: true, transactions });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch admin transactions', error: error.message });
  }
};

export const impersonateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.users.findUnique({ where: { id } });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'stakelab_super_secret_jwt_key_2026_change_in_production',
      { expiresIn: '7d' }
    );
    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        username: user.username,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to impersonate user', error: error.message });
  }
};

export const updateAdminUserDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      full_name,
      email,
      mobile,
      country,
      address,
      city,
      state,
      zip_code,
      email_verified,
      mobile_verified,
      two_factor_enabled,
      is_active,
      password,
      withdrawal_pin,
    } = req.body;

    const data = {};
    if (full_name !== undefined) data.full_name = full_name;
    if (email !== undefined) data.email = email;
    if (mobile !== undefined) data.mobile = mobile;
    if (country !== undefined) data.country = country;
    if (address !== undefined) data.address = address;
    if (city !== undefined) data.city = city;
    if (state !== undefined) data.state = state;
    if (zip_code !== undefined) data.zip_code = zip_code;
    if (email_verified !== undefined) data.email_verified = Boolean(email_verified);
    if (mobile_verified !== undefined) data.mobile_verified = Boolean(mobile_verified);
    if (two_factor_enabled !== undefined) data.two_factor_enabled = Boolean(two_factor_enabled);
    if (is_active !== undefined) data.is_active = Boolean(is_active);
    if (withdrawal_pin !== undefined) data.withdrawal_pin = withdrawal_pin;

    if (password && password.trim().length > 0) {
      data.password_hash = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.users.update({
      where: { id },
      data,
    });

    return res.json({
      success: true,
      message: 'User updated successfully',
      user: updated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update user', error: error.message });
  }
};

export const getAdminStakingHistory = async (req, res) => {
  try {
    const stakes = await prisma.user_stakes.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        user: { select: { id: true, username: true, full_name: true, email: true } },
        plan: { select: { name: true } },
      },
    });

    return res.json({ success: true, stakes });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch staking history', error: error.message });
  }
};

let referralConfigStore = {
  depositEnabled: true,
  depositLevels: [
    { level: 1, percent: 10 },
    { level: 2, percent: 5 },
    { level: 3, percent: 3 },
  ],
  stakingEnabled: true,
  stakingLevels: [
    { level: 1, percent: 5 },
    { level: 2, percent: 3 },
    { level: 3, percent: 1 },
  ],
};

export const getReferralSettings = async (req, res) => {
  return res.json({ success: true, referralSettings: referralConfigStore });
};

export const updateReferralSettings = async (req, res) => {
  try {
    const { depositEnabled, depositLevels, stakingEnabled, stakingLevels } = req.body;
    if (depositEnabled !== undefined) referralConfigStore.depositEnabled = Boolean(depositEnabled);
    if (stakingEnabled !== undefined) referralConfigStore.stakingEnabled = Boolean(stakingEnabled);
    if (Array.isArray(depositLevels)) {
      referralConfigStore.depositLevels = depositLevels.map((d) => ({
        level: Number(d.level),
        percent: parseFloat(d.percent || 0),
      }));
    }
    if (Array.isArray(stakingLevels)) {
      referralConfigStore.stakingLevels = stakingLevels.map((s) => ({
        level: Number(s.level),
        percent: parseFloat(s.percent || 0),
      }));
    }

    return res.json({
      success: true,
      message: 'Referral commission settings updated successfully!',
      referralSettings: referralConfigStore,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update referral settings', error: error.message });
  }
};

export const adminChangePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.admin.id;

    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin account not found' });
    }

    const isValid = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.admin.update({
      where: { id: adminId },
      data: { password_hash: newHash },
    });

    return res.json({ success: true, message: 'Admin password changed successfully!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to change admin password', error: error.message });
  }
};

export const globalAdminSearch = async (req, res) => {
  try {
    const q = req.query.query ? req.query.query.trim() : '';
    if (!q || q.length < 1) {
      return res.json({ success: true, results: { users: [], deposits: [], withdrawals: [], tickets: [] } });
    }

    // Search Users
    const users = await prisma.users.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { full_name: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: { id: true, username: true, full_name: true, email: true },
    });

    // Search Deposits
    const deposits = await prisma.deposits.findMany({
      where: {
        OR: [
          { trx: { contains: q, mode: 'insensitive' } },
          { user: { username: { contains: q, mode: 'insensitive' } } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
        ],
      },
      take: 5,
      include: { user: { select: { username: true, full_name: true } } },
    });

    // Search Withdrawals
    const withdrawals = await prisma.withdrawals.findMany({
      where: {
        OR: [
          { wallet_address: { contains: q, mode: 'insensitive' } },
          { user: { username: { contains: q, mode: 'insensitive' } } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
        ],
      },
      take: 5,
      include: { user: { select: { username: true, full_name: true } } },
    });

    // Search Tickets
    const tickets = await prisma.support_tickets.findMany({
      where: {
        OR: [
          { ticket_code: { contains: q, mode: 'insensitive' } },
          { subject: { contains: q, mode: 'insensitive' } },
          { user: { username: { contains: q, mode: 'insensitive' } } },
        ],
      },
      take: 5,
      include: { user: { select: { username: true, full_name: true } } },
    });

    return res.json({
      success: true,
      results: {
        users,
        deposits: deposits.map((d) => ({ id: d.id, amount: d.amount, status: d.status, trx: d.trx, username: d.user?.username })),
        withdrawals: withdrawals.map((w) => ({ id: w.id, amount: w.amount, status: w.status, address: w.wallet_address, username: w.user?.username })),
        tickets: tickets.map((t) => ({ id: t.id, ticket_code: t.ticket_code, subject: t.subject, status: t.status, username: t.user?.username })),
      },
    });
  } catch (error) {
    console.error('Global search error:', error);
    return res.status(500).json({ success: false, message: 'Search failed', error: error.message });
  }
};

let generalSettingsStore = {
  siteTitle: 'EverStake',
  currency: 'USDT',
  currencySymbol: '$',
  timezone: 'UTC',
  registrationBonus: 10.0,
  logoUrl: null,
};

let logoFaviconStore = {
  logoUrl: null,
  faviconUrl: null,
};

let inMemoryGeneralSettings = {
  appDownloadUrl: '/api/app-download',
};

export const getGeneralSettings = async (req, res) => {
  try {
    let settingRecord = await prisma.settings.findFirst();
    if (!settingRecord) {
      settingRecord = await prisma.settings.create({
        data: {
          site_name: 'EverStake',
          site_title: 'EverStake - Next Gen Crypto Staking & Yield Protocol',
        },
      });
    }

    return res.json({
      success: true,
      settings: {
        siteTitle: settingRecord.site_title,
        currency: settingRecord.currency_name,
        currencySymbol: settingRecord.currency_symbol,
        timezone: 'UTC',
        registrationBonus: 0.0,
        logoUrl: settingRecord.site_logo,
        appDownloadUrl: inMemoryGeneralSettings.appDownloadUrl || '/api/app-download',
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch general settings', error: error.message });
  }
};

export const updateGeneralSettings = async (req, res) => {
  try {
    const { siteTitle, currency, currencySymbol, logoUrl, appDownloadUrl } = req.body;

    if (appDownloadUrl) {
      inMemoryGeneralSettings.appDownloadUrl = appDownloadUrl;
    }

    let settingRecord = await prisma.settings.findFirst();
    if (!settingRecord) {
      settingRecord = await prisma.settings.create({
        data: {
          site_name: siteTitle || 'EverStake',
          site_title: siteTitle || 'EverStake - Next Gen Crypto Staking & Yield Protocol',
          ...(logoUrl && { site_logo: logoUrl }),
        },
      });
    } else {
      settingRecord = await prisma.settings.update({
        where: { id: settingRecord.id },
        data: {
          ...(siteTitle !== undefined && { site_title: siteTitle, site_name: siteTitle }),
          ...(currency !== undefined && { currency_name: currency }),
          ...(currencySymbol !== undefined && { currency_symbol: currencySymbol }),
          ...(logoUrl !== undefined && { site_logo: logoUrl }),
        },
      });
    }

    return res.json({
      success: true,
      message: 'General settings updated and saved to database successfully!',
      settings: {
        siteTitle: settingRecord.site_title,
        currency: settingRecord.currency_name,
        currencySymbol: settingRecord.currency_symbol,
        timezone: 'UTC',
        registrationBonus: 0.0,
        logoUrl: settingRecord.site_logo,
        appDownloadUrl: inMemoryGeneralSettings.appDownloadUrl || '/api/app-download',
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update general settings', error: error.message });
  }
};

export const getAppDownloadInfo = async (req, res) => {
  return res.json({
    success: true,
    appDownloadUrl: inMemoryGeneralSettings.appDownloadUrl || '/api/app-download',
    appName: 'EverStake Mobile App',
    version: 'v2.4.0',
    fileSize: '24.5 MB',
  });
};

export const downloadAppApk = (req, res) => {
  const dummyApkContent = Buffer.from('PK\x03\x04\x14\x00\x08\x00\x08\x00EverStake Mobile Android Application v2.4.0 (Release Build)');
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="EverStake-v2.4.0.apk"');
  return res.send(dummyApkContent);
};

export const getLogoFaviconSettings = async (req, res) => {
  try {
    let settingRecord = await prisma.settings.findFirst();
    if (!settingRecord) {
      settingRecord = await prisma.settings.create({
        data: {
          site_name: 'EverStake',
          site_title: 'EverStake - Next Gen Crypto Staking & Yield Protocol',
        },
      });
    }

    return res.json({
      success: true,
      settings: {
        logoUrl: settingRecord.site_logo,
        faviconUrl: settingRecord.site_favicon,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch logo & favicon settings', error: error.message });
  }
};

export const updateLogoFaviconSettings = async (req, res) => {
  try {
    const { logoUrl, faviconUrl } = req.body;

    let settingRecord = await prisma.settings.findFirst();
    if (!settingRecord) {
      settingRecord = await prisma.settings.create({
        data: {
          site_name: 'EverStake',
          site_title: 'EverStake - Next Gen Crypto Staking & Yield Protocol',
          site_logo: logoUrl || null,
          site_favicon: faviconUrl || null,
        },
      });
    } else {
      settingRecord = await prisma.settings.update({
        where: { id: settingRecord.id },
        data: {
          ...(logoUrl !== undefined && { site_logo: logoUrl }),
          ...(faviconUrl !== undefined && { site_favicon: faviconUrl }),
        },
      });
    }

    return res.json({
      success: true,
      message: 'Logo & Favicon updated and saved to database successfully!',
      settings: {
        logoUrl: settingRecord.site_logo,
        faviconUrl: settingRecord.site_favicon,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update Logo & Favicon settings', error: error.message });
  }
};

let maintenanceStore = {
  isMaintenance: false,
  headline: 'THE SITE IS UNDER MAINTENANCE',
  descriptionText: "We're just tuning up a few things. We apologize for the inconvenience but the platform is currently undergoing planned maintenance.\nThanks for your patience.",
  imageUrl: null,
};

export const getMaintenanceSettings = async (req, res) => {
  return res.json({ success: true, settings: maintenanceStore });
};

export const updateMaintenanceSettings = async (req, res) => {
  try {
    const { isMaintenance, headline, descriptionText, imageUrl } = req.body;
    if (isMaintenance !== undefined) maintenanceStore.isMaintenance = Boolean(isMaintenance);
    if (headline !== undefined) maintenanceStore.headline = headline;
    if (descriptionText !== undefined) maintenanceStore.descriptionText = descriptionText;
    if (imageUrl !== undefined) maintenanceStore.imageUrl = imageUrl;

    return res.json({ success: true, message: 'Maintenance mode settings updated successfully!', settings: maintenanceStore });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update maintenance settings', error: error.message });
  }
};

let cookiePolicyStore = {
  isEnabled: true,
  shortDescription: 'We may use cookies or any other tracking technologies when you visit our website, including any other media form, mobile website, or mobile application related or connected to help customize the Site and improve your experience.',
  fullDescription: `What information do we collect?\nWe gather data from you when you register on our site, submit a request, buy any services, react to an overview, or round out a structure.\n\nHow do we protect your information?\nAll provided delicate data is sent through encrypted protocols.\n\nDo we disclose any information to outside parties?\nWe don't sell, exchange, or in any case move to outside gatherings your data.`,
};

export const getCookiePolicySettings = async (req, res) => {
  return res.json({ success: true, settings: cookiePolicyStore });
};

export const updateCookiePolicySettings = async (req, res) => {
  try {
    const { isEnabled, shortDescription, fullDescription } = req.body;
    if (isEnabled !== undefined) cookiePolicyStore.isEnabled = Boolean(isEnabled);
    if (shortDescription !== undefined) cookiePolicyStore.shortDescription = shortDescription;
    if (fullDescription !== undefined) cookiePolicyStore.fullDescription = fullDescription;

    return res.json({ success: true, message: 'GDPR Cookie settings updated successfully!', settings: cookiePolicyStore });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update cookie settings', error: error.message });
  }
};

let adminVerificationPin = '123456';

export const adminChangeVerificationPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (currentPassword && currentPassword !== adminVerificationPin) {
      return res.status(400).json({ success: false, message: 'Current verification password is incorrect.' });
    }

    adminVerificationPin = String(newPassword);
    return res.json({ success: true, message: 'Verification security password updated successfully!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update verification password', error: error.message });
  }
};

export const getAdminNotifications = async (req, res) => {
  try {
    const pendingTickets = await prisma.support_tickets.findMany({
      where: { status: 'PENDING' },
      take: 5,
      orderBy: { updated_at: 'desc' },
      include: { user: { select: { username: true, full_name: true } } },
    });

    const pendingDeposits = await prisma.deposits.findMany({
      where: { status: 'PENDING' },
      take: 5,
      orderBy: { created_at: 'desc' },
      include: { user: { select: { username: true, full_name: true } } },
    });

    const pendingWithdrawals = await prisma.withdrawals.findMany({
      where: { status: 'PENDING' },
      take: 5,
      orderBy: { created_at: 'desc' },
      include: { user: { select: { username: true, full_name: true } } },
    });

    const totalUnreadCount = pendingTickets.length + pendingDeposits.length + pendingWithdrawals.length;

    return res.json({
      success: true,
      unreadCount: totalUnreadCount,
      tickets: pendingTickets,
      deposits: pendingDeposits,
      withdrawals: pendingWithdrawals,
    });
  } catch (err) {
    console.error('Error fetching admin notifications:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
