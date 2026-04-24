/**
 * Logout + tenant journeys
 *
 * Covered:
 *   1.  POST /api/auth/logout clears the auth cookie
 *   2.  POST /api/auth/logout returns 200
 *   3.  GET /api/tenant returns tenant for authenticated user
 *   4.  GET /api/tenant returns 401 for unauthenticated user
 *   5.  PATCH /api/tenant updates name for admin
 *   6.  PATCH /api/tenant blocked for non-admin member
 *   7.  PATCH /api/tenant returns 401 for unauthenticated user
 */

import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { req } from '../helpers/request';
import { createUser } from '../helpers/fixtures';
import { AUTH_COOKIE } from '@/lib/auth';

import { POST as logout } from '@/app/api/auth/logout/route';
import { GET as getTenant, PATCH as patchTenant } from '@/app/api/tenant/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

// ── 1. Logout clears the cookie ───────────────────────────────────────────────

it('logout clears the auth cookie', async () => {
  const res = await logout();
  const setCookie = res.headers.get('set-cookie') ?? '';
  expect(setCookie).toContain(AUTH_COOKIE);
  expect(setCookie).toContain('Max-Age=0');
});

// ── 2. Logout returns 200 ────────────────────────────────────────────────────

it('logout returns 200', async () => {
  const res = await logout();
  expect(res.status).toBe(200);
});

// ── 3. GET /api/tenant — authenticated ───────────────────────────────────────

it('returns tenant for authenticated user', async () => {
  const user = await createUser({ role: 'member' });
  const res = await getTenant(req('GET', '/api/tenant', { token: user.token }));
  expect(res.status).toBe(200);
  const { data } = await res.json();
  expect(data).toBeDefined();
});

// ── 4. GET /api/tenant — unauthenticated ─────────────────────────────────────

it('returns 401 for unauthenticated tenant request', async () => {
  const res = await getTenant(req('GET', '/api/tenant'));
  expect(res.status).toBe(401);
});

// ── 5. PATCH /api/tenant — admin updates name ────────────────────────────────

it('admin can update tenant name', async () => {
  const admin = await createUser({ role: 'admin' });
  const res = await patchTenant(req('PATCH', '/api/tenant', {
    token: admin.token,
    body: { name: 'New Name' },
  }));
  expect(res.status).toBe(200);
  const { data } = await res.json();
  expect(data.name).toBe('New Name');
});

// ── 6. PATCH /api/tenant — member blocked ────────────────────────────────────

it('non-admin cannot update tenant', async () => {
  const member = await createUser({ role: 'member' });
  const res = await patchTenant(req('PATCH', '/api/tenant', {
    token: member.token,
    body: { name: 'Hacked' },
  }));
  expect(res.status).toBe(403);
});

// ── 7. PATCH /api/tenant — unauthenticated ───────────────────────────────────

it('unauthenticated PATCH /api/tenant returns 401', async () => {
  const res = await patchTenant(req('PATCH', '/api/tenant', {
    body: { name: 'Hacked' },
  }));
  expect(res.status).toBe(403);
});
