import { prisma } from '../config/db.js';
import { sendEmail } from '../services/emailService.js';

export const getPaymentMethods = async (req, res) => {
  try {
    const methods = await prisma.payout_cryptocurrencies.findMany({
      where: { status: true },
    });
    return res.json({ success: true, methods });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch payment methods', error: error.message });
  }
};

export const createDeposit = async (req, res) => {
  try {
    const { amount, payment_method, transaction_hash, proof_image } = req.body;
    const userId = req.user.id;

    if (!amount || parseFloat(amount) <= 0 || !payment_method) {
      return res.status(400).json({ success: false, message: 'Amount and payment method are required' });
    }

    const depositAmount = parseFloat(amount);

    const deposit = await prisma.deposits.create({
      data: {
        user_id: userId,
        amount: depositAmount,
        payment_method,
        transaction_hash: transaction_hash || null,
        proof_image: proof_image || null,
        status: 'PENDING',
      },
    });

    sendEmail({
      to: req.user.email,
      subject: 'Deposit Submitted - Stakelab',
      html: `<h3>Deposit Received</h3><p>Your deposit of $${depositAmount} via ${payment_method} is currently under review by our admin team.</p>`,
      emailType: 'DEPOSIT_PROCESSING',
      userId,
    });

    return res.status(201).json({
      success: true,
      message: 'Deposit submitted successfully and pending approval',
      deposit,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create deposit', error: error.message });
  }
};

export const getUserDeposits = async (req, res) => {
  try {
    const deposits = await prisma.deposits.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: 'desc' },
    });
    return res.json({ success: true, deposits });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch deposits', error: error.message });
  }
};
