import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin } from '@/lib/auth';
import AccessRequest from '@/models/AccessRequest';
import InviteCode from '@/models/InviteCode';
import { sendInviteCodeEmail } from '@/lib/email';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const EXPIRY_DAYS = 7;

function generateCode(): string {
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes).map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

// PATCH /api/demo/access-requests/[id] — update status (admin only)
// Approving auto-generates a workspace_create invite code and emails it to the requester.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);
  if (!isAdmin(user)) return err('Forbidden', 403);

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body.status;

  if (!['pending', 'approved', 'declined'].includes(status)) {
    return err('Invalid status', 400);
  }

  await connectDB();

  const doc = await AccessRequest.findById(id);
  if (!doc) return err('Not found', 404);

  doc.status = status;

  let inviteCode: string | undefined;

  if (status === 'approved' && !doc.inviteCode) {
    const { Types } = await import('mongoose');

    let code = generateCode();
    let attempts = 0;
    while (await InviteCode.exists({ code }) && attempts++ < 5) {
      code = generateCode();
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);

    await InviteCode.create({
      code,
      type: 'workspace_create',
      note: doc.name,
      expiresAt,
      createdBy: new Types.ObjectId(user.userId),
    });

    doc.inviteCode = code;
    inviteCode = code;

    // Fire-and-forget — don't fail the approval if email errors
    sendInviteCodeEmail(doc.email, doc.name, code).catch(() => {/* intentionally silent */});
  }

  await doc.save();

  return ok({
    _id:        doc._id.toString(),
    status:     doc.status,
    inviteCode: inviteCode ?? doc.inviteCode ?? null,
  });
}
