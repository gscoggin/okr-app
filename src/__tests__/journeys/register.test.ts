/**
 * Registration journeys
 *
 * Covered:
 *   1. Successful registration creates user, tenant, and consumes invite code
 *   2. Duplicate email returns 409
 *   3. Missing required fields return 400
 *   4. Short password returns 400
 *   5. No invite code supplied returns 403
 *   6. Non-existent code returns 403
 *   7. Already-used code returns 403
 *   8. Expired code returns 403
 *   9. Revoked code returns 403
 */
import mongoose from 'mongoose';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { req, json } from '../helpers/request';
import User from '@/models/User';
import Tenant from '@/models/Tenant';
import InviteCode from '@/models/InviteCode';

import { POST as register } from '@/app/api/auth/register/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

const validBody = {
  name: 'Alice',
  email: 'alice@example.com',
  password: 'securePass1!',
  companyName: 'Acme Corp',
};

// Helper — creates a valid invite code in the DB
async function makeCode(overrides: Partial<{ usedAt: Date; revokedAt: Date; expiresAt: Date }> = {}) {
  const expiresAt = overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return InviteCode.create({
    code: 'TESTCODE',
    createdBy: new mongoose.Types.ObjectId(),
    expiresAt,
    ...overrides,
  });
}

// ── 1. Successful registration ────────────────────────────────────────────────

it('registers a new user, creates a tenant, and consumes the invite code', async () => {
  await makeCode();
  const res = await register(req('POST', '/api/auth/register', { body: { ...validBody, inviteCode: 'TESTCODE' } }));
  expect(res.status).toBe(201);

  const { data } = await json(res);
  expect(data).toMatchObject({ name: 'Alice', email: 'alice@example.com', role: 'tenant_owner' });
  expect(data.tenantId).toBeDefined();
  expect(data.tenantName).toBe('Acme Corp');

  expect(await User.countDocuments()).toBe(1);
  expect(await Tenant.countDocuments()).toBe(1);

  const code = await InviteCode.findOne({ code: 'TESTCODE' });
  expect(code?.usedAt).toBeDefined();
  expect(code?.usedBy).toBeDefined();
});

// ── 2. Duplicate email ────────────────────────────────────────────────────────

it('returns 409 when email is already registered', async () => {
  await makeCode();
  await InviteCode.create({
    code: 'TESTCODE2',
    createdBy: new mongoose.Types.ObjectId(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  await register(req('POST', '/api/auth/register', { body: { ...validBody, inviteCode: 'TESTCODE' } }));
  const res = await register(req('POST', '/api/auth/register', { body: { ...validBody, inviteCode: 'TESTCODE2' } }));
  expect(res.status).toBe(409);
  expect((await json(res)).error).toMatch(/already in use/i);
});

// ── 3. Missing required fields ────────────────────────────────────────────────

it('returns 400 when name is missing', async () => {
  await makeCode();
  const { name: _, ...body } = validBody;
  const res = await register(req('POST', '/api/auth/register', { body: { ...body, inviteCode: 'TESTCODE' } }));
  expect(res.status).toBe(400);
});

it('returns 400 when companyName is missing', async () => {
  await makeCode();
  const { companyName: _, ...body } = validBody;
  const res = await register(req('POST', '/api/auth/register', { body: { ...body, inviteCode: 'TESTCODE' } }));
  expect(res.status).toBe(400);
});

// ── 4. Short password ─────────────────────────────────────────────────────────

it('returns 400 when password is too short', async () => {
  await makeCode();
  const res = await register(
    req('POST', '/api/auth/register', { body: { ...validBody, inviteCode: 'TESTCODE', password: 'short' } })
  );
  expect(res.status).toBe(400);
  expect((await json(res)).error).toMatch(/8 characters/i);
});

// ── 5. No code supplied ───────────────────────────────────────────────────────

it('returns 403 when no invite code is supplied', async () => {
  const res = await register(req('POST', '/api/auth/register', { body: validBody }));
  expect(res.status).toBe(403);
  expect((await json(res)).error).toMatch(/invite code/i);
});

// ── 6. Non-existent code ──────────────────────────────────────────────────────

it('returns 403 when invite code does not exist', async () => {
  const res = await register(
    req('POST', '/api/auth/register', { body: { ...validBody, inviteCode: 'NOTREAL1' } })
  );
  expect(res.status).toBe(403);
  expect((await json(res)).error).toMatch(/not found/i);
  expect(await User.countDocuments()).toBe(0);
});

// ── 7. Already-used code ──────────────────────────────────────────────────────

it('returns 403 when invite code has already been used', async () => {
  await makeCode({ usedAt: new Date() });
  const res = await register(
    req('POST', '/api/auth/register', { body: { ...validBody, inviteCode: 'TESTCODE' } })
  );
  expect(res.status).toBe(403);
  expect((await json(res)).error).toMatch(/already been used/i);
});

// ── 8. Expired code ───────────────────────────────────────────────────────────

it('returns 403 when invite code has expired', async () => {
  await makeCode({ expiresAt: new Date(Date.now() - 1000) });
  const res = await register(
    req('POST', '/api/auth/register', { body: { ...validBody, inviteCode: 'TESTCODE' } })
  );
  expect(res.status).toBe(403);
  expect((await json(res)).error).toMatch(/expired/i);
});

// ── 9. Revoked code ───────────────────────────────────────────────────────────

it('returns 403 when invite code has been revoked', async () => {
  await makeCode({ revokedAt: new Date() });
  const res = await register(
    req('POST', '/api/auth/register', { body: { ...validBody, inviteCode: 'TESTCODE' } })
  );
  expect(res.status).toBe(403);
  expect((await json(res)).error).toMatch(/revoked/i);
});
