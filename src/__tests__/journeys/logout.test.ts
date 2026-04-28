/**
 * Logout journeys
 *
 * Covered:
 *   1.  POST /api/auth/logout clears the auth cookie
 *   2.  POST /api/auth/logout returns 200
 */

import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { AUTH_COOKIE } from '@/lib/auth';

import { POST as logout } from '@/app/api/auth/logout/route';

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
