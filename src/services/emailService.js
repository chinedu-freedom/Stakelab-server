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

// Helper: Render Dynamic Master HTML Email Template
export function renderEmailTemplate({ siteName, siteLogo, subject, content, emailType }) {
  const cleanSubject = stripEmojisAndIcons(subject || 'Notification').replace(/everstake|stakelab/gi, siteName);
  const isNotification = emailType === 'ADMIN_NOTIFICATION' || emailType === 'NOTIFICATION';

  // Detect verification code if present
  const codeMatch = typeof content === 'string' ? content.match(/\b\d{4,8}\b/) : null;
  const extractedCode = codeMatch ? codeMatch[0] : null;

  // Header Brand styling - Sleek EverStake Dark Navy Header Bar
  const headerBrandHtml = siteLogo
    ? `<img src="${siteLogo}" alt="${siteName}" style="max-height: 40px; max-width: 200px; object-fit: contain; display: block; margin: 0 auto;" />`
    : `<div style="text-align: center;"><span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 900; color: #ffffff !important; letter-spacing: 1.5px; text-transform: uppercase;">EVER<span style="color: #ff0044 !important;">STAKE</span></span></div>`;

  let innerContentHtml = content;

  if (typeof content === 'string' && !content.includes('<!DOCTYPE')) {
    let cleanContent = stripEmojisAndIcons(content);

    if (isNotification) {
      innerContentHtml = `
        <div style="background-color: #060f22; border: 1px solid #182848; border-radius: 12px; padding: 24px; margin-bottom: 10px;">
          <div style="font-size: 11px; font-weight: 800; color: #ff0044 !important; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px;">Official Announcement</div>
          <h2 style="color: #ffffff !important; font-size: 18px; font-weight: 800; margin-top: 0; margin-bottom: 14px;">${cleanSubject}</h2>
          <div style="color: #cbd5e1 !important; font-size: 14px; line-height: 1.7;">
            ${cleanContent}
          </div>
        </div>
      `;
    } else if (extractedCode || emailType === 'PIN_RESET_OTP' || emailType === 'EMAIL_VERIFICATION' || emailType === 'VERIFICATION' || emailType === 'PASSWORD_RESET') {
      const displayCode = extractedCode || '******';
      innerContentHtml = `
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #ffffff !important; font-size: 22px; font-weight: 800; margin: 0 0 8px 0; letter-spacing: -0.5px;">${cleanSubject}</h2>
          <p style="color: #94a3b8 !important; font-size: 14px; margin: 0; line-height: 1.5;">Please use the security verification code below to authorize your request.</p>
        </div>

        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0; border-collapse: collapse;">
          <tr>
            <td align="center" style="background-color: #060f22 !important; border: 1px solid #182848; border-radius: 16px; padding: 28px 20px; text-align: center;">
              
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #ff0044 !important; letter-spacing: 2px; margin-bottom: 14px;">
                SECURITY VERIFICATION CODE
              </div>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto; border-collapse: collapse;">
                <tr>
                  <td align="center" style="background-color: #ff0044 !important; border-radius: 10px; padding: 14px 32px; text-align: center;">
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #ffffff !important; text-decoration: none; display: inline-block;">
                      ${displayCode}
                    </span>
                  </td>
                </tr>
              </table>

              <div style="font-size: 12px; color: #94a3b8 !important; margin-top: 16px; line-height: 1.5;">
                This code is valid for <b style="color: #ffffff !important;">10 minutes</b>. For your account security, do not share this code with anyone.
              </div>

            </td>
          </tr>
        </table>
      `;
    } else {
      innerContentHtml = `
        <div style="color: #cbd5e1 !important; font-size: 14px; line-height: 1.7;">
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
  <title>${cleanSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #060f22 !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff !important; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #060f22 !important; width: 100%; min-height: 100vh; padding: 36px 12px;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #0b1736 !important; border: 1px solid #1a2c54; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <!-- Header Bar -->
          <tr>
            <td align="center" style="background-color: #081226 !important; padding: 24px 20px; border-bottom: 3px solid #ff0044;">
              ${headerBrandHtml}
            </td>
          </tr>
          <!-- Body Content Area -->
          <tr>
            <td style="padding: 36px 32px; background-color: #0b1736 !important; color: #ffffff !important;">
              ${innerContentHtml}
            </td>
          </tr>
          <!-- Footer Area -->
          <tr>
            <td align="center" style="background-color: #081226 !important; padding: 24px 20px; border-top: 1px solid #182848; font-size: 12px; color: #94a3b8 !important; line-height: 1.6;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #cbd5e1 !important;">
                &copy; ${new Date().getFullYear()} <span style="color: #ff0044 !important; font-weight: 700;">${siteName}</span>. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 11px; color: #64748b !important;">
                Your trusted investment partner. This is an automated notification from ${siteName}. Please do not reply directly.
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

    // Clean subject line and strip any icons/emojis
    const formattedSubject = stripEmojisAndIcons(subject || 'Notification').replace(/stakelab/gi, siteName);
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
