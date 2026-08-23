import bcrypt from 'bcryptjs';
import { prisma } from './config/db.js';

async function seed() {
  console.log('🌱 Seeding Stakelab Database...');

  // Seed Admin
  const adminPassword = await bcrypt.hash('admin123456', 10);
  const admin = await prisma.admins.upsert({
    where: { email: 'admin@everstake.cx' },
    update: {},
    create: {
      email: 'admin@everstake.cx',
      password_hash: adminPassword,
      username: 'admin',
      role: 'admin',
    },
  });
  console.log('✅ Default Admin created: admin@everstake.cx / admin123456');

  // Seed Default Settings
  await prisma.settings.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      site_name: 'EverStake',
      site_title: 'EverStake - Premier Crypto Staking & Yield Protocol',
      min_deposit: 10,
      max_deposit: 100000,
      min_withdrawal: 10,
      max_withdrawal: 10000,
      withdrawal_charge: 1.0,
      referral_commission: 5.0,
    },
  });
  console.log('✅ Platform Settings initialized');

  // Seed Email Settings
  await prisma.email_settings.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      smtp_host: 'smtp.gmail.com',
      smtp_port: 587,
      smtp_user: '',
      smtp_pass: '',
      from_email: 'noreply@everstake.cx',
      from_name: 'EverStake',
    },
  });
  console.log('✅ Email Settings initialized');

  // Seed Staking Plans
  const plans = [
    {
      title: 'Flexi Starter',
      badge: 'STARTER',
      min_amount: 10,
      max_amount: 500,
      apy_percent: 18.25,
      daily_return_percent: 0.05,
      duration_days: 7,
      capital_return: true,
      sort_order: 1,
    },
    {
      title: 'Yield Booster',
      badge: 'POPULAR',
      min_amount: 500,
      max_amount: 5000,
      apy_percent: 36.5,
      daily_return_percent: 0.1,
      duration_days: 30,
      capital_return: true,
      sort_order: 2,
    },
    {
      title: 'Vault Pro',
      badge: 'HIGH YIELD',
      min_amount: 5000,
      max_amount: 25000,
      apy_percent: 73.0,
      daily_return_percent: 0.2,
      duration_days: 90,
      capital_return: true,
      sort_order: 3,
    },
    {
      title: 'Master Staker VIP',
      badge: 'MAX RETURNS',
      min_amount: 25000,
      max_amount: 500000,
      apy_percent: 146.0,
      daily_return_percent: 0.4,
      duration_days: 180,
      capital_return: true,
      sort_order: 4,
    },
  ];

  for (const plan of plans) {
    await prisma.staking_plans.create({ data: plan });
  }
  console.log('✅ Staking Plans created');

  // Seed Payout Cryptocurrencies
  const cryptos = [
    { name: 'Tether USD (BEP20)', symbol: 'USDT', network: 'BEP20', wallet_address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' },
    { name: 'Tether USD (TRC20)', symbol: 'USDT', network: 'TRC20', wallet_address: 'TYD2v7s8M2yS1x7pL9q3W4e5r6t7y8u9i0' },
    { name: 'Bitcoin', symbol: 'BTC', network: 'Bitcoin', wallet_address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
    { name: 'Ethereum', symbol: 'ETH', network: 'ERC20', wallet_address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' },
  ];

  for (const crypto of cryptos) {
    await prisma.payout_cryptocurrencies.upsert({
      where: { symbol_network: { symbol: crypto.symbol, network: crypto.network } },
      update: { wallet_address: crypto.wallet_address },
      create: crypto,
    });
  }
  console.log('✅ Cryptocurrencies initialized');

  console.log('🎉 Seeding complete!');
}

seed()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
