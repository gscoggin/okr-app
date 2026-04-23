/**
 * Invite code journeys
 *
 * Covered:
 *   1.  Admin generates a code — returns 201 with active status
 *   2.  Generated code has note attached when provided
 *   3.  Non-admin cannot generate a code
 *   4.  Unauthenticated request to generate returns 401
 *   5.  Admin lists all codes — returns correct statuses
 *   6.  Non-admin cannot list codes
 *   7.  Admin revokes an active code
 *   8.  Cannot revoke a code that has already been used
 *   9.  Cannot revoke a code that does not exist
 *   10. Non-admin cannot revoke a code
 */
import mongoose from 'mongoose';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { req, json } from '../helpers/request';
import { createUser } from '../helpers/fixtures';
import InviteCode from '@/models/InviteCode';

import { GET as getCodes, POST as postCode } from '@/app/api/invite-codes/route';
import { DELETE as deleteCode } from '@/app/api/invite-codes/[code]/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

async function seedCode(overrides: Partial<{ usedAt: Date; revokedAt: Date; expiresAt: Date; note: string }> = {}) {
  return InviteCode.create({
    code: 'SEEDCODE',
    createdBy: new mongoose.Types.ObjectId(),
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ...overrides,
  });
}

// ── 1. Admin generates a code ─────────────────────────────────────────────────

it('admin generates a code and receives an active code', async () => {
  const admin = await createUser({ role: 'admin' });
  const res = await postCode(req('POST', '/api/invite-codes', { token: admin.token }));
  expect(res.status).toBe(201);
  const { data } = await json(res);
  expect(data.status).toBe('active');
  expect(data.code).toMatch(/^[A-Z0-9]{8}$/);
  expect(data.expiresAt).toBeDefined();
  expect(await InviteCode.countDocuments()).toBe(1);
});

// ── 2. Note is stored when provided ──────────────────────────────────────────

it('generated code stores the provided note', async () => {
  const admin = await createUser({ role: 'admin' });
  const res = await postCode(req('POST', '/api/invite-codes', { body: { note: 'For Jane' }, token: admin.token }));
  expect(res.status).toBe(201);
  expect((await json(res)).data.note).toBe('For Jane');
});

// ── 3. Non-admin cannot generate ─────────────────────────────────────────────

it('non-admin cannot generate an invite code', async () => {
  const member = await createUser({ role: 'member' });
  const res = await postCode(req('POST', '/api/invite-codes', { token: member.token }));
  expect(res.status).toBe(403);
  expect(await InviteCode.countDocuments()).toBe(0);
});

// ── 4. Unauthenticated generate returns 401 ───────────────────────────────────

it('unauthenticated request to generate returns 401', async () => {
  const res = await postCode(req('POST', '/api/invite-codes'));
  expect(res.status).toBe(401);
});

// ── 5. Admin lists codes with correct statuses ───────────────────────────────

it('admin lists all codes with correct computed statuses', async () => {
  await seedCode();
  await InviteCode.create({
    code: 'USEDCODE',
    createdBy: new mongoose.Types.ObjectId(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    usedAt: new Date(),
  });
  await InviteCode.create({
    code: 'REVOKEDCO',
    createdBy: new mongoose.Types.ObjectId(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revokedAt: new Date(),
  });
  await InviteCode.create({
    code: 'EXPIREDCO',
    createdBy: new mongoose.Types.ObjectId(),
    expiresAt: new Date(Date.now() - 1000),
  });

  const admin = await createUser({ role: 'admin' });
  const res = await getCodes(req('GET', '/api/invite-codes', { token: admin.token }));
  expect(res.status).toBe(200);
  const { data } = await json(res);

  const byCode = Object.fromEntries(data.map((c: { code: string; status: string }) => [c.code, c.status]));
  expect(byCode['SEEDCODE']).toBe('active');
  expect(byCode['USEDCODE']).toBe('used');
  expect(byCode['REVOKEDCO']).toBe('revoked');
  expect(byCode['EXPIREDCO']).toBe('expired');
});

// ── 6. Non-admin cannot list codes ───────────────────────────────────────────

it('non-admin cannot list invite codes', async () => {
  const member = await createUser({ role: 'member' });
  const res = await getCodes(req('GET', '/api/invite-codes', { token: member.token }));
  expect(res.status).toBe(403);
});

// ── 7. Admin revokes an active code ──────────────────────────────────────────

it('admin revokes an active code', async () => {
  await seedCode();
  const admin = await createUser({ role: 'admin' });
  const res = await deleteCode(
    req('DELETE', '/api/invite-codes/SEEDCODE', { token: admin.token }),
    { params: Promise.resolve({ code: 'SEEDCODE' }) }
  );
  expect(res.status).toBe(200);
  expect((await json(res)).data).toMatchObject({ code: 'SEEDCODE', status: 'revoked' });

  const doc = await InviteCode.findOne({ code: 'SEEDCODE' });
  expect(doc?.revokedAt).toBeDefined();
});

// ── 8. Cannot revoke an already-used code ────────────────────────────────────

it('cannot revoke a code that has already been used', async () => {
  await seedCode({ usedAt: new Date() });
  const admin = await createUser({ role: 'admin' });
  const res = await deleteCode(
    req('DELETE', '/api/invite-codes/SEEDCODE', { token: admin.token }),
    { params: Promise.resolve({ code: 'SEEDCODE' }) }
  );
  expect(res.status).toBe(400);
});

// ── 9. Cannot revoke a non-existent code ─────────────────────────────────────

it('returns 404 when revoking a code that does not exist', async () => {
  const admin = await createUser({ role: 'admin' });
  const res = await deleteCode(
    req('DELETE', '/api/invite-codes/NOTREAL1', { token: admin.token }),
    { params: Promise.resolve({ code: 'NOTREAL1' }) }
  );
  expect(res.status).toBe(404);
});

// ── 10. Non-admin cannot revoke ───────────────────────────────────────────────

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
