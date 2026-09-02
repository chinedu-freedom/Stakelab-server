import { prisma } from '../config/db.js';
import { sendEmail, sendAdminNotificationEmail } from '../services/emailService.js';
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
      subject: 'Deposit Request Received',
      html: `
        <h2 style="color: #0f172a; font-size: 20px; font-weight: 800; margin-top: 0; margin-bottom: 16px;">Deposit Request Received</h2>
        <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">Hi <b>${req.user.username || req.user.full_name}</b>,</p>
        <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">Your deposit request has been received and is currently pending review & verification.</p>
        <table width="100%" cellpadding="12" cellspacing="0" style="border-collapse: collapse; margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; font-family: sans-serif;">
          <tbody>
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="font-weight: 700; color: #475569; width: 45%;">Deposit Amount</td>
              <td style="font-weight: 800; color: #0f172a;">$${depositAmount.toFixed(2)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="font-weight: 700; color: #475569;">Payment Method</td>
              <td style="color: #0f172a;">${payment_method}</td>
            </tr>
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="font-weight: 700; color: #475569;">Deposit Status</td>
              <td style="font-weight: 700; color: #d97706;">Pending Review</td>
            </tr>
          </tbody>
        </table>
        <p style="color: #0f172a; font-weight: 700; margin-top: 20px;">Thank you for choosing EverStake.</p>
      `,
      emailType: 'DEPOSIT_PROCESSING',
      userId,
    });

    sendAdminNotificationEmail({
      subject: `New Deposit Request: $${depositAmount.toFixed(2)} USDT from @${req.user.username || req.user.full_name}`,
      title: 'New Deposit Request Submitted',
      details: `<p>A user submitted a new deposit request:</p><ul><li><b>User:</b> @${req.user.username || req.user.full_name} (${req.user.email})</li><li><b>Amount:</b> $${depositAmount.toFixed(2)} USDT</li><li><b>Payment Method:</b> ${payment_method}</li></ul>`,
    }).catch(() => null);

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
            description: `Automated Deposit of $${creditAmount} (${deposit.payment_method})`,
          },
        });

        const userEmail = user.email;
        if (userEmail) {
          sendEmail({
            to: userEmail,
            subject: 'Deposit Successfully Confirmed & Credited',
            html: `
              <h2 style="color: #0f172a; font-size: 20px; font-weight: 800; margin-top: 0; margin-bottom: 16px;">Deposit Successfully Confirmed & Credited</h2>
              <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">Hi <b>${user.username || user.full_name}</b>,</p>
              <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">Your deposit of <b>$${creditAmount.toFixed(2)}</b> via <b>${deposit.payment_method || 'USDT (BEP20)'}</b> has been automatically credited to your balance.</p>
              <table width="100%" cellpadding="12" cellspacing="0" style="border-collapse: collapse; margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; font-family: sans-serif;">
                <tbody>
                  <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <td style="font-weight: 700; color: #475569; width: 45%;">Credited Amount</td>
                    <td style="font-weight: 800; color: #10b981;">$${creditAmount.toFixed(2)}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="font-weight: 700; color: #475569;">Payment Method</td>
                    <td style="color: #0f172a;">${deposit.payment_method || 'USDT (BEP20)'}</td>
                  </tr>
                  <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <td style="font-weight: 700; color: #475569;">Deposit Status</td>
                    <td style="font-weight: 700; color: #10b981;">Confirmed & Credited</td>
                  </tr>
                </tbody>
              </table>
              <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-top: 16px;">Kindly log in to your account and stake your funds to start earning.</p>
              <p style="color: #0f172a; font-weight: 700; margin-top: 16px;">Thank you for choosing EverStake.</p>
            `,
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
