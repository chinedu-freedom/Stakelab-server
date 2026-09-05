import axios from 'axios';
import nodemailer from 'nodemailer';
import { prisma } from '../config/db.js';

async function getZohoAccessToken() {
  const response = await axios.post(
    'https://accounts.zoho.com/oauth/v2/token',
    null,
    {
      params: {
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token',
      },
    }
  );
  return response.data.access_token;
}

// Clean all emojis and icons for mature corporate emails
function stripEmojisAndIcons(str) {
  if (!str) return '';
  return str
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F191}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3297}\u{3299}\u{303D}\u{00A9}\u{00AE}\u{2122}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper: Render Master Email Template matching eonassetsmining-backend
export function renderEmailTemplate({ siteName, siteLogo, subject, content, emailType }) {
  const cleanSubject = stripEmojisAndIcons(subject || 'Notification').replace(/everstake|stakelab/gi, siteName);

  if (typeof content === 'string' && content.includes('<!DOCTYPE')) {
    return content;
  }

  // Detect verification code if present (4 to 8 digits)
  const codeMatch = typeof content === 'string' ? content.match(/\b\d{4,8}\b/) : null;
  const extractedCode = codeMatch ? codeMatch[0] : null;

  let innerContentHtml = content;

  if (typeof content === 'string') {
    let cleanContent = stripEmojisAndIcons(content);

    const isOtpType = ['PIN_RESET_OTP', 'EMAIL_VERIFICATION', 'VERIFICATION', 'PASSWORD_RESET', 'WITHDRAWAL_OTP', 'OTP'].includes(emailType);

    if (isOtpType) {
      const displayCode = extractedCode || '******';

      innerContentHtml = `
        <div style="text-align:center; padding:10px 0;">
          <h2 style="color:#0f172a; margin-bottom:10px;">${cleanSubject}</h2>
          <p style="color:#475569; font-size:15px; line-height:1.6; margin-bottom: 20px;">
            Please use the confirmation code below to authorize your request:
          </p>

          <div style="margin:24px 0; text-align:center; white-space: nowrap !important;">
            <span style="
              background: #fff1f2;
              color: #ff0044;
              padding: 12px 28px;
              font-size: 26px;
              font-weight: 900;
              letter-spacing: 6px;
              border: 2px dashed #ff0044;
              border-radius: 12px;
              display: inline-block;
              white-space: nowrap !important;
              word-break: keep-all !important;
            ">
              ${displayCode}
            </span>
          </div>

          <p style="font-size:14px; color:#64748b; margin-top:16px;">
            This code is valid for <strong>10 minutes</strong>. Never share this code with anyone.
          </p>
          <p style="font-size:12px; color:#94a3b8; margin-top:24px;">
            If you did not make this request, please secure your account immediately or contact support.
          </p>
        </div>
      `;
    } else {
      innerContentHtml = `
        <div style="color: #0f172a; font-size: 15px; line-height: 1.7; font-weight: 500;">
          ${cleanContent}
        </div>
      `;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f8f9fa; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f8f9fa; padding:40px 0;">
     <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.04);">
          <!-- Header -->
          <tr>
            <td style="background-color:#ff0044; padding:30px 40px; text-align:center;">
              <h1 style="color:#ffffff; margin:0; font-size:28px; letter-spacing:1px; font-weight: 900; text-transform: uppercase;">${siteName}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${innerContentHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f1f5f9; padding:24px 40px; text-align:center;">
              <p style="margin:0; color:#64748b; font-size:13px; line-height:1.6;">
                &copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.<br>
                You received this email because you are registered on ${siteName}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const sendEmail = async ({ to, subject, html, emailType, userId }) => {
  try {
    // Dynamically fetch site_name and site_logo from settings table
    const settings = await prisma.settings.findFirst().catch(() => null);
    const siteName = settings?.site_name || settings?.site_title || 'EverStake';
    const siteLogo = settings?.site_logo || null;

    // Clean subject line and strip any icons/emojis (unless FREE_SPIN_REWARD email type)
    const formattedSubject = emailType === 'FREE_SPIN_REWARD'
      ? (subject || 'Notification').replace(/stakelab/gi, siteName)
      : stripEmojisAndIcons(subject || 'Notification').replace(/stakelab/gi, siteName);
    const formattedHtml = renderEmailTemplate({
      siteName,
      siteLogo,
      subject: formattedSubject,
      content: html,
      emailType,
    });

    // 1. Direct Zoho Mail API (from .env credentials)
    if (
      process.env.ZOHO_CLIENT_ID &&
      process.env.ZOHO_CLIENT_SECRET &&
      process.env.ZOHO_REFRESH_TOKEN &&
      process.env.ZOHO_MAIL_ACCOUNT_ID
    ) {
      try {
        const accessToken = await getZohoAccessToken();
        const url = `https://mail.zoho.com/api/accounts/${process.env.ZOHO_MAIL_ACCOUNT_ID}/messages`;

        await axios.post(
          url,
          {
            fromAddress: process.env.ZOHO_FROM_EMAIL || 'info@everstake.cx',
            toAddress: to,
            subject: formattedSubject,
            content: formattedHtml,
            mailFormat: 'html',
          },
          {
            headers: {
              Authorization: `Zoho-oauthtoken ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        console.log(`[ZOHO MAIL] Email sent successfully to ${to}`);
        if (userId) {
          await prisma.email_logs.create({
            data: {
              user_id: userId,
              recipient: to,
              subject: formattedSubject,
              email_type: emailType || 'NOTIFICATION',
              status: 'SENT',
            },
          }).catch(() => {});
        }
        return { success: true };
      } catch (zohoErr) {
        console.error('Zoho Mail API error, trying SMTP fallback:', zohoErr.response?.data || zohoErr.message);
      }
    }

    // 2. SMTP Transporter fallback
    let emailSettings = await prisma.email_settings.findFirst().catch(() => null);
    if (!emailSettings) {
      emailSettings = {
        smtp_host: process.env.SMTP_HOST || 'smtp.gmail.com',
        smtp_port: parseInt(process.env.SMTP_PORT || '587'),
        smtp_user: process.env.SMTP_USER || '',
        smtp_pass: process.env.SMTP_PASS || '',
        from_email: process.env.FROM_EMAIL || 'noreply@everstake.cx',
        from_name: process.env.FROM_NAME || siteName,
      };
    }

    if (emailSettings.smtp_user && emailSettings.smtp_pass) {
      const transporter = nodemailer.createTransport({
        host: emailSettings.smtp_host,
        port: emailSettings.smtp_port,
        secure: emailSettings.smtp_port === 465,
        auth: {
          user: emailSettings.smtp_user,
          pass: emailSettings.smtp_pass,
        },
      });

      await transporter.sendMail({
        from: `"${siteName}" <${emailSettings.from_email}>`,
        to,
        subject: formattedSubject,
        html: formattedHtml,
      });

      if (userId) {
        await prisma.email_logs.create({
          data: {
            user_id: userId,
            recipient: to,
            subject: formattedSubject,
            email_type: emailType || 'NOTIFICATION',
            status: 'SENT',
          },
        }).catch(() => {});
      }
      return { success: true };
    }

    // 3. Fallback simulation
    console.log(`[EMAIL SIMULATION] To: ${to} | Subject: ${formattedSubject}`);
    if (userId) {
      await prisma.email_logs.create({
        data: {
          user_id: userId,
          recipient: to,
          subject: formattedSubject,
          email_type: emailType || 'SIMULATED',
          status: 'SIMULATED',
        },
      }).catch(() => {});
    }
    return { success: true, simulated: true };
  } catch (error) {
    console.error('Email error:', error);
    if (userId) {
      await prisma.email_logs.create({
        data: {
          user_id: userId,
          recipient: to,
          subject: formattedSubject || subject,
          email_type: emailType || 'ERROR',
          status: 'FAILED',
          error_msg: error.message,
        },
      }).catch(() => {});
    }
    return { success: false, error: error.message };
  }
};

export async function sendAdminNotificationEmail({ subject, title, details }) {
  // Admin notification emails disabled system-wide
  return { success: true, message: 'Admin notification emails disabled' };
}

export const sendFreeSpinRewardEmail = async ({ inviter, refereeUser }) => {
  try {
    const settings = await prisma.settings.findFirst().catch(() => null);
    const siteName = settings?.site_name || settings?.site_title || 'EverStake';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const inviterName = inviter.full_name ? inviter.full_name.split(' ')[0] : (inviter.username || 'Friend');
    const refereeHandle = refereeUser.username || refereeUser.full_name || refereeUser.email.split('@')[0];

    const subject = `🎉 Congratulations ${inviterName}, You Earned a FREE Lucky Spin! 🎁`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f9; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f4f6f9; padding:40px 15px;">
    <tr>
      <td align="center">
        <table width="580" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: #e11d48; padding:30px 40px; text-align:center;">
              <h1 style="color:#ffffff; margin:0; font-size:26px; font-weight:900; letter-spacing:2px; text-transform:uppercase;">${siteName}</h1>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding:40px 35px; color:#1e293b;">
              
              <!-- Greeting -->
              <h2 style="margin-top:0; color:#0f172a; font-size:22px; font-weight:800; line-height:1.4;">
                🎉 Congratulations, ${inviterName}!🥳
              </h2>

              <!-- Highlight Body Text -->
              <p style="font-size:16px; line-height:1.7; color:#334155; margin-top:18px;">
                You’ve just earned a <strong>FREE Lucky Spin</strong> for successfully inviting <span style="color:#e11d48; font-weight:700;">@${refereeHandle}</span>! 🎁🔥
              </p>

              <!-- Sub Callout Card -->
              <div style="background-color:#fff1f2; border-left:4px solid #e11d48; padding:18px 20px; border-radius:10px; margin:26px 0;">
                <p style="margin:0; font-size:15px; line-height:1.6; color:#9f1239; font-weight:600;">
                  Log in now, navigate to the <strong>LuckySpin</strong> section, and spin the wheel to claim your reward! 🎰💰
                </p>
              </div>

              <!-- Action Button -->
              <div style="text-align:center; margin:32px 0 28px 0;">
                <a href="${frontendUrl}/spin" style="background: linear-gradient(135deg, #e11d48 0%, #ff5722 100%); color:#ffffff; text-decoration:none; padding:16px 40px; border-radius:50px; font-size:16px; font-weight:800; display:inline-block; box-shadow:0 4px 20px rgba(225,29,72,0.35); text-transform:uppercase; letter-spacing:0.5px;">
                  🎰 Spin the Wheel Now
                </a>
              </div>

              <!-- Footer Motivational Text -->
              <p style="font-size:15px; line-height:1.7; color:#475569; margin-top:24px;">
                🚀 Keep sharing the opportunity, invite more people, and earn even more exciting rewards with every successful referral!
              </p>

              <!-- Closing -->
              <p style="font-size:16px; font-weight:700; color:#0f172a; margin-top:22px; margin-bottom:0;">
                Good luck & happy spinning! 🍀🔥
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc; padding:24px 35px; text-align:center; border-top:1px solid #e2e8f0;">
              <p style="margin:0; color:#64748b; font-size:13px; line-height:1.6;">
                &copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.<br>
                You received this notification because a new user registered with your referral link on ${siteName}.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await sendEmail({
      to: inviter.email,
      subject,
      html,
      emailType: 'FREE_SPIN_REWARD',
      userId: inviter.id,
    });
  } catch (err) {
    console.error('Error sending free spin reward email:', err);
  }
};
