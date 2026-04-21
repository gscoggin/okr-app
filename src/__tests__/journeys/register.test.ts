/**
 * Registration journeys
 *
 * Covered:
 *   1. Successful registration creates user and tenant
 *   2. Duplicate email returns 409
 *   3. Missing required fields return 400
 *   4. Short password returns 400
 *   5. Invite code gate blocks wrong code
 *   6. Invite code gate allows correct code
 *   7. Invite code gate skipped when REGISTRATION_CODE is unset
 */
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { req, json } from '../helpers/request';
import User from '@/models/User';
import Tenant from '@/models/Tenant';

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

// ── 1. Successful registration ────────────────────────────────────────────────

it('registers a new user and creates a tenant', async () => {
  const res = await register(req('POST', '/api/auth/register', { body: validBody }));
  expect(res.status).toBe(201);

  const { data } = await json(res);
  expect(data).toMatchObject({ name: 'Alice', email: 'alice@example.com', role: 'tenant_owner' });
  expect(data.tenantId).toBeDefined();
  expect(data.tenantName).toBe('Acme Corp');

  expect(await User.countDocuments()).toBe(1);
  expect(await Tenant.countDocuments()).toBe(1);
});

// ── 2. Duplicate email ────────────────────────────────────────────────────────

it('returns 409 when email is already registered', async () => {
  await register(req('POST', '/api/auth/register', { body: validBody }));
  const res = await register(req('POST', '/api/auth/register', { body: validBody }));
  expect(res.status).toBe(409);
  expect((await json(res)).error).toMatch(/already in use/i);
});

// ── 3. Missing required fields ────────────────────────────────────────────────

it('returns 400 when name is missing', async () => {
  const { name: _, ...body } = validBody;
  const res = await register(req('POST', '/api/auth/register', { body }));
  expect(res.status).toBe(400);
});

it('returns 400 when companyName is missing', async () => {
  const { companyName: _, ...body } = validBody;
  const res = await register(req('POST', '/api/auth/register', { body }));
  expect(res.status).toBe(400);
});

// ── 4. Short password ─────────────────────────────────────────────────────────

it('returns 400 when password is too short', async () => {
  const res = await register(
    req('POST', '/api/auth/register', { body: { ...validBody, password: 'short' } })
  );
  expect(res.status).toBe(400);
  expect((await json(res)).error).toMatch(/8 characters/i);
});

// ── 5. Invite code gate — wrong code ─────────────────────────────────────────

it('returns 403 when invite code is wrong', async () => {
  const original = process.env.REGISTRATION_CODE;
  process.env.REGISTRATION_CODE = 'CORRECT_CODE';

  try {
    const res = await register(
      req('POST', '/api/auth/register', { body: { ...validBody, inviteCode: 'WRONG_CODE' } })
    );
    expect(res.status).toBe(403);
    expect((await json(res)).error).toMatch(/invite code/i);
    expect(await User.countDocuments()).toBe(0);
  } finally {
    if (original === undefined) delete process.env.REGISTRATION_CODE;
    else process.env.REGISTRATION_CODE = original;
  }
});

// ── 6. Invite code gate — correct code ───────────────────────────────────────

it('allows registration with the correct invite code', async () => {
  const original = process.env.REGISTRATION_CODE;
  process.env.REGISTRATION_CODE = 'CORRECT_CODE';

  try {
    const res = await register(
      req('POST', '/api/auth/register', { body: { ...validBody, inviteCode: 'CORRECT_CODE' } })
    );
    expect(res.status).toBe(201);
    expect(await User.countDocuments()).toBe(1);
  } finally {
    if (original === undefined) delete process.env.REGISTRATION_CODE;
    else process.env.REGISTRATION_CODE = original;
  }
});

// ── 7. Invite code gate — unset env var ──────────────────────────────────────

it('skips invite code check when REGISTRATION_CODE is not set', async () => {
  const original = process.env.REGISTRATION_CODE;
  delete process.env.REGISTRATION_CODE;

  try {
    const res = await register(req('POST', '/api/auth/register', { body: validBody }));
    expect(res.status).toBe(201);
  } finally {
    if (original !== undefined) process.env.REGISTRATION_CODE = original;
  }
});
