import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin, isSuperAdmin, isTenantOwner } from '@/lib/auth';
import InviteCode from '@/models/InviteCode';

const EXPIRY_DAYS = 7;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I

function generateCode(): string {
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes).map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

function codeStatus(c: { usedAt?: Date | null; revokedAt?: Date | null; expiresAt: Date }): string {
  if (c.usedAt)    return 'used';
  if (c.revokedAt) return 'revoked';
  if (c.expiresAt < new Date()) return 'expired';
  return 'active';
}

// GET /api/invite-codes — list codes
// super_admin: all codes; admin/tenant_owner: their tenant's workspace_join codes only
export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);
  if (!isAdmin(user)) return err('Forbidden', 403);

  await connectDB();

  const filter = isSuperAdmin(user)
    ? {}
    : { type: 'workspace_join', tenantId: user.tenantId };

  const codes = await InviteCode.find(filter).sort({ createdAt: -1 }).lean();

  return ok(
    codes.map((c) => ({
      _id:       c._id.toString(),
      code:      c.code,
      type:      c.type,
      note:      c.note ?? null,
      status:    codeStatus(c),
      expiresAt: c.expiresAt.toISOString(),
      usedAt:    c.usedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    }))
  );
}

// POST /api/invite-codes — generate a new code
// workspace_create: super_admin only
// workspace_join: admin or tenant_owner (auto-scoped to their tenant)
export async function POST(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const body = await req.json().catch(() => ({}));
  const type: string = body.type === 'workspace_create' ? 'workspace_create' : 'workspace_join';
  const note: string | undefined = body.note?.trim() || undefined;

  if (type === 'workspace_create' && !isSuperAdmin(user)) {
    return err('Only super admins can generate workspace creation codes', 403);
  }
  if (type === 'workspace_join' && !isAdmin(user)) {
    return err('Forbidden', 403);
  }

  await connectDB();

  let code = generateCode();
  let attempts = 0;
  while (await InviteCode.exists({ code }) && attempts++ < 5) {
    code = generateCode();
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);

  const { Types } = await import('mongoose');
  const doc = await InviteCode.create({
    code,
    type,
    note,
    expiresAt,
    createdBy: new Types.ObjectId(user.userId),
    ...(type === 'workspace_join' ? { tenantId: new Types.ObjectId(user.tenantId) } : {}),
  });

  return ok({
    _id:       doc._id.toString(),
    code:      doc.code,
    type:      doc.type,
    note:      doc.note ?? null,
    status:    'active',
    expiresAt: doc.expiresAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  }, 201);
}
