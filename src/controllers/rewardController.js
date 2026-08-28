// Reward & Gamification Suite Controllers for EverStake
import { prisma } from '../config/db.js';

let giftCodesStore = [
  {
    id: 'gc-1',
    code_name: 'Bonus Code',
    code: '9A0DDI5D',
    amount: 8.0,
    max_uses: 500,
    used_count: 276,
    status: 'ACTIVE',
    expire_at: '2026-12-31T23:59:59Z',
    created_at: new Date().toISOString(),
  },
  {
    id: 'gc-2',
    code_name: 'Bonus Code',
    code: '4WWNUF1E',
    amount: 2.0,
    max_uses: 20,
    used_count: 6,
    status: 'ACTIVE',
    expire_at: '2026-12-31T23:59:59Z',
    created_at: new Date().toISOString(),
  },
];

let giftCodeClaimsStore = [
  {
    id: 'claim-1',
    code: '9A0DDI5D',
    user_name: 'John Doe',
    user_email: 'john@example.com',
    amount: 8.0,
    claimed_at: new Date().toISOString(),
  },
  {
    id: 'claim-2',
    code: '4WWNUF1E',
    user_name: 'Alice Smith',
    user_email: 'alice@example.com',
    amount: 2.0,
    claimed_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

let tasksStore = [
  {
    id: 'task-1',
    title: 'Invitation task reward',
    description: 'Invitation task reward',
    invites_required: 100,
    reward_amount: 50.0,
    target_url: '#',
    task_type: 'INVITATION',
    status: 'ACTIVE',
    claims_count: 12,
    created_at: new Date().toISOString(),
  },
  {
    id: 'task-2',
    title: 'Invitation task reward',
    description: 'Invitation task reward',
    invites_required: 55,
    reward_amount: 30.0,
    target_url: '#',
    task_type: 'INVITATION',
    status: 'ACTIVE',
    claims_count: 18,
    created_at: new Date().toISOString(),
  },
  {
    id: 'task-3',
    title: 'Invitation task reward',
    description: 'Invitation task reward',
    invites_required: 45,
    reward_amount: 20.0,
    target_url: '#',
    task_type: 'INVITATION',
    status: 'ACTIVE',
    claims_count: 24,
    created_at: new Date().toISOString(),
  },
  {
    id: 'task-4',
    title: 'Invitation task reward',
    description: 'Invitation task reward',
    invites_required: 35,
    reward_amount: 15.0,
    target_url: '#',
    task_type: 'INVITATION',
    status: 'ACTIVE',
    claims_count: 31,
    created_at: new Date().toISOString(),
  },
  {
    id: 'task-5',
    title: 'Invitation task reward',
    description: 'Invitation task reward',
    invites_required: 25,
    reward_amount: 10.0,
    target_url: '#',
    task_type: 'INVITATION',
    status: 'ACTIVE',
    claims_count: 45,
    created_at: new Date().toISOString(),
  },
  {
    id: 'task-6',
    title: 'Invitation task reward',
    description: 'Invitation task reward',
    invites_required: 15,
    reward_amount: 5.0,
    target_url: '#',
    task_type: 'INVITATION',
    status: 'ACTIVE',
    claims_count: 62,
    created_at: new Date().toISOString(),
  },
];

let dailyCheckinsStore = [
  { id: 'chk-1', day_number: 1, reward_amount: 0.1, description: 'Day 1 reward', is_enabled: true },
  { id: 'chk-2', day_number: 2, reward_amount: 0.2, description: 'Day 2 reward', is_enabled: true },
  { id: 'chk-3', day_number: 3, reward_amount: 0.02, description: 'Day 3 reward', is_enabled: true },
  { id: 'chk-4', day_number: 4, reward_amount: 0.1, description: 'Day 4 reward', is_enabled: true },
  { id: 'chk-5', day_number: 5, reward_amount: 0.3, description: 'Day 5 reward', is_enabled: true },
  { id: 'chk-6', day_number: 6, reward_amount: 0.4, description: 'Day 6 reward', is_enabled: true },
  { id: 'chk-7', day_number: 7, reward_amount: 0.5, description: 'Day 7 FINAL REWARD', is_enabled: true, is_final: true },
];

let spinSettingsStore = {
  feature_enabled: true,
  cost_per_spin: 5,
  free_spins_per_deposit: 1,
  daily_referral_target: 2,
  spins_for_daily_challenge: 1,
  free_spins_daily: 1,
  total_spins_used: 342,
  total_rewards_earned: 1280.5,
  free_spins_used: 210,
};

let spinPrizesStore = [
  { id: 'prize-1', position: 1, label: '$0.50', prize_type: 'CASH', amount: 0.5, probability: 20, color: '#3b82f6' },
  { id: 'prize-2', position: 2, label: '$2.50', prize_type: 'CASH', amount: 2.5, probability: 15, color: '#10b981' },
  { id: 'prize-3', position: 3, label: '$0.20', prize_type: 'CASH', amount: 0.2, probability: 25, color: '#64748b' },
  { id: 'prize-4', position: 4, label: '$10.50', prize_type: 'CASH', amount: 10.5, probability: 10, color: '#8b5cf6' },
  { id: 'prize-5', position: 5, label: '$0.77', prize_type: 'CASH', amount: 0.77, probability: 15, color: '#ff0044' },
  { id: 'prize-6', position: 6, label: '$15.15', prize_type: 'CASH', amount: 15.15, probability: 8, color: '#f59e0b' },
  { id: 'prize-7', position: 7, label: '$1.25', prize_type: 'CASH', amount: 1.25, probability: 5, color: '#ec4899' },
  { id: 'prize-8', position: 8, label: '$20.20', prize_type: 'CASH', amount: 20.2, probability: 2, color: '#fe780b' },
];

// --- Gift Codes Controllers ---
export const getGiftCodes = async (req, res) => {
  return res.json({ success: true, codes: giftCodesStore });
};

export const createGiftCode = async (req, res) => {
  try {
    const { code, amount, max_uses, expire_at } = req.body;
    if (!code || !amount) {
      return res.status(400).json({ success: false, message: 'Code and amount are required' });
    }
    const newCode = {
      id: `gc-${Date.now()}`,
      code: String(code).toUpperCase().trim(),
      amount: parseFloat(amount),
      max_uses: parseInt(max_uses) || 100,
      used_count: 0,
      status: 'ACTIVE',
      expire_at: expire_at || '2026-12-31T23:59:59Z',
      created_at: new Date().toISOString(),
    };
    giftCodesStore.unshift(newCode);
    return res.status(201).json({ success: true, message: 'Gift code created successfully!', code: newCode });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create gift code', error: err.message });
  }
};

export const updateGiftCode = async (req, res) => {
  try {
    const { id } = req.params;
    const index = giftCodesStore.findIndex((c) => c.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Gift code not found' });
    }
    giftCodesStore[index] = { ...giftCodesStore[index], ...req.body };
    return res.json({ success: true, message: 'Gift code updated successfully!', code: giftCodesStore[index] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update gift code', error: err.message });
  }
};

export const deleteGiftCode = async (req, res) => {
  try {
    const { id } = req.params;
    giftCodesStore = giftCodesStore.filter((c) => c.id !== id);
    return res.json({ success: true, message: 'Gift code deleted successfully!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete gift code', error: err.message });
  }
};

export const getGiftCodeClaims = async (req, res) => {
  return res.json({ success: true, claims: giftCodeClaimsStore });
};

export const getUserGiftCodeClaims = async (req, res) => {
  return res.json({ success: true, claims: giftCodeClaimsStore });
};

export const claimGiftCode = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Please enter a gift code.' });
    }

    const cleanCode = String(code).trim().toUpperCase();
    const foundCode = giftCodesStore.find((c) => c.code.toUpperCase() === cleanCode);

    if (!foundCode) {
      return res.status(404).json({ success: false, message: 'Invalid gift code. Please check and try again.' });
    }

    if (foundCode.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'This gift code is no longer active.' });
    }

    if (foundCode.used_count >= foundCode.max_uses) {
      return res.status(400).json({ success: false, message: 'This gift code has reached its maximum usage limit.' });
    }

    if (foundCode.expire_at && new Date(foundCode.expire_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'This gift code has expired.' });
    }

    // Record claim
    foundCode.used_count += 1;
    const newClaim = {
      id: `claim-${Date.now()}`,
      code: foundCode.code,
      user_name: req.user?.full_name || req.user?.email || 'Valued User',
      user_email: req.user?.email || 'user@example.com',
      amount: foundCode.amount,
      claimed_at: new Date().toISOString(),
    };
    giftCodeClaimsStore.unshift(newClaim);

    return res.json({
      success: true,
      message: `Congratulations! You received $${parseFloat(foundCode.amount).toFixed(2)} bonus!`,
      amount: foundCode.amount,
      claim: newClaim,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to claim gift code', error: err.message });
  }
};

// --- Tasks Controllers ---
export const getTasks = async (req, res) => {
  return res.json({ success: true, tasks: tasksStore });
};

export const createTask = async (req, res) => {
  try {
    const { title, description, reward_amount, target_url, task_type } = req.body;
    if (!title || !reward_amount) {
      return res.status(400).json({ success: false, message: 'Title and reward amount are required' });
    }
    const newTask = {
      id: `task-${Date.now()}`,
      title,
      description: description || '',
      reward_amount: parseFloat(reward_amount),
      target_url: target_url || '#',
      task_type: task_type || 'GENERAL',
      status: 'ACTIVE',
      claims_count: 0,
      created_at: new Date().toISOString(),
    };
    tasksStore.unshift(newTask);
    return res.status(201).json({ success: true, message: 'Task created successfully!', task: newTask });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create task', error: err.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const index = tasksStore.findIndex((t) => t.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    tasksStore[index] = { ...tasksStore[index], ...req.body };
    return res.json({ success: true, message: 'Task updated successfully!', task: tasksStore[index] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update task', error: err.message });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    tasksStore = tasksStore.filter((t) => t.id !== id);
    return res.json({ success: true, message: 'Task deleted successfully!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete task', error: err.message });
  }
};

// --- Daily Check-Ins Controllers ---
export const getCheckIns = async (req, res) => {
  return res.json({ success: true, checkins: dailyCheckinsStore });
};

export const updateCheckInsBulk = async (req, res) => {
  try {
    const { checkins } = req.body;
    if (Array.isArray(checkins)) {
      dailyCheckinsStore = checkins;
    }
    return res.json({ success: true, message: 'Daily check-in streak rewards updated successfully!', checkins: dailyCheckinsStore });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update check-ins', error: err.message });
  }
};

let userCheckinState = {
  currentStreak: 1,
  lastClaimDate: null,
};

export const getUserDailyCheckinStatus = async (req, res) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const isClaimedToday = userCheckinState.lastClaimDate === todayStr;

  const rewards = dailyCheckinsStore.map((item) => {
    let status = 'locked';
    if (item.day_number < userCheckinState.currentStreak) {
      status = 'claimed';
    } else if (item.day_number === userCheckinState.currentStreak) {
      status = isClaimedToday ? 'claimed' : 'available';
    }
    return {
      day: item.day_number,
      amount: item.reward_amount,
      description: item.description,
      status,
    };
  });

  return res.json({
    success: true,
    enabled: true,
    currentStreak: userCheckinState.currentStreak,
    claimedToday: isClaimedToday,
    maxDays: 7,
    rewards,
  });
};

export const claimUserDailyCheckin = async (req, res) => {
  try {
    const userId = req.user?.id;
    const todayStr = new Date().toISOString().split('T')[0];
    if (userCheckinState.lastClaimDate === todayStr) {
      return res.status(400).json({ success: false, message: "You have already claimed today's daily reward. Please check back tomorrow!" });
    }

    const currentRewardObj = dailyCheckinsStore.find((item) => item.day_number === userCheckinState.currentStreak) || dailyCheckinsStore[0];
    const rewardAmount = parseFloat(currentRewardObj.reward_amount) || 0.1;

    userCheckinState.lastClaimDate = todayStr;
    const claimedDay = userCheckinState.currentStreak;

    if (userCheckinState.currentStreak >= 7) {
      userCheckinState.currentStreak = 1;
    } else {
      userCheckinState.currentStreak += 1;
    }

    if (userId) {
      const dbUser = await prisma.users.findUnique({ where: { id: userId } });
      if (dbUser) {
        const oldBal = parseFloat(dbUser.balance || 0);
        const newBal = oldBal + rewardAmount;
        await prisma.$transaction([
          prisma.users.update({
            where: { id: userId },
            data: { balance: newBal },
          }),
          prisma.transactions.create({
            data: {
              user_id: userId,
              trx: `TRX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
              amount: rewardAmount,
              charge: 0,
              post_balance: newBal,
              type: '+',
              trx_type: '+',
              details: `Daily Check-In Reward (Day ${claimedDay})`,
              remark: 'Daily Check-In',
              created_at: new Date(),
            },
          }),
        ]);
      }
    }

    return res.json({
      success: true,
      message: `Day ${claimedDay} reward of $${rewardAmount.toFixed(2)} claimed successfully and credited to your balance!`,
      amount: rewardAmount,
      claimedDay,
      nextStreakDay: userCheckinState.currentStreak,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to claim daily check-in', error: err.message });
  }
};

// --- Spin Wheel Controllers ---
export const getSpinPrizes = async (req, res) => {
  return res.json({ success: true, prizes: spinPrizesStore });
};

export const createSpinPrize = async (req, res) => {
  try {
    if (spinPrizesStore.length >= 8) {
      return res.status(400).json({ success: false, message: 'Maximum of 8 spin prize slices reached' });
    }
    const newPrize = {
      id: `prize-${Date.now()}`,
      position: spinPrizesStore.length + 1,
      label: req.body.label || 'Reward',
      prize_type: req.body.prize_type || 'CASH',
      amount: parseFloat(req.body.amount) || 0,
      probability: parseInt(req.body.probability) || 10,
      color: req.body.color || '#3b82f6',
    };
    spinPrizesStore.push(newPrize);
    return res.status(201).json({ success: true, message: 'Spin prize slice added successfully!', prize: newPrize });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create spin prize', error: err.message });
  }
};

export const updateSpinPrize = async (req, res) => {
  try {
    const { id } = req.params;
    const index = spinPrizesStore.findIndex((p) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Spin prize not found' });
    }
    spinPrizesStore[index] = { ...spinPrizesStore[index], ...req.body };
    return res.json({ success: true, message: 'Spin prize updated successfully!', prize: spinPrizesStore[index] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update spin prize', error: err.message });
  }
};

export const deleteSpinPrize = async (req, res) => {
  try {
    const { id } = req.params;
    spinPrizesStore = spinPrizesStore.filter((p) => p.id !== id);
    return res.json({ success: true, message: 'Spin prize deleted successfully!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete spin prize', error: err.message });
  }
};

export const getSpinSettings = async (req, res) => {
  return res.json({ success: true, settings: spinSettingsStore });
};

export const updateSpinSettings = async (req, res) => {
  try {
    spinSettingsStore = { ...spinSettingsStore, ...req.body };
    return res.json({ success: true, message: 'Spin wheel settings updated successfully!', settings: spinSettingsStore });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update spin settings', error: err.message });
  }
};

// --- System Feature Toggles & User Endpoints ---
let systemFeaturesStore = {
  giftBonus: true,
  tasks: true,
  dailyCheckin: true,
  spinWheel: true,
};

let userTasksClaimsStore = [];
let userRecentSpinWins = [
  {
    id: 'win-1',
    prize: { name: '$2.50' },
    reward_earned: 2.5,
    spin_type: 'free',
    created_at: new Date().toISOString(),
  },
  {
    id: 'win-2',
    prize: { name: '$0.50' },
    reward_earned: 0.5,
    spin_type: 'paid',
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
];
let userFreeSpinsCount = 2;

export const getSystemFeatures = async (req, res) => {
  return res.json({ success: true, features: systemFeaturesStore });
};

export const updateSystemFeatures = async (req, res) => {
  try {
    systemFeaturesStore = { ...systemFeaturesStore, ...req.body };
    return res.json({ success: true, message: 'System feature toggles updated successfully!', features: systemFeaturesStore });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update system features', error: err.message });
  }
};

export const getUserTasks = async (req, res) => {
  const userEmail = req.user?.email || 'user@example.com';
  const todayReferralsCount = 35;

  const tasksWithStatus = tasksStore.map((t) => {
    const isClaimed = userTasksClaimsStore.some((c) => c.taskId === t.id && c.userEmail === userEmail);
    const requiredReferrals = t.invites_required || 15;
    const progress = Math.min(todayReferralsCount, requiredReferrals);
    const isReady = todayReferralsCount >= requiredReferrals && !isClaimed;

    return {
      id: t.id,
      task_name: t.title,
      description: t.description,
      reward_amount: t.reward_amount,
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
};

export const claimUserTask = async (req, res) => {
  try {
    const { taskId } = req.body;
    const userId = req.user?.id;
    const userEmail = req.user?.email || 'user@example.com';

    const taskObj = tasksStore.find((t) => t.id === taskId);
    if (!taskObj) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const alreadyClaimed = userTasksClaimsStore.some((c) => c.taskId === taskId && c.userEmail === userEmail);
    if (alreadyClaimed) {
      return res.status(400).json({ success: false, message: 'You have already claimed this task reward.' });
    }

    const rewardAmount = parseFloat(taskObj.reward_amount || 0);

    userTasksClaimsStore.push({
      taskId,
      userEmail,
      claimedAt: new Date().toISOString(),
    });
    taskObj.claims_count = (taskObj.claims_count || 0) + 1;

    if (userId) {
      const dbUser = await prisma.users.findUnique({ where: { id: userId } });
      if (dbUser) {
        const oldBal = parseFloat(dbUser.balance || 0);
        const newBal = oldBal + rewardAmount;
        await prisma.$transaction([
          prisma.users.update({
            where: { id: userId },
            data: { balance: newBal },
          }),
          prisma.transactions.create({
            data: {
              user_id: userId,
              trx: `TRX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
              amount: rewardAmount,
              charge: 0,
              post_balance: newBal,
              type: '+',
              trx_type: '+',
              details: `Claimed Task: ${taskObj.title || taskObj.task_name || 'Task Reward'}`,
              remark: 'Task Reward',
              created_at: new Date(),
            },
          }),
        ]);
      }
    }

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
  return res.json({
    success: true,
    freeSpins: userFreeSpinsCount,
    costPerSpin: spinSettingsStore.cost_per_spin || 5,
    prizes: spinPrizesStore,
    recentWins: userRecentSpinWins,
  });
};

export const spinUserWheel = async (req, res) => {
  try {
    const userId = req.user?.id;
    const costPerSpin = parseFloat(spinSettingsStore.cost_per_spin || 5);
    let isFree = false;

    if (userFreeSpinsCount > 0) {
      userFreeSpinsCount -= 1;
      isFree = true;
    }

    if (userId && !isFree) {
      const dbUser = await prisma.users.findUnique({ where: { id: userId } });
      if (!dbUser || parseFloat(dbUser.balance || 0) < costPerSpin) {
        return res.status(400).json({ success: false, message: `Insufficient balance to spin wheel. Each spin costs $${costPerSpin.toFixed(2)}.` });
      }
    }

    const randomIndex = Math.floor(Math.random() * spinPrizesStore.length);
    const winningPrize = spinPrizesStore[randomIndex] || spinPrizesStore[0];
    const isWin = winningPrize.amount > 0;
    const winAmount = parseFloat(winningPrize.amount || 0);

    const newWin = {
      id: `win-${Date.now()}`,
      prize: { name: winningPrize.label },
      reward_earned: winAmount,
      spin_type: isFree ? 'free' : 'paid',
      created_at: new Date().toISOString(),
    };
    userRecentSpinWins.unshift(newWin);

    spinSettingsStore.total_spins_used += 1;
    if (isWin) {
      spinSettingsStore.total_rewards_earned += winAmount;
    }

    if (userId) {
      const dbUser = await prisma.users.findUnique({ where: { id: userId } });
      if (dbUser) {
        const oldBal = parseFloat(dbUser.balance || 0);
        let newBal = oldBal;
        if (!isFree) newBal -= costPerSpin;
        if (isWin) newBal += winAmount;

        const txns = [];
        if (!isFree) {
          txns.push(
            prisma.transactions.create({
              data: {
                user_id: userId,
                trx: `TRX-${Date.now()}-SPIN`,
                amount: costPerSpin,
                charge: 0,
                post_balance: oldBal - costPerSpin,
                type: '-',
                trx_type: '-',
                details: 'Paid Lucky Spin Wheel Entry',
                remark: 'Spin Wheel',
                created_at: new Date(),
              },
            })
          );
        }
        if (isWin) {
          txns.push(
            prisma.transactions.create({
              data: {
                user_id: userId,
                trx: `TRX-${Date.now()}-WIN`,
                amount: winAmount,
                charge: 0,
                post_balance: newBal,
                type: '+',
                trx_type: '+',
                details: `Won ${winningPrize.label} on Lucky Spin Wheel`,
                remark: 'Spin Win',
                created_at: new Date(),
              },
            })
          );
        }

        await prisma.$transaction([
          prisma.users.update({
            where: { id: userId },
            data: { balance: newBal },
          }),
          ...txns,
        ]);
      }
    }

    return res.json({
      success: true,
      winningIndex: randomIndex,
      prize: winningPrize,
      isWin,
      amount: winAmount,
      message: isWin
        ? `Congratulations! You won ${winningPrize.label}!`
        : 'Better luck next time!',
      freeSpinsRemaining: userFreeSpinsCount,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to spin wheel', error: err.message });
  }
};
