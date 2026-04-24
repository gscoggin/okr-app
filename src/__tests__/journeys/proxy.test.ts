/**
 * Proxy (middleware) journeys
 *
 * Covered:
 *   1.  Unauthenticated request to protected route redirects to /login (prod)
 *   2.  Unauthenticated request to protected route redirects to /demo (demo deployment)
 *   3.  Authenticated request passes through
 *   4.  /login is allowed without a token (public path)
 *   5.  /register is allowed without a token
 *   6.  /forgot-password is allowed without a token
 *   7.  /reset-password is allowed without a token
 *   8.  /demo is allowed without a token
 *   9.  /api/auth/login is allowed without a token
 *   10. /api/demo/session is allowed without a token
 *   11. /_next/static paths pass through
 *   12. /api/ routes (non-public) pass through regardless of token
 */

import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { signToken } from '@/lib/auth';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-chars-key!';
});

function makeReq(path: string, token?: string): NextRequest {
  const url = new URL(path, 'https://example.com');
  const headers: Record<string, string> = {};
  if (token) headers['cookie'] = `okr_token=${token}`;
  return new NextRequest(url, { headers });
}

function validToken() {
  return signToken({
    userId: 'abc',
    tenantId: 'def',
    name: 'Test',
    email: 'test@test.com',
    role: 'member',
    teamMemberships: [],
  });
}

// ── 1. Unauthenticated → /login on prod ──────────────────────────────────────

it('unauthenticated request redirects to /login on prod', () => {
  delete process.env.IS_DEMO_DEPLOYMENT;
  const res = proxy(makeReq('/'));
  expect(res?.status).toBe(307);
  expect(res?.headers.get('location')).toContain('/login');
});

// ── 2. Unauthenticated → /demo on demo deployment ────────────────────────────

it('unauthenticated request redirects to /demo on demo deployment', () => {
  process.env.IS_DEMO_DEPLOYMENT = 'true';
  const res = proxy(makeReq('/'));
  expect(res?.status).toBe(307);
  expect(res?.headers.get('location')).toContain('/demo');
  delete process.env.IS_DEMO_DEPLOYMENT;
});

// ── 3. Authenticated request passes through ──────────────────────────────────

it('authenticated request passes through', () => {
  const res = proxy(makeReq('/', validToken()));
  expect(res?.status).not.toBe(307);
});

// ── 4–8. Public paths allowed without token ──────────────────────────────────

it.each([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/demo',
])('allows %s without a token', (path) => {
  const res = proxy(makeReq(path));
  expect(res?.status).not.toBe(307);
});

// ── 9–10. Public API paths allowed without token ─────────────────────────────

it.each([
  '/api/auth/login',
  '/api/demo/session',
])('allows %s without a token', (path) => {
  const res = proxy(makeReq(path));
  expect(res?.status).not.toBe(307);
});

// ── 11. _next/static passes through ──────────────────────────────────────────

it('allows _next/static paths without a token', () => {
  const res = proxy(makeReq('/_next/static/chunk.js'));
  expect(res?.status).not.toBe(307);
});

// ── 12. API routes pass through regardless of token ──────────────────────────

it('passes /api/ routes through without redirecting', () => {
  const res = proxy(makeReq('/api/objectives'));
  expect(res?.status).not.toBe(307);
});
