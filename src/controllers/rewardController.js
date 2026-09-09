// Reward & Gamification Suite Controllers for EverStake (PostgreSQL Database Persisted)
import { prisma } from '../config/db.js';

// --- Gift Codes Controllers ---
export const getGiftCodes = async (req, res) => {
  try {
    const codes = await prisma.gift_codes.findMany({
      include: { claims: true },
      orderBy: { created_at: 'desc' },
    });
    const formatted = codes.map((c) => ({
      id: c.id,
      code_name: 'Bonus Code',
      code: c.code,
      amount: parseFloat(c.reward),
      max_uses: c.max_claims,
      used_count: c.used_claims || c.claims.length,
      status: c.status ? 'ACTIVE' : 'INACTIVE',
      created_at: c.created_at,
    }));
    return res.json({ success: true, codes: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch gift codes', error: err.message });
  }
};

export const createGiftCode = async (req, res) => {
  try {
    const { code, amount, max_uses, expire_at } = req.body;
    if (!code || !amount) {
      return res.status(400).json({ success: false, message: 'Code and amount are required' });
    }
    const cleanCode = String(code).toUpperCase().trim();
    const created = await prisma.gift_codes.create({
      data: {
        code: cleanCode,
        reward: parseFloat(amount),
        max_claims: parseInt(max_uses) || 100,
        status: true,
      },
    });
    return res.status(201).json({
      success: true,
      message: 'Gift code created successfully!',
      code: {
        id: created.id,
        code_name: 'Bonus Code',
        code: created.code,
        amount: parseFloat(created.reward),
        max_uses: created.max_claims,
        used_count: 0,
        status: 'ACTIVE',
        created_at: created.created_at,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create gift code', error: err.message });
  }
};

export const updateGiftCode = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, max_uses, status } = req.body;
    const updated = await prisma.gift_codes.update({
      where: { id },
      data: {
        ...(amount !== undefined && { reward: parseFloat(amount) }),
        ...(max_uses !== undefined && { max_claims: parseInt(max_uses) }),
        ...(status !== undefined && { status: status === 'ACTIVE' || Boolean(status) }),
      },
    });
    return res.json({ success: true, message: 'Gift code updated successfully!', code: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update gift code', error: err.message });
  }
};

export const deleteGiftCode = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.gift_codes.delete({ where: { id } });
    return res.json({ success: true, message: 'Gift code deleted successfully!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete gift code', error: err.message });
  }
};

export const getGiftCodeClaims = async (req, res) => {
  try {
    const claims = await prisma.gift_code_claims.findMany({
      include: { user: true, gift_code: true },
      orderBy: { claimed_at: 'desc' },
    });
    const formatted = claims.map((c) => ({
      id: c.id,
      user_id: c.user_id,
      code: c.gift_code?.code || 'GIFT',
      user_name: c.user?.full_name || c.user?.username || 'Valued User',
      user_email: c.user?.email || '',
      amount: parseFloat(c.reward),
      claimed_at: c.claimed_at,
    }));
    return res.json({ success: true, claims: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch claims', error: err.message });
  }
};

export const getUserGiftCodeClaims = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.json({ success: true, claims: [] });
    const claims = await prisma.gift_code_claims.findMany({
      where: { user_id: userId },
      include: { gift_code: true },
      orderBy: { claimed_at: 'desc' },
    });
    const formatted = claims.map((c) => ({
      id: c.id,
      code: c.gift_code?.code || 'GIFT',
      amount: parseFloat(c.reward),
      claimed_at: c.claimed_at,
    }));
    return res.json({ success: true, claims: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch user claims', error: err.message });
  }
};

export const claimGiftCode = async (req, res) => {
  try {
    if (!req.user?.email_verified) {
      return res.status(403).json({ success: false, require_email_verification: true, message: 'Please verify your email address first.' });
    }

    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Please enter a gift code.' });
    }

    const cleanCode = String(code).trim().toUpperCase();
    const foundCode = await prisma.gift_codes.findUnique({
      where: { code: cleanCode },
      include: { claims: true },
    });

    if (!foundCode) {
      return res.status(404).json({ success: false, message: 'Invalid gift code. Please check and try again.' });
    }

    if (!foundCode.status) {
      return res.status(400).json({ success: false, message: 'This gift code is no longer active.' });
    }

    if (foundCode.used_claims >= foundCode.max_claims) {
      return res.status(400).json({ success: false, message: 'This gift code has reached its maximum usage limit.' });
    }

    const userId = req.user.id;
    const existingClaim = await prisma.gift_code_claims.findUnique({
      where: {
        code_id_user_id: {
          code_id: foundCode.id,
          user_id: userId,
        },
      },
    });

    if (existingClaim) {
      return res.status(400).json({ success: false, message: 'You have already claimed this gift code.' });
    }

    const rewardAmt = parseFloat(foundCode.reward || 0);
    const dbUser = await prisma.users.findUnique({ where: { id: userId } });
    const oldBal = parseFloat(dbUser.balance || 0);
    const oldEarned = parseFloat(dbUser.total_earned || 0);
    const newBal = oldBal + rewardAmt;
    const newEarned = oldEarned + rewardAmt;

    await prisma.$transaction([
      prisma.gift_code_claims.create({
        data: {
          code_id: foundCode.id,
          user_id: userId,
          reward: rewardAmt,
        },
      }),
      prisma.gift_codes.update({
        where: { id: foundCode.id },
        data: { used_claims: { increment: 1 } },
      }),
      prisma.users.update({
        where: { id: userId },
        data: { balance: newBal, total_earned: newEarned },
      }),
      prisma.transactions.create({
        data: {
          user_id: userId,
          type: 'GIFT_BONUS',
          amount: rewardAmt,
          balance_before: oldBal,
          balance_after: newBal,
          description: `Claimed Gift Code: ${foundCode.code}`,
        },
      }),
    ]);

    return res.json({
      success: true,
      message: `Congratulations! You received $${rewardAmt.toFixed(2)} bonus!`,
      amount: rewardAmt,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to claim gift code', error: err.message });
  }
};

// --- Tasks Controllers ---
export const getTasks = async (req, res) => {
  try {
    const tasks = await prisma.system_tasks.findMany({
      include: { claims: true },
      orderBy: { created_at: 'desc' },
    });
    const formatted = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      invites_required: t.req_value || 1,
      reward_amount: parseFloat(t.reward),
      target_url: t.link || '#',
      task_type: t.req_type || 'INVITATION',
      status: t.is_active ? 'ACTIVE' : 'INACTIVE',
      claims_count: t.claims.length,
      created_at: t.created_at,
    }));
    return res.json({ success: true, tasks: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch tasks', error: err.message });
  }
};

export const createTask = async (req, res) => {
  try {
    const { title, description, reward_amount, target_url, task_type, invites_required } = req.body;
    if (!title || !reward_amount) {
      return res.status(400).json({ success: false, message: 'Title and reward amount are required' });
    }
    const created = await prisma.system_tasks.create({
      data: {
        title,
        description: description || '',
        reward: parseFloat(reward_amount),
        link: target_url || '#',
        req_type: task_type || 'INVITATION',
        req_value: parseInt(invites_required) || 1,
        is_active: true,
      },
    });
    return res.status(201).json({
      success: true,
      message: 'Task created successfully!',
      task: {
        id: created.id,
        title: created.title,
        description: created.description,
        reward_amount: parseFloat(created.reward),
        target_url: created.link,
        task_type: created.req_type,
        status: 'ACTIVE',
        claims_count: 0,
        created_at: created.created_at,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create task', error: err.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, reward_amount, target_url, status, invites_required } = req.body;
    const updated = await prisma.system_tasks.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(reward_amount !== undefined && { reward: parseFloat(reward_amount) }),
        ...(target_url !== undefined && { link: target_url }),
        ...(invites_required !== undefined && { req_value: parseInt(invites_required) }),
        ...(status !== undefined && { is_active: status === 'ACTIVE' || Boolean(status) }),
      },
    });
    return res.json({ success: true, message: 'Task updated successfully!', task: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update task', error: err.message });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.system_tasks.delete({ where: { id } });
    return res.json({ success: true, message: 'Task deleted successfully!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete task', error: err.message });
  }
};

// --- Daily Check-Ins Controllers ---
const seedDefaultCheckinSettings = async () => {
  const defaults = [
    { day: 1, reward: 0.10 },
    { day: 2, reward: 0.20 },
    { day: 3, reward: 0.02 },
    { day: 4, reward: 0.10 },
    { day: 5, reward: 0.30 },
    { day: 6, reward: 0.40 },
    { day: 7, reward: 0.50 },
  ];
  for (const d of defaults) {
    await prisma.daily_checkin_settings.upsert({
      where: { day: d.day },
      update: {},
      create: { day: d.day, reward: d.reward, is_active: true },
    });
  }
};

export const getDailyCheckins = async (req, res) => {
  try {
    let settings = await prisma.daily_checkin_settings.findMany({ orderBy: { day: 'asc' } });
    if (settings.length === 0) {
      await seedDefaultCheckinSettings();
      settings = await prisma.daily_checkin_settings.findMany({ orderBy: { day: 'asc' } });
    }
    const formatted = settings.map((s) => ({
      id: s.id,
      day_number: s.day,
      reward_amount: parseFloat(s.reward),
      description: s.day === 7 ? 'Day 7 FINAL REWARD' : `Day ${s.day} reward`,
      is_enabled: s.is_active,
      is_final: s.day === 7,
    }));
    return res.json({ success: true, checkins: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch check-ins', error: err.message });
  }
};

export const getCheckIns = async (req, res) => {
  return getDailyCheckins(req, res);
};

export const updateDailyCheckins = async (req, res) => {
  try {
    if (Array.isArray(req.body.checkins)) {
      for (const item of req.body.checkins) {
        if (item.day_number) {
          await prisma.daily_checkin_settings.upsert({
            where: { day: parseInt(item.day_number) },
            update: {
              reward: parseFloat(item.reward_amount || 0),
              is_active: item.is_enabled !== false,
            },
            create: {
              day: parseInt(item.day_number),
              reward: parseFloat(item.reward_amount || 0),
              is_active: item.is_enabled !== false,
            },
          });
        }
      }
    }
    return getDailyCheckins(req, res);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to save daily check-in settings', error: err.message });
  }
};

export const updateCheckInsBulk = async (req, res) => {
  return updateDailyCheckins(req, res);
};

export const getUserDailyCheckinStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const todayStr = new Date().toISOString().split('T')[0];
    
    let userCheckin = await prisma.user_daily_checkins.findUnique({ where: { user_id: userId } });
    const currentStreak = userCheckin ? userCheckin.streak : 0;
    const isClaimedToday = userCheckin ? userCheckin.last_date === todayStr : false;
    const availableDayNum = currentStreak + 1;

    let settings = await prisma.daily_checkin_settings.findMany({ orderBy: { day: 'asc' } });
    if (settings.length === 0) {
      await seedDefaultCheckinSettings();
      settings = await prisma.daily_checkin_settings.findMany({ orderBy: { day: 'asc' } });
    }

    const rewards = settings.map((item) => {
      let status = 'locked';
      if (item.day <= currentStreak) {
        status = 'claimed';
      } else if (item.day === availableDayNum) {
        status = isClaimedToday ? 'locked' : 'available';
      }
      return {
        day: item.day,
        amount: parseFloat(item.reward),
        description: item.day === 7 ? 'Day 7 FINAL REWARD' : `Day ${item.day} reward`,
        status,
      };
    });

    return res.json({
      success: true,
      enabled: true,
      currentStreak,
      claimedToday: isClaimedToday,
      maxDays: 7,
      rewards,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch check-in status', error: err.message });
  }
};

export const claimUserDailyCheckin = async (req, res) => {
  try {
    if (!req.user?.email_verified) {
      return res.status(403).json({ success: false, require_email_verification: true, message: 'Please verify your email address first.' });
    }
    const userId = req.user.id;
    const todayStr = new Date().toISOString().split('T')[0];

    let userCheckin = await prisma.user_daily_checkins.findUnique({ where: { user_id: userId } });
    if (userCheckin && userCheckin.last_date === todayStr) {
      return res.status(400).json({ success: false, message: "You have already claimed today's daily reward. Please check back tomorrow!" });
    }

    const currentStreak = userCheckin ? userCheckin.streak : 0;
    const dayToClaim = currentStreak + 1;

    let rewardSetting = await prisma.daily_checkin_settings.findUnique({ where: { day: dayToClaim } });
    if (!rewardSetting) {
      rewardSetting = { reward: 0.10 };
    }
    const rewardAmount = parseFloat(rewardSetting.reward || 0.10);

    const nextStreak = dayToClaim >= 7 ? 0 : dayToClaim;

    const dbUser = await prisma.users.findUnique({ where: { id: userId } });
    const oldBal = parseFloat(dbUser.balance || 0);
    const oldEarned = parseFloat(dbUser.total_earned || 0);
    const newBal = oldBal + rewardAmount;
    const newEarned = oldEarned + rewardAmount;

    await prisma.$transaction([
      prisma.user_daily_checkins.upsert({
        where: { user_id: userId },
        update: {
          last_day: dayToClaim,
          last_date: todayStr,
          streak: nextStreak,
        },
        create: {
          user_id: userId,
          last_day: dayToClaim,
          last_date: todayStr,
          streak: nextStreak,
        },
      }),
      prisma.users.update({
        where: { id: userId },
        data: { balance: newBal, total_earned: newEarned },
      }),
      prisma.transactions.create({
        data: {
          user_id: userId,
          type: 'DAILY_CHECKIN',
          amount: rewardAmount,
          balance_before: oldBal,
          balance_after: newBal,
          description: `Daily Check-In Reward (Day ${dayToClaim})`,
        },
      }),
    ]);

    return res.json({
      success: true,
      message: `Day ${dayToClaim} reward of $${rewardAmount.toFixed(2)} claimed successfully and credited to your balance!`,
      amount: rewardAmount,
      claimedDay: dayToClaim,
      nextStreakDay: nextStreak,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to claim daily check-in', error: err.message });
  }
};

// --- Spin Wheel Controllers ---
const seedDefaultSpinPrizes = async () => {
  const defaults = [
    { label: '$0.50', value: 0.5, color: '#3b82f6', probability: 25 },
    { label: '$2.50', value: 2.5, color: '#10b981', probability: 7 },
    { label: '$0.20', value: 0.2, color: '#64748b', probability: 35 },
    { label: '$10.50', value: 10.5, color: '#8b5cf6', probability: 3.5 },
    { label: '$0.77', value: 0.77, color: '#ff0044', probability: 18 },
    { label: '$15.15', value: 15.15, color: '#f59e0b', probability: 1.2 },
    { label: '$1.25', value: 1.25, color: '#ec4899', probability: 10 },
    { label: '$20.20', value: 20.2, color: '#fe780b', probability: 0.3 },
  ];
  for (const p of defaults) {
    await prisma.spin_prizes.create({ data: p });
  }
};

export const getSpinPrizes = async (req, res) => {
  try {
    let prizes = await prisma.spin_prizes.findMany({ orderBy: { created_at: 'asc' } });
    if (prizes.length === 0) {
      await seedDefaultSpinPrizes();
      prizes = await prisma.spin_prizes.findMany({ orderBy: { created_at: 'asc' } });
    }
    const formatted = prizes.map((p, idx) => ({
      id: p.id,
      position: idx + 1,
      label: p.label,
      prize_type: 'CASH',
      amount: parseFloat(p.value),
      probability: p.probability,
      color: p.color || '#3b82f6',
    }));
    return res.json({ success: true, prizes: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch spin prizes', error: err.message });
  }
};

export const createSpinPrize = async (req, res) => {
  try {
    const existingCount = await prisma.spin_prizes.count();
    if (existingCount >= 8) {
      return res.status(400).json({ success: false, message: 'Maximum of 8 spin prize slices reached' });
    }
    const prize = await prisma.spin_prizes.create({
      data: {
        label: req.body.label || 'Reward',
        value: parseFloat(req.body.amount) || 0,
        color: req.body.color || '#3b82f6',
        probability: parseFloat(req.body.probability) || 10,
        is_active: true,
      },
    });
    return res.status(201).json({ success: true, message: 'Spin prize slice added successfully!', prize });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create spin prize', error: err.message });
  }
};

export const updateSpinPrize = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await prisma.spin_prizes.update({
      where: { id },
      data: {
        ...(req.body.label !== undefined && { label: req.body.label }),
        ...(req.body.amount !== undefined && { value: parseFloat(req.body.amount) }),
        ...(req.body.color !== undefined && { color: req.body.color }),
        ...(req.body.probability !== undefined && { probability: parseFloat(req.body.probability) }),
      },
    });
    return res.json({ success: true, message: 'Spin prize updated successfully!', prize: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update spin prize', error: err.message });
  }
};

export const deleteSpinPrize = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.spin_prizes.delete({ where: { id } });
    return res.json({ success: true, message: 'Spin prize deleted successfully!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete spin prize', error: err.message });
  }
};

export const getSpinSettings = async (req, res) => {
  try {
    const [spinWinAgg, totalSpinsCount, freeSpinsCount, spinFeature] = await Promise.all([
      prisma.transactions.aggregate({
        where: { type: 'SPIN_WIN' },
        _sum: { amount: true },
      }),
      prisma.transactions.count({
        where: { type: { in: ['SPIN_WIN', 'SPIN_FEE'] } },
      }),
      prisma.transactions.count({
        where: { type: 'SPIN_WIN', description: { contains: 'free', mode: 'insensitive' } },
      }),
      prisma.system_feature_toggles.findUnique({ where: { key: 'spinWheel' } }),
    ]);

    const totalSpins = totalSpinsCount || 0;
    const totalRewards = parseFloat(spinWinAgg._sum.amount || 0);
    const freeSpinsRedeemed = freeSpinsCount || 0;
    const featureEnabled = spinFeature ? spinFeature.is_enabled : true;

    return res.json({
      success: true,
      settings: {
        feature_enabled: featureEnabled,
        total_spins_used: totalSpins,
        total_rewards_earned: totalRewards,
        free_spins_used: freeSpinsRedeemed,
      },
    });
  } catch (err) {
    return res.json({
      success: true,
      settings: { feature_enabled: true, total_spins_used: 0, total_rewards_earned: 0, free_spins_used: 0 },
    });
  }
};

export const updateSpinSettings = async (req, res) => {
  try {
    if (req.body.feature_enabled !== undefined) {
      await prisma.system_feature_toggles.upsert({
        where: { key: 'spinWheel' },
        update: { is_enabled: Boolean(req.body.feature_enabled) },
        create: { key: 'spinWheel', is_enabled: Boolean(req.body.feature_enabled) },
      });
    }
    return res.json({ success: true, message: 'Spin wheel settings updated successfully!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update spin settings', error: err.message });
  }
};

// --- System Feature Toggles Controllers ---
export const getSystemFeatures = async (req, res) => {
  try {
    const toggles = await prisma.system_feature_toggles.findMany();
    const features = {
      giftBonus: true,
      tasks: true,
      dailyCheckin: true,
      spinWheel: true,
    };
    toggles.forEach((t) => {
      features[t.key] = t.is_enabled;
    });
    return res.json({ success: true, features });
  } catch (err) {
    return res.json({
      success: true,
      features: { giftBonus: true, tasks: true, dailyCheckin: true, spinWheel: true },
    });
  }
};

export const updateSystemFeatures = async (req, res) => {
  try {
    if (req.body) {
      for (const [key, val] of Object.entries(req.body)) {
        await prisma.system_feature_toggles.upsert({
          where: { key },
          update: { is_enabled: Boolean(val) },
          create: { key, is_enabled: Boolean(val) },
        });
      }
    }
    return getSystemFeatures(req, res);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update system features', error: err.message });
  }
};

export const getUserTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    let todayReferralsCount = 0;
    try {
      todayReferralsCount = await prisma.users.count({
        where: { referred_by: userId },
      });
    } catch (e) {
      todayReferralsCount = 0;
    }

    const [allTasks, userClaims] = await Promise.all([
      prisma.system_tasks.findMany({ where: { is_active: true }, orderBy: { created_at: 'desc' } }),
      prisma.user_task_claims.findMany({ where: { user_id: userId } }),
    ]);

    const claimedTaskIds = new Set(userClaims.map((c) => c.task_id));

    const tasksWithStatus = allTasks.map((t) => {
      const isClaimed = claimedTaskIds.has(t.id);
      const requiredReferrals = t.req_value || 15;
      const progress = Math.min(todayReferralsCount, requiredReferrals);
      const isReady = todayReferralsCount >= requiredReferrals && !isClaimed;

      return {
        id: t.id,
        task_name: t.title,
        description: t.description,
        reward_amount: parseFloat(t.reward),
        required_referrals: requiredReferrals,
        progress,
        isReady,
        isClaimed,
      };
    });

    return res.json({
      success: true,
      todayReferralsCount,
      tasks: tasksWithStatus,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch user tasks', error: err.message });
  }
};

export const claimUserTask = async (req, res) => {
  try {
    if (!req.user?.email_verified) {
      return res.status(403).json({ success: false, require_email_verification: true, message: 'Please verify your email address first.' });
    }
    const { taskId } = req.body;
    const userId = req.user.id;

    const taskObj = await prisma.system_tasks.findUnique({ where: { id: taskId } });
    if (!taskObj || !taskObj.is_active) {
      return res.status(404).json({ success: false, message: 'Task not found or inactive.' });
    }

    const existingClaim = await prisma.user_task_claims.findUnique({
      where: {
        task_id_user_id: {
          task_id: taskId,
          user_id: userId,
        },
      },
    });

    if (existingClaim) {
      return res.status(400).json({ success: false, message: 'You have already claimed this task reward.' });
    }

    const rewardAmount = parseFloat(taskObj.reward || 0);
    const dbUser = await prisma.users.findUnique({ where: { id: userId } });
    const oldBal = parseFloat(dbUser.balance || 0);
    const oldEarned = parseFloat(dbUser.total_earned || 0);
    const newBal = oldBal + rewardAmount;
    const newEarned = oldEarned + rewardAmount;

    await prisma.$transaction([
      prisma.user_task_claims.create({
        data: {
          task_id: taskId,
          user_id: userId,
        },
      }),
      prisma.users.update({
        where: { id: userId },
        data: { balance: newBal, total_earned: newEarned },
      }),
      prisma.transactions.create({
        data: {
          user_id: userId,
          type: 'TASK_REWARD',
          amount: rewardAmount,
          balance_before: oldBal,
          balance_after: newBal,
          description: `Claimed Task: ${taskObj.title}`,
        },
      }),
    ]);

    return res.json({
      success: true,
      message: `Task reward of $${rewardAmount.toFixed(2)} claimed successfully and credited to your balance!`,
      amount: rewardAmount,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to claim task reward', error: err.message });
  }
};

export const getUserSpinInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const dbUser = await prisma.users.findUnique({ where: { id: userId } });
    const userFreeSpins = dbUser ? dbUser.free_spins || 0 : 0;

    const [prizes, wins, earned] = await Promise.all([
      prisma.spin_prizes.findMany({ where: { is_active: true }, orderBy: { created_at: 'asc' } }),
      prisma.transactions.findMany({
        where: { user_id: userId, type: 'SPIN_WIN' },
        take: 10,
        orderBy: { created_at: 'desc' },
      }),
      prisma.transactions.findMany({
        where: { user_id: userId, type: 'FREE_SPIN_REWARD' },
        take: 15,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const formattedPrizes = prizes.map((p, idx) => ({
      id: p.id,
      position: idx + 1,
      label: p.label,
      prize_type: 'CASH',
      amount: parseFloat(p.value),
      probability: p.probability,
      color: p.color || '#3b82f6',
    }));

    const recentWins = wins.map((w) => ({
      id: w.id,
      prize: { name: w.description.replace('Won ', '').replace(' on Lucky Spin Wheel', '') },
      reward_earned: parseFloat(w.amount || 0),
      created_at: w.created_at,
    }));

    const earnedSpinsHistory = earned.map((s) => ({
      id: s.id,
      description: s.description || 'Earned +1 Lucky Free Spin',
      amount: 1,
      created_at: s.created_at,
    }));

    return res.json({
      success: true,
      freeSpins: userFreeSpins,
      prizes: formattedPrizes,
      recentWins,
      earnedSpinsHistory,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch spin info', error: err.message });
  }
};

export const spinUserWheel = async (req, res) => {
  try {
    const featureToggle = await prisma.system_feature_toggles.findUnique({ where: { key: 'spinWheel' } });
    if (featureToggle && !featureToggle.is_enabled) {
      return res.status(403).json({ success: false, message: 'Lucky Spin Wheel is currently disabled by the administration.' });
    }

    const userId = req.user.id;
    const dbUser = await prisma.users.findUnique({ where: { id: userId } });
    if (!dbUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentFreeSpins = dbUser.free_spins || 0;
    if (currentFreeSpins <= 0) {
      return res.status(400).json({
        success: false,
        message: 'You have 0 free spins left. Earn free spins by inviting friends to register on the platform!',
      });
    }

    let prizes = await prisma.spin_prizes.findMany({ where: { is_active: true }, orderBy: { created_at: 'asc' } });
    if (prizes.length === 0) {
      await seedDefaultSpinPrizes();
      prizes = await prisma.spin_prizes.findMany({ where: { is_active: true }, orderBy: { created_at: 'asc' } });
    }

    const newFreeSpins = currentFreeSpins - 1;

    // Weighted random selection based on slice probability
    const totalWeight = prizes.reduce((acc, p) => acc + (parseFloat(p.probability) || 1), 0);
    let randomWeight = Math.random() * totalWeight;
    let randomIndex = 0;
    for (let i = 0; i < prizes.length; i++) {
      const prob = parseFloat(prizes[i].probability) || 1;
      if (randomWeight < prob) {
        randomIndex = i;
        break;
      }
      randomWeight -= prob;
    }

    const winningPrize = prizes[randomIndex] || prizes[0];
    const winAmount = parseFloat(winningPrize.value || 0);
    const isWin = winAmount > 0;

    const oldBal = parseFloat(dbUser.balance || 0);
    const oldEarned = parseFloat(dbUser.total_earned || 0);
    const newBal = isWin ? oldBal + winAmount : oldBal;
    const newEarned = isWin ? oldEarned + winAmount : oldEarned;

    const txns = [];
    if (isWin) {
      txns.push(
        prisma.transactions.create({
          data: {
            user_id: userId,
            type: 'SPIN_WIN',
            amount: winAmount,
            balance_before: oldBal,
            balance_after: newBal,
            description: `Won ${winningPrize.label} on Lucky Spin Wheel`,
          },
        })
      );
      txns.push(
        prisma.user_spin_logs.create({
          data: {
            user_id: userId,
            prize_label: winningPrize.label,
            prize_value: winAmount,
          },
        })
      );
    }

    await prisma.$transaction([
      prisma.users.update({
        where: { id: userId },
        data: {
          balance: newBal,
          total_earned: newEarned,
          free_spins: newFreeSpins,
        },
      }),
      ...txns,
    ]);

    return res.json({
      success: true,
      winningIndex: randomIndex,
      prize: {
        id: winningPrize.id,
        label: winningPrize.label,
        amount: winAmount,
        color: winningPrize.color,
      },
      isWin,
      amount: winAmount,
      message: isWin
        ? `Congratulations! You won ${winningPrize.label}!`
        : 'Better luck next time!',
      freeSpinsRemaining: newFreeSpins,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to spin wheel', error: err.message });
  }
};
