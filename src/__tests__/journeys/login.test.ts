/**
 * Login journey tests
 *
 * Covered:
 *   1.  Valid credentials return 200 with user data
 *   2.  Valid credentials set the auth cookie
 *   3.  Token in the cookie contains correct role and tenantId
 *   4.  Wrong password returns 401
 *   5.  Unknown email returns 401 (same message — no enumeration)
 *   6.  Missing email returns 400
 *   7.  Missing password returns 400
 *   8.  Email lookup is case-insensitive
 *   9.  Response includes teamMemberships
 */
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { req, json } from '../helpers/request';
import { createUser, addTeamMember, createOrg, createTeam } from '../helpers/fixtures';
import { verifyToken, AUTH_COOKIE } from '@/lib/auth';

import { POST as login } from '@/app/api/auth/login/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

// ── 1. Valid credentials return 200 ──────────────────────────────────────────

it('valid credentials return 200 with user data', async () => {
  const user = await createUser({ email: 'alice@example.com', password: 'password123', role: 'admin' });
  const res = await login(req('POST', '/api/auth/login', {
    body: { email: 'alice@example.com', password: 'password123' },
  }));
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data.user).toMatchObject({
    email: 'alice@example.com',
    role: 'admin',
    tenantId: user.tenantId,
  });
});

// ── 2. Auth cookie is set ─────────────────────────────────────────────────────

it('sets the auth cookie on successful login', async () => {
  await createUser({ email: 'alice@example.com', password: 'password123' });
  const res = await login(req('POST', '/api/auth/login', {
    body: { email: 'alice@example.com', password: 'password123' },
  }));
  const setCookie = res.headers.get('set-cookie') ?? '';
  expect(setCookie).toContain(AUTH_COOKIE);
});

// ── 3. Token payload is correct ───────────────────────────────────────────────

it('cookie token contains correct role and tenantId', async () => {
  const user = await createUser({ email: 'bob@example.com', password: 'pass1234', role: 'tenant_owner' });
  const res = await login(req('POST', '/api/auth/login', {
    body: { email: 'bob@example.com', password: 'pass1234' },
  }));
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(new RegExp(`${AUTH_COOKIE}=([^;]+)`));
  const payload = match ? verifyToken(match[1]) : null;
  expect(payload?.role).toBe('tenant_owner');
  expect(payload?.tenantId).toBe(user.tenantId);
});

// ── 4. Wrong password returns 401 ─────────────────────────────────────────────

it('wrong password returns 401', async () => {
  await createUser({ email: 'alice@example.com', password: 'password123' });
  const res = await login(req('POST', '/api/auth/login', {
    body: { email: 'alice@example.com', password: 'wrongpassword' },
  }));
  expect(res.status).toBe(401);
  expect((await json(res)).error).toMatch(/invalid credentials/i);
});

// ── 5. Unknown email returns 401 (no enumeration) ─────────────────────────────

it('unknown email returns 401 with the same message as wrong password', async () => {
  const res = await login(req('POST', '/api/auth/login', {
    body: { email: 'nobody@example.com', password: 'password123' },
  }));
  expect(res.status).toBe(401);
  expect((await json(res)).error).toMatch(/invalid credentials/i);
});

// ── 6. Missing email returns 400 ──────────────────────────────────────────────

it('missing email returns 400', async () => {
  const res = await login(req('POST', '/api/auth/login', {
    body: { password: 'password123' },
  }));
  expect(res.status).toBe(400);
});

// ── 7. Missing password returns 400 ──────────────────────────────────────────

it('missing password returns 400', async () => {
  const res = await login(req('POST', '/api/auth/login', {
    body: { email: 'alice@example.com' },
  }));
  expect(res.status).toBe(400);
});

// ── 8. Email lookup is case-insensitive ───────────────────────────────────────

it('email lookup is case-insensitive', async () => {
  await createUser({ email: 'alice@example.com', password: 'password123' });
  const res = await login(req('POST', '/api/auth/login', {
    body: { email: 'ALICE@EXAMPLE.COM', password: 'password123' },
  }));
  expect(res.status).toBe(200);
});

// ── 9. Response includes teamMemberships ──────────────────────────────────────

it('response includes teamMemberships', async () => {
  const user = await createUser({ role: 'member' });
  const { orgId } = await createOrg('Org', user.tenantId);
  const { teamId } = await createTeam(orgId, 'Team', user.tenantId);
  await addTeamMember(teamId, user.userId, 'owner');

  const res = await login(req('POST', '/api/auth/login', {
    body: { email: user.email, password: user.password },
  }));
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data.user.teamMemberships).toHaveLength(1);
  expect(data.user.teamMemberships[0]).toMatchObject({ teamId, role: 'owner' });
});
