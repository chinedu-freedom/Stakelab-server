import { prisma } from './config/db.js';

export const seedDefaultStakingPlans = async () => {
  try {
    const existingCount = await prisma.staking_plans.count();
    if (existingCount === 0) {
      console.log('🌱 Seeding default staking plans...');
      await prisma.staking_plans.createMany({
        data: [
          {
            title: 'KRYPTEX-BASIC POOL',
            badge: 'BASIC',
            tier: 'Flexible Tier',
            min_amount: 30,
            max_amount: 9999,
            apy_percent: 225.0,
            daily_return_percent: 7.5,
            duration_days: 20,
            capital_return: true,
            is_active: true,
            sort_order: 1,
          },
          {
            title: 'KRYPTEX-PRO POOL',
            badge: 'POPULAR',
            tier: 'Flexible Tier',
            min_amount: 100,
            max_amount: 25000,
            apy_percent: 375.0,
            daily_return_percent: 12.5,
            duration_days: 30,
            capital_return: true,
            is_active: true,
            sort_order: 2,
          },
          {
            title: 'KRYPTEX-VIP POOL',
            badge: 'VIP',
            tier: 'Flexible Tier',
            min_amount: 500,
            max_amount: 100000,
            apy_percent: 540.0,
            daily_return_percent: 18.0,
            duration_days: 45,
            capital_return: true,
            is_active: true,
            sort_order: 3,
          },
          {
            title: 'DYNAMIC QUANT-ALPHA POOL',
            badge: 'QUANT',
            tier: 'Dynamic Tier',
            min_amount: 100,
            max_amount: 50000,
            apy_percent: 210.0,
            daily_return_percent: 15.0,
            duration_days: 14,
            capital_return: true,
            is_active: true,
            sort_order: 4,
          },
          {
            title: 'DYNAMIC APEX YIELD POOL',
            badge: 'HIGH RETURN',
            tier: 'Dynamic Tier',
            min_amount: 500,
            max_amount: 100000,
            apy_percent: 472.5,
            daily_return_percent: 22.5,
            duration_days: 21,
            capital_return: true,
            is_active: true,
            sort_order: 5,
          },
          {
            title: 'DYNAMIC INSTITUTIONAL POOL',
            badge: 'INSTITUTIONAL',
            tier: 'Dynamic Tier',
            min_amount: 1000,
            max_amount: 500000,
            apy_percent: 900.0,
            daily_return_percent: 30.0,
            duration_days: 30,
            capital_return: true,
            is_active: true,
            sort_order: 6,
          },
        ],
      });
      console.log('✅ Default staking plans seeded successfully!');
    }
  } catch (err) {
    console.error('⚠️ Staking plans seeding error:', err.message);
  }
};

export const cleanupDuplicateStakingPlans = async () => {
  try {
    const plans = await prisma.staking_plans.findMany({
      orderBy: { created_at: 'asc' },
    });

    const seenTitles = new Set();
    const duplicateIdsToDelete = [];

    for (const p of plans) {
      const normalizedTitle = p.title.trim().toLowerCase();
      if (seenTitles.has(normalizedTitle)) {
        duplicateIdsToDelete.push(p.id);
      } else {
        seenTitles.add(normalizedTitle);
      }
    }

    if (duplicateIdsToDelete.length > 0) {
      console.log(`🧹 Removing ${duplicateIdsToDelete.length} duplicate staking plan records...`);
      await prisma.staking_plans.deleteMany({
        where: { id: { in: duplicateIdsToDelete } },
      });
      console.log('✅ Duplicate staking plans cleaned up!');
    }
  } catch (err) {
    console.error('⚠️ Error cleaning up duplicate staking plans:', err.message);
  }
};
