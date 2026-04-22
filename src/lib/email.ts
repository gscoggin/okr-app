import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM ?? 'OKRs <noreply@yourdomain.com>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function sendPasswordResetEmail(email: string, token: string) {
  const link = `${APP_URL}/reset-password?token=${token}`;

  if (!process.env.RESEND_API_KEY) {
    console.log(`\n[DEV] Password reset link for ${email}:\n${link}\n`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Reset your password',
    html: `
      <p>You requested a password reset.</p>
      <p><a href="${link}">Click here to reset your password</a></p>
      <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      <p style="color:#999;font-size:12px">${link}</p>
    `,
  });
}
