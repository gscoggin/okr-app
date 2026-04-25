import { Resend } from 'resend';

const FROM = process.env.EMAIL_FROM ?? 'OKRs <noreply@yourdomain.com>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const REGISTER_URL = `${APP_URL}/register`;

export async function sendInviteCodeEmail(email: string, name: string, code: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`\n[DEV] Invite code for ${email}: ${code}\n${REGISTER_URL}\n`);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Your invite code is ready',
    html: `
      <p>Hi ${name},</p>
      <p>Your request for access has been approved. Use the invite code below to create your workspace:</p>
      <p style="font-size:24px;font-weight:bold;letter-spacing:4px;font-family:monospace">${code}</p>
      <p><a href="${REGISTER_URL}">Create your workspace →</a></p>
      <p style="color:#999;font-size:12px">This code expires in 7 days. If you didn't request access, you can ignore this email.</p>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const link = `${APP_URL}/reset-password?token=${token}`;

  if (!process.env.RESEND_API_KEY) {
    console.log(`\n[DEV] Password reset link for ${email}:\n${link}\n`);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
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
