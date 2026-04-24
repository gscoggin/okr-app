/**
 * Demo session journeys
 *
 * Covered:
 *   1.  Returns 404 when IS_DEMO_DEPLOYMENT is not set
 *   2.  Auto-seeds and returns a token when demo tenant does not exist
 *   3.  Returns a token when demo tenant already exists (no re-seed)
 *   4.  Response sets an httpOnly cookie with the token
 *   5.  Returned token carries isDemo: true
 *   6.  Rate limit blocks excessive requests from the same IP
 *   7.  POST /api/demo/seed requires admin auth
 *   8.  POST /api/demo/seed blocked for non-admin
 *   9.  POST /api/demo/seed blocked when unauthenticated
 *   10. POST /api/demo/request-access — happy path stores request
 *   11. POST /api/demo/request-access — honeypot silently drops request
 *   12. POST /api/demo/request-access — deduplicates pending email
 *   13. POST /api/demo/request-access — rejects missing name
 *   14. POST /api/demo/request-access — rejects invalid email
 */

import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { req } from '../helpers/request';
import { createUser } from '../helpers/fixtures';
import { verifyToken, AUTH_COOKIE } from '@/lib/auth';
import Tenant from '@/models/Tenant';
import User from '@/models/User';
import AccessRequest from '@/models/AccessRequest';

import { GET as getSession } from '@/app/api/demo/session/route';
import { POST as postSeed } from '@/app/api/demo/seed/route';
import { POST as postRequestAccess } from '@/app/api/demo/request-access/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

// ── Helpers ───────────────────────────────────────────────────────────────────

function demoReq(ip = '1.2.3.4') {
  const r = req('GET', '/api/demo/session');
  // @ts-expect-error — override headers for test
  r.headers.set('x-forwarded-for', ip);
  return r;
}

async function seedDemoTenant() {
  const tenant = await Tenant.create({
    name: 'Acme Demo',
    slug: 'demo-workspace',
    ownerId: new (await import('mongoose')).default.Types.ObjectId(),
    isDemo: true,
  });
  const user = await User.create({
    tenantId: tenant._id,
    name: 'Demo User',
    email: 'demo@demo.local',
    passwordHash: 'x',
    role: 'member',
  });
  return { tenant, user };
}

// ── 1. Returns 404 when IS_DEMO_DEPLOYMENT is not set ─────────────────────────

it('returns 404 when IS_DEMO_DEPLOYMENT is not set', async () => {
  const original = process.env.IS_DEMO_DEPLOYMENT;
  delete process.env.IS_DEMO_DEPLOYMENT;
  const res = await getSession(demoReq());
  expect(res.status).toBe(404);
  process.env.IS_DEMO_DEPLOYMENT = original;
});

// ── 2. Auto-seeds when demo tenant does not exist ────────────────────────────

it('auto-seeds and returns ok:true when demo tenant does not exist', async () => {
  process.env.IS_DEMO_DEPLOYMENT = 'true';
  const res = await getSession(demoReq());
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(await Tenant.findOne({ slug: 'demo-workspace' })).not.toBeNull();
  delete process.env.IS_DEMO_DEPLOYMENT;
});

// ── 3. Returns token when demo tenant already exists ─────────────────────────

it('returns ok:true when demo tenant already exists', async () => {
  process.env.IS_DEMO_DEPLOYMENT = 'true';
  await seedDemoTenant();
  const res = await getSession(demoReq());
  expect(res.status).toBe(200);
  expect((await res.json()).ok).toBe(true);
  delete process.env.IS_DEMO_DEPLOYMENT;
});

// ── 4. Response sets an httpOnly cookie ──────────────────────────────────────

it('sets an httpOnly auth cookie on success', async () => {
  process.env.IS_DEMO_DEPLOYMENT = 'true';
  await seedDemoTenant();
  const res = await getSession(demoReq());
  const setCookie = res.headers.get('set-cookie') ?? '';
  expect(setCookie).toContain(AUTH_COOKIE);
  expect(setCookie).toContain('HttpOnly');
  delete process.env.IS_DEMO_DEPLOYMENT;
});

// ── 5. Token carries isDemo: true ────────────────────────────────────────────

it('issued token has isDemo: true', async () => {
  process.env.IS_DEMO_DEPLOYMENT = 'true';
  await seedDemoTenant();
  const res = await getSession(demoReq());
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(new RegExp(`${AUTH_COOKIE}=([^;]+)`));
  const token = match?.[1];
  expect(token).toBeDefined();
  const payload = verifyToken(token!);
  expect(payload?.isDemo).toBe(true);
  delete process.env.IS_DEMO_DEPLOYMENT;
});

// ── 6. Rate limit blocks excessive requests ──────────────────────────────────

it('rate-limits after 60 requests from the same IP', async () => {
  process.env.IS_DEMO_DEPLOYMENT = 'true';
  await seedDemoTenant();
  const ip = `rate-limit-test-${Date.now()}`;
  for (let i = 0; i < 60; i++) await getSession(demoReq(ip));
  const res = await getSession(demoReq(ip));
  expect(res.status).toBe(429);
  delete process.env.IS_DEMO_DEPLOYMENT;
});

// ── 7. POST /api/demo/seed — admin succeeds ───────────────────────────────────

it('admin can run the demo seed', async () => {
  const admin = await createUser({ role: 'admin' });
  const res = await postSeed(req('POST', '/api/demo/seed', { token: admin.token }));
  expect(res.status).toBe(200);
});

// ── 8. POST /api/demo/seed — non-admin blocked ───────────────────────────────

it('non-admin cannot run the demo seed', async () => {
  const member = await createUser({ role: 'member' });
  const res = await postSeed(req('POST', '/api/demo/seed', { token: member.token }));
  expect(res.status).toBe(403);
});

// ── 9. POST /api/demo/seed — unauthenticated blocked ─────────────────────────

it('unauthenticated request to demo seed returns 401', async () => {
  const res = await postSeed(req('POST', '/api/demo/seed'));
  expect(res.status).toBe(401);
});

// ── 10. Request access — happy path ──────────────────────────────────────────

it('stores a new access request', async () => {
  const res = await postRequestAccess(req('POST', '/api/demo/request-access', {
    body: { name: 'Jane', email: 'jane@example.com', useCase: 'OKRs for my team' },
  }));
  expect(res.status).toBe(201);
  expect(await AccessRequest.countDocuments({ email: 'jane@example.com' })).toBe(1);
});

// ── 11. Request access — honeypot ────────────────────────────────────────────

it('silently drops request when honeypot is filled', async () => {
  const res = await postRequestAccess(req('POST', '/api/demo/request-access', {
    body: { name: 'Bot', email: 'bot@spam.com', _trap: 'gotcha' },
  }));
  expect(res.status).toBe(200);
  expect(await AccessRequest.countDocuments()).toBe(0);
});

// ── 12. Request access — dedup ───────────────────────────────────────────────

it('deduplicates pending access requests for the same email', async () => {
  const body = { name: 'Jane', email: 'jane@example.com' };
  await postRequestAccess(req('POST', '/api/demo/request-access', { body }));
  await postRequestAccess(req('POST', '/api/demo/request-access', { body }));
  expect(await AccessRequest.countDocuments()).toBe(1);
});

// ── 13. Request access — missing name ────────────────────────────────────────

it('rejects access request with missing name', async () => {
  const res = await postRequestAccess(req('POST', '/api/demo/request-access', {
    body: { email: 'jane@example.com' },
  }));
  expect(res.status).toBe(400);
});

// ── 14. Request access — invalid email ───────────────────────────────────────

it('rejects access request with invalid email', async () => {
  const res = await postRequestAccess(req('POST', '/api/demo/request-access', {
    body: { name: 'Jane', email: 'not-an-email' },
  }));
  expect(res.status).toBe(400);
});
