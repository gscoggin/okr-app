import { NextRequest } from 'next/server';
import { Resend } from 'resend';
import { connectDB } from '@/lib/mongodb';
import { ok, err } from '@/lib/apiUtils';
import AccessRequest from '@/models/AccessRequest';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Honeypot — bots fill this, humans don't
  if (body._trap) return ok({ received: true });

  const name: string    = body.name?.trim() ?? '';
  const email: string   = body.email?.trim().toLowerCase() ?? '';
  const useCase: string = body.useCase?.trim() ?? '';

  if (!name)                        return err('Name is required');
  if (!email || !email.includes('@')) return err('A valid email is required');

  await connectDB();

  const existing = await AccessRequest.findOne({ email, status: 'pending' });
  if (existing) return ok({ received: true }); // silently deduplicate

  await AccessRequest.create({ name, email, useCase: useCase || undefined });

  // Notify admin — fire-and-forget, don't fail the request if email errors
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (adminEmail && process.env.RESEND_API_KEY) {
    resend.emails.send({
      from:    'OKR App <notifications@resend.dev>',
      to:      adminEmail,
      subject: `New access request from ${name}`,
      text: [
        `Name:    ${name}`,
        `Email:   ${email}`,
        `Use case: ${useCase || '(not provided)'}`,
        '',
        'Review in the admin panel: /admin',
      ].join('\n'),
    }).catch(() => {/* intentionally silent */});
  }

  return ok({ received: true }, 201);
}
