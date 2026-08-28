import { prisma } from '../config/db.js';

export const getUserDashboardData = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        full_name: true,
        email: true,
        username: true,
        balance: true,
        staked_balance: true,
        total_earned: true,
        referral_code: true,
        mobile: true,
        country: true,
        address: true,
        state: true,
        zip_code: true,
        city: true,
        profile_complete: true,
        created_at: true,
      },
    });

    const activeStakes = await prisma.user_stakes.findMany({
      where: { user_id: userId, status: 'ACTIVE' },
      include: { plan: true },
    });

    const recentTransactions = await prisma.transactions.findMany({
      where: { user_id: userId },
      take: 10,
      orderBy: { created_at: 'desc' },
    });

    const referralCount = await prisma.users.count({
      where: { referred_by: userId },
    });

    return res.json({
      success: true,
      user,
      activeStakes,
      recentTransactions,
      referralCount,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch user dashboard', error: error.message });
  }
};

export const updateUserData = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, country, mobile, address, state, zip_code, city } = req.body;

    if (!country || !mobile || !address || !state || !zip_code || !city) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: {
        ...(username ? { username } : {}),
        country,
        mobile,
        address,
        state,
        zip_code,
        city,
        profile_complete: true,
      },
    });

    return res.json({
      success: true,
      message: 'User profile data updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update user data', error: error.message });
  }
};

export const getUserTransactions = async (req, res) => {
  try {
    const transactions = await prisma.transactions.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: 'desc' },
    });
    return res.json({ success: true, transactions });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch transactions', error: error.message });
  }
};

export const getPublicRecentActivity = async (req, res) => {
  try {
    const deposits = await prisma.deposits.findMany({
      where: { status: 'APPROVED' },
      take: 10,
      orderBy: { created_at: 'desc' },
      select: { id: true, payment_method: true, amount: true, created_at: true },
    });

    const withdrawals = await prisma.withdrawals.findMany({
      where: { status: 'APPROVED' },
      take: 10,
      orderBy: { created_at: 'desc' },
      select: { id: true, withdrawal_method: true, amount: true, created_at: true },
    });

    return res.json({
      success: true,
      deposits: deposits.map((d) => ({
        gateway: d.payment_method || 'USDT BEP20',
        date: new Date(d.created_at).toLocaleString(),
        amount: `₮${parseFloat(d.amount).toFixed(2)}`,
      })),
      withdrawals: withdrawals.map((w) => ({
        gateway: w.withdrawal_method || 'USDT BEP20',
        date: new Date(w.created_at).toLocaleString(),
        amount: `₮${parseFloat(w.amount).toFixed(2)}`,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch recent activity', error: error.message });
  }
};



let customTestimonials = [
  {
    name: 'Liam O’Connor',
    country: 'Ireland',
    quote: 'Their crypto staking options are top-notch. I love how easy it is to diversify and earn daily passive returns without dealing with manual yield calculations.',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  },
  {
    name: 'Sofia Martinez',
    country: 'Spain',
    quote: 'I started with USDT and Bitcoin staking through StakeLab, and the returns have been solid. Their platform makes crypto yield investing straightforward for beginners.',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
  },
  {
    name: 'Rahul Kumar',
    country: 'India',
    quote: 'StakeLab’s automated withdrawal and daily payout system helped me fund my business opportunities quickly and safely. The process is fast, transparent, and professional.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
  },
];

let customHowItWorks = [
  {
    num: '1',
    title: 'Create Your Account',
    desc: 'Register your EverStake account and complete the required verification steps.',
    icon: '/images/step1.png',
  },
  {
    num: '2',
    title: 'Fund Your Wallet',
    desc: 'Deposit your eligible digital assets into your EverStake wallet.',
    icon: '/images/step2.png',
  },
  {
    num: '3',
    title: 'Start Staking',
    desc: 'Select an available staking option and allocate your assets according to your chosen plan. Where supported, staking rewards can be automatically reinvested to facilitate compounding.',
    icon: '/images/step3.png',
  },
  {
    num: '4',
    title: 'Withdraw Your Assets',
    badge: 'When eligible',
    desc: 'Request a withdrawal and transfer your available assets to your preferred wallet or exchange, subject to applicable network and platform conditions.',
    icon: '/images/step4.png',
  },
];

export const getHowItWorks = async (req, res) => {
  return res.json({ success: true, steps: customHowItWorks });
};

export const updateHowItWorks = async (req, res) => {
  if (req.body.steps && Array.isArray(req.body.steps)) {
    customHowItWorks = req.body.steps;
  }
  return res.json({ success: true, message: 'How It Works steps updated successfully', steps: customHowItWorks });
};

export const getTestimonials = async (req, res) => {
  return res.json({ success: true, testimonials: customTestimonials });
};

export const updateTestimonials = async (req, res) => {
  if (req.body.testimonials && Array.isArray(req.body.testimonials)) {
    customTestimonials = req.body.testimonials;
  }
  return res.json({ success: true, message: 'Testimonials updated successfully', testimonials: customTestimonials });
};

let customAnnouncements = [
  {
    id: '1',
    date: '18 March, 2024',
    title: 'Planning for Retirement: Strategies for a Secure Future',
    desc: 'Crypto currencies are sets of software protocols for generating digital tokens and tracking transactions to build long-term wealth.',
    img: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: '2',
    date: '18 March, 2024',
    title: "Demystifying Cryptocurrency: A Beginner's Guide",
    desc: "Invest in the world's leading digital assets and proof-of-stake networks with automated yield generation and high security.",
    img: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: '3',
    date: '18 March, 2024',
    title: 'Maximizing Yield Returns with Stakelab Proof-of-Stake',
    desc: 'Discover advanced staking pool allocation strategies designed for consistent high-yield earnings and asset protection.',
    img: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=600&q=80',
  },
];

let customPartners = [
  { name: 'Binance', logo: 'https://cryptologos.cc/logos/binance-coin-bnb-logo.png', status: 'ACTIVE' },
  { name: 'Bybit', logo: 'https://cryptologos.cc/logos/bybit-logo.png', status: 'ACTIVE' },
  { name: 'Mexc', logo: 'https://cryptologos.cc/logos/mexc-logo.png', status: 'ACTIVE' },
  { name: 'HTX', logo: 'https://cryptologos.cc/logos/htx-logo.png', status: 'ACTIVE' },
  { name: 'OKX', logo: 'https://cryptologos.cc/logos/okx-logo.png', status: 'ACTIVE' },
  { name: 'BingX', logo: 'https://cryptologos.cc/logos/bingx-logo.png', status: 'ACTIVE' },
  { name: 'Kraken', logo: 'https://cryptologos.cc/logos/kraken-logo.png', status: 'ACTIVE' },
  { name: 'Luno', logo: 'https://cryptologos.cc/logos/luno-logo.png', status: 'ACTIVE' },
];

export const getAnnouncements = async (req, res) => {
  return res.json({ success: true, announcements: customAnnouncements });
};

export const updateAnnouncements = async (req, res) => {
  if (req.body.announcements && Array.isArray(req.body.announcements)) {
    customAnnouncements = req.body.announcements;
  }
  return res.json({ success: true, message: 'Announcements updated successfully', announcements: customAnnouncements });
};

export const getPartners = async (req, res) => {
  return res.json({ success: true, partners: customPartners });
};

export const updatePartners = async (req, res) => {
  if (req.body.partners && Array.isArray(req.body.partners)) {
    customPartners = req.body.partners;
  }
  return res.json({ success: true, message: 'Exchange Partners updated successfully', partners: customPartners });
};

let customContactLinks = {
  whatsappSupport: 'https://wa.me/1234567890',
  telegramChannel: 'https://t.me/stakelab_community_channel',
  whatsappGroupModal: 'https://chat.whatsapp.com/stakelab_vip_group',
};

export const getContactLinks = async (req, res) => {
  return res.json({ success: true, contactLinks: customContactLinks });
};

export const updateContactLinks = async (req, res) => {
  if (req.body) {
    customContactLinks = { ...customContactLinks, ...req.body };
  }
  return res.json({ success: true, message: 'Contact links updated successfully', contactLinks: customContactLinks });
};



let customWhyChooseUs = [
  {
    title: 'Institutional Security',
    desc: 'Enterprise-grade non-custodial validator architecture with robust security controls and risk management.',
    icon: 'ShieldCheck',
  },
  {
    title: 'Multi-Chain Support',
    desc: 'Active validator node operations supporting more than 130 Proof-of-Stake blockchain networks.',
    icon: 'Globe',
  },
  {
    title: 'Automated Yield Strategies',
    desc: 'Intelligent staking engines designed to streamline asset allocation and compounding rewards.',
    icon: 'TrendingUp',
  },
  {
    title: 'High Availability Infrastructure',
    desc: '99.9%+ node uptime backed by 24/7 continuous monitoring and rapid response protocols.',
    icon: 'Zap',
  },
  {
    title: 'Transparent Payouts',
    desc: 'Reliable reward distributions with instant withdrawal requests subject to network conditions.',
    icon: 'Coins',
  },
  {
    title: '24/7 Professional Support',
    desc: 'Dedicated technical assistance and client care available around the clock.',
    icon: 'Headphones',
  },
];

export const getWhyChooseUs = async (req, res) => {
  return res.json({ success: true, items: customWhyChooseUs });
};

export const updateWhyChooseUs = async (req, res) => {
  if (req.body.items && Array.isArray(req.body.items)) {
    customWhyChooseUs = req.body.items;
  }
  return res.json({ success: true, message: 'Why Choose Us section updated successfully', items: customWhyChooseUs });
};

let customDepositWithdrawalSettings = {
  dailyWithdrawLimit: '5',
  minDeposit: '1.00',
  maxDeposit: '50000.00',
  depositCharge: '0.00',
  minPayout: '2.00',
  maxPayout: '1000.00',
  payoutCharge: '1.00',
  rechargeNotice: '• All deposits are verified on the blockchain automatically.\n• Please send exact amounts to official generated wallet address.\n• Minimum deposit limit: $1.00.\n• Deposits below min limits cannot be credited.',
  withdrawNotice: '• Safely withdraw your funds using our highly secure process and various withdrawal methods.\n• Minimum withdrawal limit: $2.00.\n• Processing time: 1–24 hours.\n• Security PIN verification is required for all payout requests.',
};

export const getDepositWithdrawalSettings = async (req, res) => {
  return res.json({ success: true, settings: customDepositWithdrawalSettings });
};

export const updateDepositWithdrawalSettings = async (req, res) => {
  if (req.body.settings) {
    customDepositWithdrawalSettings = { ...customDepositWithdrawalSettings, ...req.body.settings };
  }
  return res.json({ success: true, message: 'Deposit & Withdrawal settings updated successfully', settings: customDepositWithdrawalSettings });
};

export const getUserReferralsData = async (req, res) => {
  try {
    const userId = req.user.id;

    // Level 1 Users (Direct)
    const level1Users = await prisma.users.findMany({
      where: { referred_by: userId },
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        created_at: true,
        is_active: true,
        balance: true,
        total_earned: true,
      },
      orderBy: { created_at: 'desc' },
    });

    const level1Ids = level1Users.map((u) => u.id);

    // Level 2 Users
    const level2Users = level1Ids.length > 0
      ? await prisma.users.findMany({
          where: { referred_by: { in: level1Ids } },
          select: {
            id: true,
            username: true,
            full_name: true,
            email: true,
            created_at: true,
            is_active: true,
            balance: true,
            total_earned: true,
          },
          orderBy: { created_at: 'desc' },
        })
      : [];

    const level2Ids = level2Users.map((u) => u.id);

    // Level 3 Users
    const level3Users = level2Ids.length > 0
      ? await prisma.users.findMany({
          where: { referred_by: { in: level2Ids } },
          select: {
            id: true,
            username: true,
            full_name: true,
            email: true,
            created_at: true,
            is_active: true,
            balance: true,
            total_earned: true,
          },
          orderBy: { created_at: 'desc' },
        })
      : [];

    const level3Ids = level3Users.map((u) => u.id);
    const allReferredIds = [...level1Ids, ...level2Ids, ...level3Ids];

    // Fetch approved deposits
    const confirmedDeposits = allReferredIds.length > 0
      ? await prisma.deposits.findMany({
          where: {
            user_id: { in: allReferredIds },
            status: 'APPROVED',
          },
          select: { user_id: true, amount: true },
        })
      : [];

    const depositMap = {};
    confirmedDeposits.forEach((d) => {
      depositMap[d.user_id] = (depositMap[d.user_id] || 0) + Number(d.amount);
    });

    // Fetch active stakes
    const activeStakes = allReferredIds.length > 0
      ? await prisma.stakes.findMany({
          where: {
            user_id: { in: allReferredIds },
            status: 'ACTIVE',
          },
          select: { user_id: true, amount: true },
        })
      : [];

    const stakeMap = {};
    activeStakes.forEach((s) => {
      stakeMap[s.user_id] = (stakeMap[s.user_id] || 0) + Number(s.amount);
    });

    // Fetch referral commission transactions
    const commissionTx = await prisma.transactions.findMany({
      where: {
        user_id: userId,
        type: 'REFERRAL_COMMISSION',
      },
      select: { amount: true, description: true },
    });

    const totalTeamCommission = commissionTx.reduce((acc, tx) => acc + Number(tx.amount), 0);

    const buildLevelData = (usersList, commPerc) => {
      let numberActive = 0;
      let totalRecharge = 0;
      let totalStaked = 0;

      const formattedUsers = usersList.map((u) => {
        const userDep = depositMap[u.id] || 0;
        const userStake = stakeMap[u.id] || 0;
        const active = u.is_active || userDep > 0 || userStake > 0;
        if (active) numberActive++;
        totalRecharge += userDep;
        totalStaked += userStake;

        return {
          id: u.id,
          username: u.username,
          full_name: u.full_name,
          email: u.email,
          created_at: u.created_at,
          is_active: active,
          totalRecharge: userDep,
          totalStaked: userStake,
        };
      });

      const commission = totalStaked * (commPerc / 100);

      return {
        totalHeadcount: usersList.length,
        numberActive,
        totalRecharge,
        commission,
        users: formattedUsers,
      };
    };

    const level1Data = buildLevelData(level1Users, 10);
    const level2Data = buildLevelData(level2Users, 5);
    const level3Data = buildLevelData(level3Users, 3);

    const totalTeamMembers = level1Data.totalHeadcount + level2Data.totalHeadcount + level3Data.totalHeadcount;

    return res.json({
      success: true,
      totalTeamMembers,
      teamCommission: totalTeamCommission > 0 ? totalTeamCommission : (level1Data.commission + level2Data.commission + level3Data.commission),
      levels: {
        level1: level1Data,
        level2: level2Data,
        level3: level3Data,
      },
    });
  } catch (error) {
    console.error('Failed to fetch referral levels data:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch referral data', error: error.message });
  }
};

export const sendSecurityPinOtp = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.users.update({
      where: { id: userId },
      data: {
        otp_secret: otpCode,
        otp_expires_at: expiresAt,
      },
    });

    sendEmail({
      to: user.email,
      subject: '🔑 Security PIN Setup / Reset Code - StakeLab',
      html: `<h2>Security PIN Reset Request</h2><p>Your 6-digit verification code is: <b style="font-size:20px;color:#ff0044;">${otpCode}</b></p><p>This code expires in 10 minutes.</p>`,
      emailType: 'PIN_RESET_OTP',
      userId,
    });

    return res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to send OTP code', error: error.message });
  }
};

export const updateSecurityPin = async (req, res) => {
  try {
    const { new_pin, otp_code } = req.body;
    const userId = req.user.id;

    if (!new_pin || new_pin.length < 4) {
      return res.status(400).json({ success: false, message: 'PIN must be at least 4 digits' });
    }

    const user = await prisma.users.findUnique({ where: { id: userId } });

    if (otp_code) {
      if (user.otp_secret !== otp_code) {
        return res.status(400).json({ success: false, message: 'Invalid verification OTP code' });
      }
      if (user.otp_expires_at && new Date() > new Date(user.otp_expires_at)) {
        return res.status(400).json({ success: false, message: 'OTP code has expired' });
      }
    }

    await prisma.users.update({
      where: { id: userId },
      data: {
        withdrawal_pin: new_pin,
        otp_secret: null,
        otp_expires_at: null,
      },
    });

    return res.json({ success: true, message: 'Security PIN updated successfully!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update Security PIN', error: error.message });
  }
};

export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const answeredTickets = await prisma.support_tickets.findMany({
      where: { user_id: userId, status: { in: ['ANSWERED', 'REPLIED'] } },
      take: 5,
      orderBy: { updated_at: 'desc' },
      select: { id: true, ticket_code: true, subject: true, status: true, updated_at: true },
    });

    const recentDeposits = await prisma.deposits.findMany({
      where: { user_id: userId },
      take: 5,
      orderBy: { created_at: 'desc' },
      select: { id: true, amount: true, status: true, created_at: true },
    });

    const recentWithdrawals = await prisma.withdrawals.findMany({
      where: { user_id: userId },
      take: 5,
      orderBy: { created_at: 'desc' },
      select: { id: true, amount: true, status: true, created_at: true },
    });

    const unreadCount = answeredTickets.length + recentDeposits.filter((d) => d.status === 'APPROVED').length;

    return res.json({
      success: true,
      unreadCount,
      tickets: answeredTickets,
      deposits: recentDeposits,
      withdrawals: recentWithdrawals,
    });
  } catch (err) {
    console.error('Error fetching user notifications:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
