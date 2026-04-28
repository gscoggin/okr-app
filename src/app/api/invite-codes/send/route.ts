import { NextRequest } from 'next/server';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isSuperAdmin } from '@/lib/auth';
import { sendInviteCodeEmail } from '@/lib/email';

// POST /api/invite-codes/send — super_admin only, sends an already-generated code via email
export async function POST(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);
  if (!isSuperAdmin(user)) return err('Forbidden', 403);

  const body = await req.json().catch(() => ({}));
  const code: string = body.code?.trim() ?? '';
  const email: string = body.email?.trim().toLowerCase() ?? '';
  const name: string = body.name?.trim() || 'there';

  if (!code || !email) return err('code and email are required');

  const sent = await sendInviteCodeEmail(email, name, code);
  if (!sent) return err('Failed to send email', 500);

  return ok({ sent: true });
}
