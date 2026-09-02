import { renderEmailTemplate } from '../src/services/emailService.js';
import fs from 'fs';

const html = renderEmailTemplate({
  siteName: 'EverStake',
  siteLogo: null,
  subject: 'Security PIN Verification Code',
  content: 'Your 6-digit verification code is 849204',
  emailType: 'PIN_RESET_OTP',
});

console.log('--- GENERATED EMAIL HTML ---');
console.log(html);
fs.writeFileSync('scratch/output.html', html);
