import { prisma } from '../config/db.js';
import { sendEmail } from '../services/emailService.js';

export const createWithdrawal = async (req, res) => {
  try {
    const { amount, withdrawal_method, wallet_address, withdrawal_pin, wallet_type } = req.body;
    const userId = req.user.id;

    if (!req.user.email_verified) {
      return res.status(403).json({
        success: false,
        require_email_verification: true,
        message: 'Please verify your email address to perform withdrawals.',
      });
    }

    if (!amount || parseFloat(amount) <= 0 || !withdrawal_method || !wallet_address) {
      return res.status(400).json({ success: false, message: 'Amount, method, and wallet address are required' });
    }

    const withdrawAmount = parseFloat(amount);
    const user = await prisma.users.findUnique({ where: { id: userId } });

    if (user.withdrawal_pin && user.withdrawal_pin !== withdrawal_pin) {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal PIN' });
    }

    const selectedWallet = wallet_type === 'profit' ? 'profit' : 'main';
    const currentBalance = selectedWallet === 'profit' ? parseFloat(user.staked_balance || 0) : parseFloat(user.balance || 0);

    if (currentBalance < withdrawAmount) {
      const walletName = selectedWallet === 'profit' ? 'Profits Wallet' : 'Staking Wallet';
      return res.status(400).json({ success: false, message: `Insufficient balance in ${walletName}` });
    }

    const settings = (await prisma.settings.findFirst()) || { min_withdrawal: 2, max_withdrawal: 50000, withdrawal_charge: 1 };
    if (withdrawAmount < parseFloat(settings.min_withdrawal)) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is $${settings.min_withdrawal}`,
      });
    }
    if (settings.max_withdrawal && withdrawAmount > parseFloat(settings.max_withdrawal)) {
      return res.status(400).json({
        success: false,
        message: `Maximum withdrawal amount is $${settings.max_withdrawal}`,
      });
    }

    const fee = (withdrawAmount * parseFloat(settings.withdrawal_charge)) / 100;
    const netAmount = withdrawAmount - fee;
    const updatedBalanceValue = currentBalance - withdrawAmount;

    const userUpdateData = selectedWallet === 'profit'
      ? { staked_balance: updatedBalanceValue }
      : { balance: updatedBalanceValue };

    const walletLabel = selectedWallet === 'profit' ? 'Profits Wallet' : 'Staking Wallet';

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
        data: userUpdateData,
      }),
      prisma.transactions.create({
        data: {
          user_id: userId,
          type: 'WITHDRAWAL',
          amount: withdrawAmount,
          balance_before: currentBalance,
          balance_after: updatedBalanceValue,
          description: `Withdrawal request of $${withdrawAmount} from ${walletLabel} to ${wallet_address}`,
        },
      }),
    ]);

    sendEmail({
      to: user.email,
      subject: 'Withdrawal Request Received',
      html: `
        <h2 style="color: #0f172a; font-size: 20px; font-weight: 800; margin-top: 0; margin-bottom: 16px;">Withdrawal Request Received</h2>
        <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">Hi <b>${user.username || user.full_name}</b>,</p>
        <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">Your withdrawal request has been received and is currently pending review & processing.</p>
        <table width="100%" cellpadding="12" cellspacing="0" style="border-collapse: collapse; margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; font-family: sans-serif;">
          <tbody>
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="font-weight: 700; color: #475569; width: 45%;">Withdrawal Amount</td>
              <td style="font-weight: 800; color: #0f172a;">$${withdrawAmount.toFixed(2)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="font-weight: 700; color: #475569;">Withdrawal Status</td>
              <td style="font-weight: 700; color: #d97706;">Pending</td>
            </tr>
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="font-weight: 700; color: #475569;">Withdrawal Method</td>
              <td style="color: #0f172a;">${withdrawal_method}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="font-weight: 700; color: #475569;">Destination Address</td>
              <td style="font-family: monospace; font-size: 12px; color: #334155; word-break: break-all;">"${wallet_address}"</td>
            </tr>
          </tbody>
        </table>
        <p style="color: #64748b; font-size: 13px; margin-top: 20px; line-height: 1.6;">If you did not initiate this transaction, please contact our support team as soon as possible.</p>
        <p style="color: #0f172a; font-weight: 700; margin-top: 16px;">Thank you for choosing EverStake.</p>
      `,
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
