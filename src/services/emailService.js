import nodemailer from 'nodemailer';
import { prisma } from '../config/db.js';

export const sendEmail = async ({ to, subject, html, emailType, userId }) => {
  try {
    let emailSettings = await prisma.email_settings.findFirst();

    if (!emailSettings) {
      emailSettings = {
        smtp_host: process.env.SMTP_HOST || 'smtp.gmail.com',
        smtp_port: parseInt(process.env.SMTP_PORT || '587'),
        smtp_user: process.env.SMTP_USER || '',
        smtp_pass: process.env.SMTP_PASS || '',
        from_email: process.env.FROM_EMAIL || 'noreply@stakelab.io',
        from_name: process.env.FROM_NAME || 'Stakelab',
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
        from: `"${emailSettings.from_name}" <${emailSettings.from_email}>`,
        to,
        subject,
        html,
      });

      if (userId) {
        await prisma.email_logs.create({
          data: {
            user_id: userId,
            recipient: to,
            subject,
            email_type: emailType || 'NOTIFICATION',
            status: 'SENT',
          },
        });
      }
      return { success: true };
    } else {
      console.log(`[EMAIL SIMULATION] To: ${to} | Subject: ${subject}`);
      if (userId) {
        await prisma.email_logs.create({
          data: {
            user_id: userId,
            recipient: to,
            subject,
            email_type: emailType || 'SIMULATED',
            status: 'SIMULATED',
          },
        });
      }
      return { success: true, simulated: true };
    }
  } catch (error) {
    console.error('Email error:', error);
    if (userId) {
      await prisma.email_logs.create({
        data: {
          user_id: userId,
          recipient: to,
          subject,
          email_type: emailType || 'ERROR',
          status: 'FAILED',
          error_msg: error.message,
        },
      }).catch(() => {});
    }
    return { success: false, error: error.message };
  }
};
