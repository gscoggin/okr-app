/**
 * Invite code journeys
 *
 * Covered:
 *   1.  Super admin generates a workspace_create code — returns 201
 *   2.  Admin generates a workspace_join code — returns 201 with tenantId scoped
 *   3.  Admin cannot generate a workspace_create code — 403
 *   4.  Member cannot generate any code — 403
 *   5.  Unauthenticated generate returns 401
 *   6.  Generated code stores note when provided
 *   7.  Super admin lists all codes
 *   8.  Admin lists only their tenant's workspace_join codes
 *   9.  Non-admin cannot list codes — 403
 *   10. Codes list returns correct computed statuses
 *   11. Super admin revokes any active code
 *   12. Admin revokes their own workspace_join code
 *   13. Admin cannot revoke a workspace_create code — 403
 *   14. Admin cannot revoke another tenant's code — 403
 *   15. Cannot revoke an already-used code — 400
 *   16. Cannot revoke a non-existent code — 404
 *   17. Non-admin cannot revoke — 403
 *   18. GET /[code] peek returns type for workspace_create code
 *   19. GET /[code] peek returns type + tenantName for workspace_join code
 *   20. GET /[code] peek returns 404 for unknown code
 */
import mongoose from 'mongoose';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { req, json } from '../helpers/request';
import { createUser } from '../helpers/fixtures';
import InviteCode from '@/models/InviteCode';
import Tenant from '@/models/Tenant';

import { GET as getCodes, POST as postCode } from '@/app/api/invite-codes/route';
import { GET as peekCode, DELETE as deleteCode } from '@/app/api/invite-codes/[code]/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

async function seedCode(overrides: Partial<{
  usedAt: Date;
  revokedAt: Date;
  expiresAt: Date;
  note: string;
  type: string;
  tenantId: mongoose.Types.ObjectId;
}> = {}) {
  return InviteCode.create({
    code: 'SEEDCODE',
    type: overrides.type ?? 'workspace_create',
    createdBy: new mongoose.Types.ObjectId(),
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ...overrides,
  });
}

// ── 1. Super admin generates workspace_create code ────────────────────────────

it('super admin generates a workspace_create code', async () => {
  const superAdmin = await createUser({ role: 'super_admin' });
  const res = await postCode(req('POST', '/api/invite-codes', {
    token: superAdmin.token,
    body: { type: 'workspace_create' },
  }));
  expect(res.status).toBe(201);
  const { data } = await json(res);
  expect(data.type).toBe('workspace_create');
  expect(data.status).toBe('active');
  expect(data.code).toMatch(/^[A-Z0-9]{8}$/);
});

// ── 2. Admin generates workspace_join code ────────────────────────────────────

it('admin generates a workspace_join code scoped to their tenant', async () => {
  const admin = await createUser({ role: 'admin' });
  const res = await postCode(req('POST', '/api/invite-codes', {
    token: admin.token,
    body: { type: 'workspace_join' },
  }));
  expect(res.status).toBe(201);
  const { data } = await json(res);
  expect(data.type).toBe('workspace_join');
  expect(data.status).toBe('active');

  const doc = await InviteCode.findOne({ code: data.code });
  expect(doc?.tenantId?.toString()).toBe(admin.tenantId);
});

// ── 3. Admin cannot generate workspace_create code ───────────────────────────

it('admin cannot generate a workspace_create code', async () => {
  const admin = await createUser({ role: 'admin' });
  const res = await postCode(req('POST', '/api/invite-codes', {
    token: admin.token,
    body: { type: 'workspace_create' },
  }));
  expect(res.status).toBe(403);
  expect(await InviteCode.countDocuments()).toBe(0);
});

// ── 4. Member cannot generate any code ───────────────────────────────────────

it('member cannot generate an invite code', async () => {
  const member = await createUser({ role: 'member' });
  const res = await postCode(req('POST', '/api/invite-codes', { token: member.token }));
  expect(res.status).toBe(403);
  expect(await InviteCode.countDocuments()).toBe(0);
});

// ── 5. Unauthenticated generate returns 401 ───────────────────────────────────

it('unauthenticated request to generate returns 401', async () => {
  const res = await postCode(req('POST', '/api/invite-codes'));
  expect(res.status).toBe(401);
});

// ── 6. Note stored when provided ─────────────────────────────────────────────

it('generated code stores the provided note', async () => {
  const admin = await createUser({ role: 'admin' });
  const res = await postCode(req('POST', '/api/invite-codes', {
    token: admin.token,
    body: { type: 'workspace_join', note: 'For Jane' },
  }));
  expect(res.status).toBe(201);
  expect((await json(res)).data.note).toBe('For Jane');
});

// ── 7. Super admin lists all codes ────────────────────────────────────────────

it('super admin lists all codes across tenants', async () => {
  const superAdmin = await createUser({ role: 'super_admin' });
  const admin = await createUser({ role: 'admin' });
  await seedCode({ type: 'workspace_create' });
  await InviteCode.create({
    code: 'JOINCODE',
    type: 'workspace_join',
    createdBy: new mongoose.Types.ObjectId(),
    tenantId: new mongoose.Types.ObjectId(admin.tenantId),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const res = await getCodes(req('GET', '/api/invite-codes', { token: superAdmin.token }));
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data).toHaveLength(2);
});

// ── 8. Admin lists only their tenant's join codes ────────────────────────────

it("admin lists only their tenant's workspace_join codes", async () => {
  const admin = await createUser({ role: 'admin' });
  await seedCode({ type: 'workspace_create' });
  await InviteCode.create({
    code: 'JOINCODE',
    type: 'workspace_join',
    createdBy: new mongoose.Types.ObjectId(),
    tenantId: new mongoose.Types.ObjectId(admin.tenantId),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  await InviteCode.create({
    code: 'OTHERJOIN',
    type: 'workspace_join',
    createdBy: new mongoose.Types.ObjectId(),
    tenantId: new mongoose.Types.ObjectId(), // different tenant
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const res = await getCodes(req('GET', '/api/invite-codes', { token: admin.token }));
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data).toHaveLength(1);
  expect(data[0].code).toBe('JOINCODE');
});

// ── 9. Non-admin cannot list codes ───────────────────────────────────────────

it('non-admin cannot list invite codes', async () => {
  const member = await createUser({ role: 'member' });
  const res = await getCodes(req('GET', '/api/invite-codes', { token: member.token }));
  expect(res.status).toBe(403);
});

// ── 10. Correct computed statuses ────────────────────────────────────────────

it('list returns correct computed statuses', async () => {
  const superAdmin = await createUser({ role: 'super_admin' });
  await seedCode();
  await InviteCode.create({
    code: 'USEDCODE',
    type: 'workspace_create',
    createdBy: new mongoose.Types.ObjectId(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    usedAt: new Date(),
  });
  await InviteCode.create({
    code: 'REVOKEDCO',
    type: 'workspace_create',
    createdBy: new mongoose.Types.ObjectId(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revokedAt: new Date(),
  });
  await InviteCode.create({
    code: 'EXPIREDCO',
    type: 'workspace_create',
    createdBy: new mongoose.Types.ObjectId(),
    expiresAt: new Date(Date.now() - 1000),
  });

  const res = await getCodes(req('GET', '/api/invite-codes', { token: superAdmin.token }));
  const { data } = await json(res);

  const byCode = Object.fromEntries(data.map((c: { code: string; status: string }) => [c.code, c.status]));
  expect(byCode['SEEDCODE']).toBe('active');
  expect(byCode['USEDCODE']).toBe('used');
  expect(byCode['REVOKEDCO']).toBe('revoked');
  expect(byCode['EXPIREDCO']).toBe('expired');
});

// ── 11. Super admin revokes any code ─────────────────────────────────────────

it('super admin revokes any active code', async () => {
  await seedCode();
  const superAdmin = await createUser({ role: 'super_admin' });
  const res = await deleteCode(
    req('DELETE', '/api/invite-codes/SEEDCODE', { token: superAdmin.token }),
    { params: Promise.resolve({ code: 'SEEDCODE' }) }
  );
  expect(res.status).toBe(200);
  expect((await json(res)).data.status).toBe('revoked');
});

// ── 12. Admin revokes their own join code ─────────────────────────────────────

it("admin revokes their own tenant's workspace_join code", async () => {
  const admin = await createUser({ role: 'admin' });
  await InviteCode.create({
    code: 'MYJOIN01',
    type: 'workspace_join',
    createdBy: new mongoose.Types.ObjectId(),
    tenantId: new mongoose.Types.ObjectId(admin.tenantId),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  const res = await deleteCode(
    req('DELETE', '/api/invite-codes/MYJOIN01', { token: admin.token }),
    { params: Promise.resolve({ code: 'MYJOIN01' }) }
  );
  expect(res.status).toBe(200);
  expect((await json(res)).data.status).toBe('revoked');
});

// ── 13. Admin cannot revoke workspace_create code ────────────────────────────

it('admin cannot revoke a workspace_create code', async () => {
  await seedCode({ type: 'workspace_create' });
  const admin = await createUser({ role: 'admin' });
  const res = await deleteCode(
    req('DELETE', '/api/invite-codes/SEEDCODE', { token: admin.token }),
    { params: Promise.resolve({ code: 'SEEDCODE' }) }
  );
  expect(res.status).toBe(403);
});

// ── 14. Admin cannot revoke another tenant's join code ───────────────────────

it("admin cannot revoke another tenant's workspace_join code", async () => {
  const admin = await createUser({ role: 'admin' });
  await InviteCode.create({
    code: 'OTHERJN1',
    type: 'workspace_join',
    createdBy: new mongoose.Types.ObjectId(),
    tenantId: new mongoose.Types.ObjectId(), // different tenant
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  const res = await deleteCode(
    req('DELETE', '/api/invite-codes/OTHERJN1', { token: admin.token }),
    { params: Promise.resolve({ code: 'OTHERJN1' }) }
  );
  expect(res.status).toBe(403);
});

// ── 15. Cannot revoke already-used code ──────────────────────────────────────

it('cannot revoke a code that has already been used', async () => {
  await seedCode({ usedAt: new Date() });
  const superAdmin = await createUser({ role: 'super_admin' });
  const res = await deleteCode(
    req('DELETE', '/api/invite-codes/SEEDCODE', { token: superAdmin.token }),
    { params: Promise.resolve({ code: 'SEEDCODE' }) }
  );
  expect(res.status).toBe(400);
});

// ── 16. 404 for non-existent code ────────────────────────────────────────────

it('returns 404 when revoking a code that does not exist', async () => {
  const superAdmin = await createUser({ role: 'super_admin' });
  const res = await deleteCode(
    req('DELETE', '/api/invite-codes/NOTREAL1', { token: superAdmin.token }),
    { params: Promise.resolve({ code: 'NOTREAL1' }) }
  );
  expect(res.status).toBe(404);
});

// ── 17. Non-admin cannot revoke ───────────────────────────────────────────────

it('non-admin cannot revoke a code', async () => {
  await seedCode();
  const member = await createUser({ role: 'member' });
  const res = await deleteCode(
    req('DELETE', '/api/invite-codes/SEEDCODE', { token: member.token }),
    { params: Promise.resolve({ code: 'SEEDCODE' }) }
  );
  expect(res.status).toBe(403);
  const doc = await InviteCode.findOne({ code: 'SEEDCODE' });
  expect(doc?.revokedAt).toBeUndefined();
});

// ── 18. Peek returns type for workspace_create code ──────────────────────────

it('peek returns type for a workspace_create code', async () => {
  await seedCode({ type: 'workspace_create' });
  const res = await peekCode(
    req('GET', '/api/invite-codes/SEEDCODE'),
    { params: Promise.resolve({ code: 'SEEDCODE' }) }
  );
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data.type).toBe('workspace_create');
  expect(data.tenantName).toBeNull();
});

// ── 19. Peek returns type + tenantName for workspace_join code ────────────────

it('peek returns type and tenantName for a workspace_join code', async () => {
  const tenant = await Tenant.create({
    name: 'Peek Corp',
    slug: 'peek-corp',
    ownerId: new mongoose.Types.ObjectId(),
    branding: {},
  });
  await InviteCode.create({
    code: 'PEEKJOIN',
    type: 'workspace_join',
    createdBy: new mongoose.Types.ObjectId(),
    tenantId: tenant._id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const res = await peekCode(
    req('GET', '/api/invite-codes/PEEKJOIN'),
    { params: Promise.resolve({ code: 'PEEKJOIN' }) }
  );
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data.type).toBe('workspace_join');
  expect(data.tenantName).toBe('Peek Corp');
});

// ── 20. Peek returns 404 for unknown code ─────────────────────────────────────

it('peek returns 404 for an unknown code', async () => {
  const res = await peekCode(
    req('GET', '/api/invite-codes/NOTREAL1'),
    { params: Promise.resolve({ code: 'NOTREAL1' }) }
  );
  expect(res.status).toBe(404);
});
