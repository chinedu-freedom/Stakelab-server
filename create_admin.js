import bcrypt from 'bcryptjs';
import { prisma } from './src/config/db.js';

async function main() {
  const email = 'admin@everstake.cx';
  const plainPassword = 'EverStake.cx2$';
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const admin = await prisma.admins.upsert({
    where: { email },
    update: {
      password_hash: passwordHash,
      username: 'EverStake Admin',
      role: 'admin',
    },
    create: {
      email,
      password_hash: passwordHash,
      username: 'EverStake Admin',
      role: 'admin',
    },
  });

  console.log('Admin account created/updated successfully:');
  console.log('ID:', admin.id);
  console.log('Email:', admin.email);
  console.log('Username:', admin.username);
  console.log('Role:', admin.role);
}

main()
  .catch((err) => {
    console.error('Error creating admin:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
