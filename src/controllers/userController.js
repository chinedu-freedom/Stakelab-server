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

let customHowItWorks = [
  { num: '1', title: 'Sign Up Account', desc: 'First, you need to sign up for our system.', icon: '/images/step1.png' },
  { num: '2', title: 'Deposit', desc: 'Then deposit to your wallet.', icon: '/images/step2.png' },
  { num: '3', title: 'Stake', desc: 'Purchase plan and stake money as per your plan.', icon: '/images/step3.png' },
  { num: '4', title: 'Withdraw Money', desc: 'Finally, you can withdraw your money.', icon: '/images/step4.png' },
];

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
  telegramSupport: 'https://t.me/stakelab_official_support',
  whatsappSupport: 'https://wa.me/1234567890',
  telegramChannel: 'https://t.me/stakelab_community_channel',
  telegramGroup: 'https://t.me/stakelab_group_chat',
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
    title: 'Money Security',
    desc: 'We provide highest secure transaction, deposit and withdrawal process for your security.',
    icon: 'ShieldCheck',
  },
  {
    title: 'Fast Withdraw',
    desc: 'Our withdrawal process is very fast. Any stakeholders can withdraw anytime from our system.',
    icon: 'Zap',
  },
  {
    title: 'Automated Earning',
    desc: 'Stakeholders earning is automated, while they stake money the get their profit automatically.',
    icon: 'TrendingUp',
  },
  {
    title: 'Profitable Plan',
    desc: 'All of our plans are designed to be profitable for stakeholders, allowing them to earn money in a short period.',
    icon: 'Coins',
  },
  {
    title: '24/7 Customer Support',
    desc: "Our 24/7 customer support ensures you're always assisted, no matter the time or issue.",
    icon: 'Headphones',
  },
  {
    title: 'Referral Bonus',
    desc: 'Earn high passive commission from multi-tier affiliate referral rewards when inviting friends.',
    icon: 'Users',
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
