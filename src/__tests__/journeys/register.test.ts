/**
 * Registration journeys
 *
 * Covered:
 *   1.  workspace_create code: registers user, creates tenant, consumes code
 *   2.  workspace_join code: adds user as member to existing tenant, consumes code
 *   3.  workspace_join code: companyName is ignored
 *   4.  workspace_join code: returns 404 if tenantId points to missing tenant
 *   5.  Duplicate email returns 409
 *   6.  Missing name/email/password returns 400
 *   7.  workspace_create code: missing companyName returns 400
 *   8.  Short password returns 400
 *   9.  No invite code supplied returns 403
 *   10. Non-existent code returns 403
 *   11. Already-used code returns 403
 *   12. Expired code returns 403
 *   13. Revoked code returns 403
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

async function makeCreateCode(overrides: Partial<{ usedAt: Date; revokedAt: Date; expiresAt: Date }> = {}) {
  return InviteCode.create({
    code: 'TESTCODE',
    type: 'workspace_create',
    createdBy: new mongoose.Types.ObjectId(),
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ...overrides,
  });
}

async function makeJoinCode(tenantId: mongoose.Types.ObjectId, overrides: Partial<{ usedAt: Date; revokedAt: Date; expiresAt: Date }> = {}) {
  return InviteCode.create({
    code: 'JOINCODE',
    type: 'workspace_join',
    createdBy: new mongoose.Types.ObjectId(),
    tenantId,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ...overrides,
  });
}

// ── 1. workspace_create: new tenant + tenant_owner ────────────────────────────

it('workspace_create code registers user, creates tenant, and consumes code', async () => {
  await makeCreateCode();
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

// ── 2. workspace_join: adds member to existing tenant ────────────────────────

it('workspace_join code adds user as member to existing tenant', async () => {
  const tenant = await Tenant.create({
    name: 'Join Corp',
    slug: 'join-corp',
    ownerId: new mongoose.Types.ObjectId(),
    branding: {},
  });
  await makeJoinCode(tenant._id);

  const res = await register(req('POST', '/api/auth/register', {
    body: { name: 'Bob', email: 'bob@example.com', password: 'securePass1!', inviteCode: 'JOINCODE' },
  }));
  expect(res.status).toBe(201);

  const { data } = await json(res);
  expect(data.role).toBe('member');
  expect(data.tenantId).toBe(tenant._id.toString());
  expect(data.tenantName).toBe('Join Corp');

  const user = await User.findOne({ email: 'bob@example.com' });
  expect(user?.tenantId.toString()).toBe(tenant._id.toString());

  const code = await InviteCode.findOne({ code: 'JOINCODE' });
  expect(code?.usedAt).toBeDefined();
});

// ── 3. workspace_join: companyName is ignored ─────────────────────────────────

it('workspace_join code ignores companyName and does not create a new tenant', async () => {
  const tenant = await Tenant.create({
    name: 'Existing Co',
    slug: 'existing-co',
    ownerId: new mongoose.Types.ObjectId(),
    branding: {},
  });
  await makeJoinCode(tenant._id);

  const res = await register(req('POST', '/api/auth/register', {
    body: { name: 'Carol', email: 'carol@example.com', password: 'securePass1!', companyName: 'Ignored Name', inviteCode: 'JOINCODE' },
  }));
  expect(res.status).toBe(201);
  expect(await Tenant.countDocuments()).toBe(1);
  expect((await json(res)).data.tenantName).toBe('Existing Co');
});

// ── 4. workspace_join: 404 if tenant no longer exists ────────────────────────

it('workspace_join code returns 404 if linked tenant is missing', async () => {
  await makeJoinCode(new mongoose.Types.ObjectId());
  const res = await register(req('POST', '/api/auth/register', {
    body: { name: 'Dave', email: 'dave@example.com', password: 'securePass1!', inviteCode: 'JOINCODE' },
  }));
  expect(res.status).toBe(404);
});

// ── 5. Duplicate email ────────────────────────────────────────────────────────

it('returns 409 when email is already registered', async () => {
  await makeCreateCode();
  await InviteCode.create({
    code: 'TESTCODE2',
    type: 'workspace_create',
    createdBy: new mongoose.Types.ObjectId(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  await register(req('POST', '/api/auth/register', { body: { ...validBody, inviteCode: 'TESTCODE' } }));
  const res = await register(req('POST', '/api/auth/register', { body: { ...validBody, inviteCode: 'TESTCODE2' } }));
  expect(res.status).toBe(409);
  expect((await json(res)).error).toMatch(/already in use/i);
});

// ── 6. Missing required fields ────────────────────────────────────────────────

it('returns 400 when name is missing', async () => {
  await makeCreateCode();
  const { name: _, ...body } = validBody;
  const res = await register(req('POST', '/api/auth/register', { body: { ...body, inviteCode: 'TESTCODE' } }));
  expect(res.status).toBe(400);
});

// ── 7. workspace_create: companyName required ─────────────────────────────────

it('returns 400 when companyName is missing for workspace_create code', async () => {
  await makeCreateCode();
  const { companyName: _, ...body } = validBody;
  const res = await register(req('POST', '/api/auth/register', { body: { ...body, inviteCode: 'TESTCODE' } }));
  expect(res.status).toBe(400);
});

// ── 8. Short password ─────────────────────────────────────────────────────────

it('returns 400 when password is too short', async () => {
  await makeCreateCode();
  const res = await register(
    req('POST', '/api/auth/register', { body: { ...validBody, inviteCode: 'TESTCODE', password: 'short' } })
  );
  expect(res.status).toBe(400);
  expect((await json(res)).error).toMatch(/8 characters/i);
});

// ── 9. No code supplied ───────────────────────────────────────────────────────

it('returns 403 when no invite code is supplied', async () => {
  const res = await register(req('POST', '/api/auth/register', { body: validBody }));
  expect(res.status).toBe(403);
  expect((await json(res)).error).toMatch(/invite code/i);
});

// ── 10. Non-existent code ─────────────────────────────────────────────────────

it('returns 403 when invite code does not exist', async () => {
  const res = await register(
    req('POST', '/api/auth/register', { body: { ...validBody, inviteCode: 'NOTREAL1' } })
  );
  expect(res.status).toBe(403);
  expect((await json(res)).error).toMatch(/not found/i);
  expect(await User.countDocuments()).toBe(0);
});

// ── 11. Already-used code ─────────────────────────────────────────────────────

it('returns 403 when invite code has already been used', async () => {
  await makeCreateCode({ usedAt: new Date() });
  const res = await register(
    req('POST', '/api/auth/register', { body: { ...validBody, inviteCode: 'TESTCODE' } })
  );
  expect(res.status).toBe(403);
  expect((await json(res)).error).toMatch(/already been used/i);
});

// ── 12. Expired code ──────────────────────────────────────────────────────────

it('returns 403 when invite code has expired', async () => {
  await makeCreateCode({ expiresAt: new Date(Date.now() - 1000) });
  const res = await register(
    req('POST', '/api/auth/register', { body: { ...validBody, inviteCode: 'TESTCODE' } })
  );
  expect(res.status).toBe(403);
  expect((await json(res)).error).toMatch(/expired/i);
});

// ── 13. Revoked code ──────────────────────────────────────────────────────────

it('returns 403 when invite code has been revoked', async () => {
  await makeCreateCode({ revokedAt: new Date() });
  const res = await register(
    req('POST', '/api/auth/register', { body: { ...validBody, inviteCode: 'TESTCODE' } })
  );
  expect(res.status).toBe(403);
  expect((await json(res)).error).toMatch(/revoked/i);
});
