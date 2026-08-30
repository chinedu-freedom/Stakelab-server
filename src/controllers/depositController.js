import { prisma } from '../config/db.js';
import { sendEmail } from '../services/emailService.js';
import crypto from 'crypto';

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

    if (!req.user.email_verified) {
      return res.status(403).json({
        success: false,
        require_email_verification: true,
        message: 'Please verify your email address to perform deposits.',
      });
    }

    if (!amount || parseFloat(amount) <= 0 || !payment_method) {
      return res.status(400).json({ success: false, message: 'Amount and payment method are required' });
    }

    const depositAmount = parseFloat(amount);
    const settings = (await prisma.settings.findFirst()) || { min_deposit: 1, max_deposit: 50000 };
    if (depositAmount < parseFloat(settings.min_deposit)) {
      return res.status(400).json({ success: false, message: `Minimum deposit amount is $${settings.min_deposit}` });
    }
    if (depositAmount > parseFloat(settings.max_deposit)) {
      return res.status(400).json({ success: false, message: `Maximum deposit amount is $${settings.max_deposit}` });
    }

    const OXAPAY_MERCHANT_KEY = process.env.OXAPAY_MERCHANT_KEY;
    const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000/api';

    // If OxaPay Merchant Key is configured, generate dynamic crypto deposit address
    if (OXAPAY_MERCHANT_KEY) {
      try {
        let payCurrency = 'USDT';
        let oxapayNetwork = 'trc20';

        const pmLower = payment_method.toLowerCase();
        if (pmLower.includes('bep20') || pmLower.includes('bsc')) {
          payCurrency = 'USDT';
          oxapayNetwork = 'bep20';
        } else if (pmLower.includes('trc20') || pmLower.includes('tron')) {
          payCurrency = 'USDT';
          oxapayNetwork = 'trc20';
        } else if (pmLower.includes('btc') || pmLower.includes('bitcoin')) {
          payCurrency = 'BTC';
          oxapayNetwork = 'btc';
        } else if (pmLower.includes('eth') || pmLower.includes('erc20')) {
          payCurrency = 'ETH';
          oxapayNetwork = 'erc20';
        }

        const invoiceRes = await fetch('https://api.oxapay.com/merchants/request/whitelabel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchant: OXAPAY_MERCHANT_KEY,
            amount: depositAmount,
            payCurrency: payCurrency,
            network: oxapayNetwork,
            feePaidByPayer: 0,
            callbackUrl: `${BACKEND_URL}/oxapay-webhook`,
            description: `Stakelab Deposit - ${payment_method}`,
          }),
        });

        const json = await invoiceRes.json();
        const returnedAddress = json.payAddress || json.address;

        if (json.result === 100 && returnedAddress) {
          const deposit = await prisma.deposits.create({
            data: {
              user_id: userId,
              amount: depositAmount,
              payment_method,
              track_id: String(json.trackId),
              status: 'initiated',
            },
          });

          return res.status(201).json({
            success: true,
            message: 'Dynamic OxaPay deposit address generated successfully',
            address: returnedAddress,
            trackId: json.trackId,
            dynamic: true,
            deposit,
          });
        }
      } catch (oxaErr) {
        console.error('OXAPAY_INVOICE_ERROR:', oxaErr);
      }
    }

    // Fallback manual deposit if OxaPay is not configured or fails
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

export const oxapayWebhook = async (req, res) => {
  try {
    const payload = req.body;
    const signature = req.headers['x-oxapay-signature'];
    const OXAPAY_MERCHANT_KEY = process.env.OXAPAY_MERCHANT_KEY;

    // Verify HMAC-SHA512 Signature if key present
    if (OXAPAY_MERCHANT_KEY && signature) {
      const hmac = crypto.createHmac('sha512', OXAPAY_MERCHANT_KEY);
      const expectedSignature = hmac.update(JSON.stringify(payload)).digest('hex');
      if (signature !== expectedSignature) {
        console.error('OXAPAY_WEBHOOK_INVALID_SIGNATURE');
        return res.status(200).json({ ok: false, error: 'Invalid signature' });
      }
    }

    const rawStatus = payload?.status;

    if (rawStatus === 1 || rawStatus === 'Confirming' || rawStatus === 'waiting') {
      const trackId = payload.trackId ? String(payload.trackId) : '';
      if (trackId) {
        const initiatedDeposit = await prisma.deposits.findFirst({
          where: { track_id: trackId, status: 'initiated' },
        });
        if (initiatedDeposit) {
          await prisma.deposits.update({
            where: { id: initiatedDeposit.id },
            data: { status: 'PENDING' },
          });
        }
      }
      return res.status(200).json({ ok: true });
    }

    if (rawStatus === 2 || rawStatus === 'Paid') {
      const paidAmount = Number(payload.amount) || 0;
      const trackId = payload.trackId ? String(payload.trackId) : '';

      let deposit = null;
      if (trackId) {
        deposit = await prisma.deposits.findFirst({
          where: { track_id: trackId, status: { in: ['PENDING', 'initiated'] } },
        });
      }

      if (!deposit) {
        deposit = await prisma.deposits.findFirst({
          where: { amount: paidAmount, status: { in: ['PENDING', 'initiated'] } },
        });
      }

      if (!deposit) {
        return res.status(200).json({ ok: true });
      }

      if (deposit.status === 'APPROVED') {
        return res.status(200).json({ ok: true });
      }

      const creditAmount = Number(deposit.amount);

      await prisma.$transaction(async (tx) => {
        await tx.deposits.update({
          where: { id: deposit.id },
          data: {
            status: 'APPROVED',
            approved_at: new Date(),
          },
        });

        const user = await tx.users.findUnique({ where: { id: deposit.user_id } });
        const newBalance = Number(user.balance) + creditAmount;

        await tx.users.update({
          where: { id: deposit.user_id },
          data: { balance: newBalance },
        });

        await tx.transactions.create({
          data: {
            user_id: deposit.user_id,
            type: 'DEPOSIT',
            amount: creditAmount,
            balance_before: user.balance,
            balance_after: newBalance,
            description: `Automated OxaPay Deposit of $${creditAmount} (${deposit.payment_method})`,
          },
        });

        const userEmail = user.email;
        if (userEmail) {
          sendEmail({
            to: userEmail,
            subject: 'Deposit Approved - Stakelab',
            html: `<h3>Deposit Confirmed</h3><p>Your deposit of $${creditAmount} via ${deposit.payment_method} has been automatically credited to your balance!</p>`,
            emailType: 'DEPOSIT_APPROVED',
            userId: deposit.user_id,
          });
        }
      });

      return res.status(200).json({ ok: true, message: 'Deposit credited automatically' });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('OXAPAY_WEBHOOK_ERROR:', error);
    return res.status(500).json({ ok: false, error: error.message });
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
