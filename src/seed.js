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
            min_amount: 30,
            max_amount: 9999,
            daily_return_percent: 7.5,
            duration_days: 20,
            capital_return: true,
            is_active: true,
            sort_order: 1,
          },
          {
            title: 'KRYPTEX-PRO POOL',
            badge: 'POPULAR',
            min_amount: 100,
            max_amount: 25000,
            daily_return_percent: 12.5,
            duration_days: 30,
            capital_return: true,
            is_active: true,
            sort_order: 2,
          },
          {
            title: 'KRYPTEX-VIP POOL',
            badge: 'VIP',
            min_amount: 500,
            max_amount: 100000,
            daily_return_percent: 18.0,
            duration_days: 45,
            capital_return: true,
            is_active: true,
            sort_order: 3,
          },
        ],
      });
      console.log('✅ Default staking plans seeded successfully!');
    }
  } catch (err) {
    console.error('⚠️ Staking plans seeding error:', err.message);
  }
};
