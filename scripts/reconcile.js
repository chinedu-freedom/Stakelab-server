import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function reconcileUserBalances() {
  try {
    console.log('Starting user balance reconciliation...');
    const users = await prisma.users.findMany({
      include: {
        transactions: true,
        withdrawals: true,
        stakes: true,
      }
    });

    console.log(`Found ${users.length} users to check.`);

    let updatedCount = 0;

    for (const user of users) {
      const currentStakedBal = parseFloat(user.staked_balance || 0);
      const currentTotalEarned = parseFloat(user.total_earned || 0);

      // 1. Calculate total earned from STAKE_PROFIT transactions
      const stakeProfitTx = user.transactions.filter(t => t.type === 'STAKE_PROFIT');
      const actualTotalYield = stakeProfitTx.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

      // 2. Calculate deductions from Profit Wallet
      const stakePurchasesFromProfit = user.transactions
        .filter(t => t.type === 'STAKE' && t.description.toLowerCase().includes('profit wallet'))
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

      const profitWithdrawals = user.transactions
        .filter(t => t.type === 'WITHDRAWAL' && t.description.toLowerCase().includes('profit'))
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

      const adminProfitAdds = user.transactions
        .filter(t => t.type === 'ADMIN_ADDITION' && t.description.toLowerCase().includes('profit'))
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

      const adminProfitDeducts = user.transactions
        .filter(t => t.type === 'ADMIN_DEDUCTION' && t.description.toLowerCase().includes('profit'))
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

      const expectedStakedBal = actualTotalYield + adminProfitAdds - stakePurchasesFromProfit - profitWithdrawals - adminProfitDeducts;
      const expectedTotalEarned = actualTotalYield;

      console.log(`\nUser: ${user.email} (${user.id})`);
      console.log(`  Current Staked Bal: ${currentStakedBal}, Expected: ${expectedStakedBal}`);
      console.log(`  Current Total Earned: ${currentTotalEarned}, Expected: ${expectedTotalEarned}`);
      console.log(`  Stake Profits logged count: ${stakeProfitTx.length}, sum: ${actualTotalYield}`);

      if (expectedStakedBal > currentStakedBal || expectedTotalEarned > currentTotalEarned) {
        const finalStakedBal = Math.max(currentStakedBal, expectedStakedBal);
        const finalTotalEarned = Math.max(currentTotalEarned, expectedTotalEarned);

        console.log(`  UPDATE NEEDED -> New Staked Bal: ${finalStakedBal}, New Total Earned: ${finalTotalEarned}`);
        
        await prisma.users.update({
          where: { id: user.id },
          data: {
            staked_balance: finalStakedBal,
            total_earned: finalTotalEarned,
          }
        });
        updatedCount++;
      } else {
        console.log(`  Balance OK.`);
      }
    }

    console.log(`\nReconciliation finished! Updated ${updatedCount} users.`);
  } catch (err) {
    console.error('Error during reconciliation:', err);
  } finally {
    await prisma.$disconnect();
  }
}

reconcileUserBalances();
