/**
 * Admin years journey tests
 *
 * Covered:
 *   1.  Admin gets a list of distinct years sorted descending
 *   2.  Returns empty array when no OKR pages exist
 *   3.  Each year appears only once (deduplication across teams)
 *   4.  Non-admin (member) cannot access — 403
 *   5.  Unauthenticated request returns 403
 *   6.  Cross-tenant isolation — only years for the requesting tenant are returned
 */
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { req, json } from '../helpers/request';
import {
  createUser,
  createOrg,
  createTeam,
  createOKRPage,
} from '../helpers/fixtures';

import { GET as getYears } from '@/app/api/admin/years/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

// ── 1. Admin gets distinct years sorted desc ──────────────────────────────────

it('admin gets distinct years sorted descending', async () => {
  const admin = await createUser({ role: 'admin' });
  const { orgId } = await createOrg('Org', admin.tenantId);
  const { teamId } = await createTeam(orgId, 'Team', admin.tenantId);
  await createOKRPage(teamId, { year: 2023, type: 'annual', tenantId: admin.tenantId });
  await createOKRPage(teamId, { year: 2025, type: 'annual', tenantId: admin.tenantId });
  await createOKRPage(teamId, { year: 2024, type: 'annual', tenantId: admin.tenantId });

  const res = await getYears(req('GET', '/api/admin/years', { token: admin.token }));
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data).toEqual([2025, 2024, 2023]);
});

// ── 2. Empty array when no pages exist ───────────────────────────────────────

it('returns empty array when no OKR pages exist', async () => {
  const admin = await createUser({ role: 'admin' });
  const res = await getYears(req('GET', '/api/admin/years', { token: admin.token }));
  expect(res.status).toBe(200);
  expect((await json(res)).data).toEqual([]);
});

// ── 3. Duplicate years collapsed ─────────────────────────────────────────────

it('same year across multiple teams appears only once', async () => {
  const admin = await createUser({ role: 'admin' });
  const { orgId } = await createOrg('Org', admin.tenantId);
  const { teamId: t1 } = await createTeam(orgId, 'Team 1', admin.tenantId);
  const { teamId: t2 } = await createTeam(orgId, 'Team 2', admin.tenantId);
  await createOKRPage(t1, { year: 2025, type: 'annual', tenantId: admin.tenantId });
  await createOKRPage(t2, { year: 2025, type: 'annual', tenantId: admin.tenantId });

  const res = await getYears(req('GET', '/api/admin/years', { token: admin.token }));
  const { data } = await json(res);
  expect(data).toEqual([2025]);
});

// ── 4. Member cannot access ───────────────────────────────────────────────────

it('non-admin member cannot access the years endpoint', async () => {
  const member = await createUser({ role: 'member' });
  const res = await getYears(req('GET', '/api/admin/years', { token: member.token }));
  expect(res.status).toBe(403);
});

// ── 5. Unauthenticated returns 403 ────────────────────────────────────────────

it('unauthenticated request returns 403', async () => {
  const res = await getYears(req('GET', '/api/admin/years'));
  expect(res.status).toBe(403);
});

// ── 6. Cross-tenant isolation ─────────────────────────────────────────────────

it("does not return years from another tenant's OKR pages", async () => {
  const adminA = await createUser({ role: 'admin' });
  const adminB = await createUser({ role: 'admin' });

  const { orgId } = await createOrg('Org B', adminB.tenantId);
  const { teamId } = await createTeam(orgId, 'Team B', adminB.tenantId);
  await createOKRPage(teamId, { year: 2025, type: 'annual', tenantId: adminB.tenantId });

  // adminA's tenant has no pages
  const res = await getYears(req('GET', '/api/admin/years', { token: adminA.token }));
  expect(res.status).toBe(200);
  expect((await json(res)).data).toEqual([]);
});
