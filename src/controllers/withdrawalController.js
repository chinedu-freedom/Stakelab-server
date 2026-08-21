import { prisma } from '../config/db.js';
import { sendEmail } from '../services/emailService.js';

export const createWithdrawal = async (req, res) => {
  try {
    const { amount, withdrawal_method, wallet_address, withdrawal_pin } = req.body;
    const userId = req.user.id;

    if (!amount || parseFloat(amount) <= 0 || !withdrawal_method || !wallet_address) {
      return res.status(400).json({ success: false, message: 'Amount, method, and wallet address are required' });
    }

    const withdrawAmount = parseFloat(amount);
    const user = await prisma.users.findUnique({ where: { id: userId } });

    if (user.withdrawal_pin && user.withdrawal_pin !== withdrawal_pin) {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal PIN' });
    }

    if (parseFloat(user.balance) < withdrawAmount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    const settings = (await prisma.settings.findFirst()) || { min_withdrawal: 10, withdrawal_charge: 1 };
    if (withdrawAmount < parseFloat(settings.min_withdrawal)) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is $${settings.min_withdrawal}`,
      });
    }

    const fee = (withdrawAmount * parseFloat(settings.withdrawal_charge)) / 100;
    const netAmount = withdrawAmount - fee;
    const newBalance = parseFloat(user.balance) - withdrawAmount;

    const [withdrawal, updatedUser] = await prisma.$transaction([
      prisma.withdrawals.create({
        data: {
          user_id: userId,
          amount: withdrawAmount,
          withdrawal_method,
          fees: fee,
          net_amount: netAmount,
          wallet_address,
          status: 'PENDING',
        },
      }),
      prisma.users.update({
        where: { id: userId },
        data: { balance: newBalance },
      }),
      prisma.transactions.create({
        data: {
          user_id: userId,
          type: 'WITHDRAWAL',
          amount: withdrawAmount,
          balance_before: user.balance,
          balance_after: newBalance,
          description: `Withdrawal request of $${withdrawAmount} to ${wallet_address}`,
        },
      }),
    ]);

    sendEmail({
      to: user.email,
      subject: 'Withdrawal Requested - Stakelab',
      html: `<h3>Withdrawal Requested</h3><p>Your withdrawal of $${withdrawAmount} (Net: $${netAmount}) is being processed.</p>`,
      emailType: 'WITHDRAWAL_PROCESSING',
      userId,
    });

    return res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted',
      withdrawal,
      balance: updatedUser.balance,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create withdrawal', error: error.message });
  }
};

export const getUserWithdrawals = async (req, res) => {
  try {
    const withdrawals = await prisma.withdrawals.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: 'desc' },
    });
    return res.json({ success: true, withdrawals });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch withdrawals', error: error.message });
  }
};

export const addOrUpdateUserWallet = async (req, res) => {
  try {
    const { symbol, network, address, label, withdrawal_pin } = req.body;
    const userId = req.user.id;

    if (!symbol || !network || !address) {
      return res.status(400).json({ success: false, message: 'Symbol, network, and wallet address are required' });
    }

    const user = await prisma.users.findUnique({ where: { id: userId } });

    if (user.withdrawal_pin && user.withdrawal_pin !== withdrawal_pin) {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal PIN / Security Password' });
    }

    const wallet = await prisma.user_wallets.upsert({
      where: {
        user_id_symbol_network: {
          user_id: userId,
          symbol: symbol.toUpperCase(),
          network: network.toUpperCase(),
        },
      },
      update: {
        address,
        label: label || `${symbol.toUpperCase()} Wallet`,
      },
      create: {
        user_id: userId,
        symbol: symbol.toUpperCase(),
        network: network.toUpperCase(),
        address,
        label: label || `${symbol.toUpperCase()} Wallet`,
      },
    });

    sendEmail({
      to: user.email,
      subject: 'Security Alert: Payout Wallet Address Updated - StakeLab',
      html: `<h2>Payout Wallet Updated</h2><p>Your ${symbol} (${network}) payout wallet address has been updated to: <b>${address}</b>.</p><p>If you did not perform this action, please lock your account or contact support immediately.</p>`,
      emailType: 'SECURITY_ALERT',
      userId,
    });

    return res.json({
      success: true,
      message: `Successfully linked ${symbol} (${network}) payout wallet address!`,
      wallet,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to save payout wallet', error: error.message });
  }
};

export const getUserWallets = async (req, res) => {
  try {
    const wallets = await prisma.user_wallets.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: 'desc' },
    });
    return res.json({ success: true, wallets });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch payout wallets', error: error.message });
  }
};
