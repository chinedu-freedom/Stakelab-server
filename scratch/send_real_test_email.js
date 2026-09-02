import { sendEmail } from '../src/services/emailService.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  console.log('Sending live test email via Zoho Mail API...');
  const res = await sendEmail({
    to: 'chinedufreedom02@gmail.com',
    subject: 'Security PIN Verification Code Test (NEW DESIGN)',
    html: 'Your 6-digit verification code is 849204',
    emailType: 'PIN_RESET_OTP',
  });
  console.log('Result:', res);
}

run();
