/**
 * Demo journeys
 *
 * Session (GET /api/demo/session):
 *   1.  Returns 404 when IS_DEMO_DEPLOYMENT is not set
 *   2.  Auto-seeds and returns a token when demo tenant does not exist
 *   3.  Returns a token when demo tenant already exists (no re-seed)
 *   4.  Response sets an httpOnly cookie with the token
 *   5.  Returned token carries isDemo: true
 *   6.  Rate limit blocks excessive requests from the same IP
 *
 * Seed (POST /api/demo/seed):
 *   7.  Admin can run the demo seed
 *   8.  Non-admin blocked
 *   9.  Unauthenticated blocked
 *
 * Request access (POST /api/demo/request-access):
 *   10. Happy path stores request
 *   11. Honeypot silently drops request
 *   12. Deduplicates pending email
 *   13. Rejects missing name
 *   14. Rejects invalid email
 *
 * Write protection — demo token blocks all mutations:
 *   15. POST /api/objectives — demo user blocked (403)
 *   16. PATCH /api/objectives/[objectiveId] — demo user blocked
 *   17. DELETE /api/objectives/[objectiveId] — demo user blocked
 *   18. POST /api/key-results — demo user blocked
 *   19. PATCH /api/key-results/[krId] — demo user blocked
 *   20. DELETE /api/key-results/[krId] — demo user blocked
 *   21. PATCH /api/okr-pages/[pageId] — demo user blocked
 *   22. Regular member (isDemo: false) is NOT blocked
 */

import mongoose from 'mongoose';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { req } from '../helpers/request';
import { createUser, createOrg, createTeam, createOKRPage } from '../helpers/fixtures';
import { verifyToken, AUTH_COOKIE, signDemoToken } from '@/lib/auth';
import Tenant from '@/models/Tenant';
import User from '@/models/User';
import AccessRequest from '@/models/AccessRequest';

import { GET as getSession } from '@/app/api/demo/session/route';
import { POST as postSeed } from '@/app/api/demo/seed/route';
import { POST as postRequestAccess } from '@/app/api/demo/request-access/route';
import { POST as postObjective } from '@/app/api/objectives/route';
import { PATCH as patchObjective, DELETE as deleteObjective } from '@/app/api/objectives/[objectiveId]/route';
import { POST as postKR } from '@/app/api/key-results/route';
import { PATCH as patchKR, DELETE as deleteKR } from '@/app/api/key-results/[krId]/route';
import { PATCH as patchPage } from '@/app/api/okr-pages/[pageId]/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

// ── Helpers ───────────────────────────────────────────────────────────────────

function demoReq(ip = '1.2.3.4') {
  const r = req('GET', '/api/demo/session');
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

async function makeDemoToken(tenantId: string) {
  return signDemoToken({
    userId: new mongoose.Types.ObjectId().toString(),
    tenantId,
    name: 'Demo User',
    email: 'demo@demo.local',
    role: 'member',
    teamMemberships: [],
  });
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

// ── 15. POST /api/objectives ─────────────────────────────────────────────────

it('demo user cannot create an objective', async () => {
  const { orgId, tenantId } = await createOrg();
  void orgId;
  const token = await makeDemoToken(tenantId);
  const res = await postObjective(req('POST', '/api/objectives', {
    token,
    body: { okrPageId: new mongoose.Types.ObjectId().toString(), title: 'Test' },
  }));
  expect(res.status).toBe(403);
});

// ── 16. PATCH /api/objectives/[objectiveId] ───────────────────────────────────

it('demo user cannot update an objective', async () => {
  const { tenantId } = await createOrg();
  const token = await makeDemoToken(tenantId);
  const objectiveId = new mongoose.Types.ObjectId().toString();
  const res = await patchObjective(
    req('PATCH', `/api/objectives/${objectiveId}`, { token, body: { title: 'Updated' } }),
    { params: Promise.resolve({ objectiveId }) }
  );
  expect(res.status).toBe(403);
});

// ── 17. DELETE /api/objectives/[objectiveId] ──────────────────────────────────

it('demo user cannot delete an objective', async () => {
  const { tenantId } = await createOrg();
  const token = await makeDemoToken(tenantId);
  const objectiveId = new mongoose.Types.ObjectId().toString();
  const res = await deleteObjective(
    req('DELETE', `/api/objectives/${objectiveId}`, { token }),
    { params: Promise.resolve({ objectiveId }) }
  );
  expect(res.status).toBe(403);
});

// ── 18. POST /api/key-results ─────────────────────────────────────────────────

it('demo user cannot create a key result', async () => {
  const { tenantId } = await createOrg();
  const token = await makeDemoToken(tenantId);
  const res = await postKR(req('POST', '/api/key-results', {
    token,
    body: { objectiveId: new mongoose.Types.ObjectId().toString(), title: 'KR' },
  }));
  expect(res.status).toBe(403);
});

// ── 19. PATCH /api/key-results/[krId] ────────────────────────────────────────

it('demo user cannot update a key result', async () => {
  const { tenantId } = await createOrg();
  const token = await makeDemoToken(tenantId);
  const krId = new mongoose.Types.ObjectId().toString();
  const res = await patchKR(
    req('PATCH', `/api/key-results/${krId}`, { token, body: { title: 'Updated' } }),
    { params: Promise.resolve({ krId }) }
  );
  expect(res.status).toBe(403);
});

// ── 20. DELETE /api/key-results/[krId] ───────────────────────────────────────

it('demo user cannot delete a key result', async () => {
  const { tenantId } = await createOrg();
  const token = await makeDemoToken(tenantId);
  const krId = new mongoose.Types.ObjectId().toString();
  const res = await deleteKR(
    req('DELETE', `/api/key-results/${krId}`, { token }),
    { params: Promise.resolve({ krId }) }
  );
  expect(res.status).toBe(403);
});

// ── 21. PATCH /api/okr-pages/[pageId] ────────────────────────────────────────

it('demo user cannot update an OKR page', async () => {
  const { tenantId } = await createOrg();
  const token = await makeDemoToken(tenantId);
  const pageId = new mongoose.Types.ObjectId().toString();
  const res = await patchPage(
    req('PATCH', `/api/okr-pages/${pageId}`, { token, body: { status: 'published' } }),
    { params: Promise.resolve({ pageId }) }
  );
  expect(res.status).toBe(403);
});

// ── 22. Regular member is NOT blocked ────────────────────────────────────────

it('admin user is not blocked by demo write protection', async () => {
  const { orgId, tenantId } = await createOrg();
  const { teamId } = await createTeam(orgId, 'Team', tenantId);
  const admin = await createUser({ role: 'admin', tenantId });
  const { pageId } = await createOKRPage(teamId, { tenantId });
  const res = await postObjective(req('POST', '/api/objectives', {
    token: admin.token,
    body: { okrPageId: pageId, title: 'My Objective' },
  }));
  expect(res.status).not.toBe(403);
});
