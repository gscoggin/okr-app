import { NextRequest } from 'next/server';
import { Resend } from 'resend';
import { connectDB } from '@/lib/mongodb';
import { ok, err } from '@/lib/apiUtils';
import { isRateLimited } from '@/lib/rateLimit';
import AccessRequest from '@/models/AccessRequest';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(`request-access:${ip}`, 5, 60 * 60 * 1000)) {
    return err('Too many requests. Please try again later.', 429);
  }

  const body = await req.json().catch(() => ({}));

  // Honeypot — bots fill this, humans don't
  if (body._trap) return ok({ received: true });

  const name: string    = (body.name?.trim() ?? '').slice(0, 100);
  const email: string   = (body.email?.trim().toLowerCase() ?? '').slice(0, 255);
  const useCase: string = (body.useCase?.trim() ?? '').slice(0, 1000);

  if (!name)                    return err('Name is required');
  if (!EMAIL_RE.test(email))    return err('A valid email is required');

  await connectDB();

  const existing = await AccessRequest.findOne({ email, status: 'pending' });
  if (existing) return ok({ received: true }); // silently deduplicate

  await AccessRequest.create({ name, email, useCase: useCase || undefined });

  // Notify admin
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (adminEmail && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from:    process.env.EMAIL_FROM ?? 'OKR App <onboarding@resend.dev>',
      to:      adminEmail,
      subject: `New access request from ${name}`,
      text: [
        `Name:    ${name}`,
        `Email:   ${email}`,
        `Use case: ${useCase || '(not provided)'}`,
        '',
        'Review at /admin',
      ].join('\n'),
    });
    if (error) {
      console.error('[request-access] Resend error:', JSON.stringify(error));
    }
  }

  return ok({ received: true }, 201);
}
