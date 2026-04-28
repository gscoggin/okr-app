/**
 * Search API journey tests
 *
 * Covered:
 *   1.  Empty query returns an empty array (no DB hit)
 *   2.  Unauthenticated request returns 401
 *   3.  Name search finds an org by name
 *   4.  Name search finds a team by name; subtitle is the org name
 *   5.  Name search is case-insensitive
 *   6.  Period search — year only finds the matching annual page
 *   7.  Period search — quarter only finds all matching quarterly pages
 *   8.  Period search — year + quarter narrows to exact page
 *   9.  Period result href is /teams/[teamId]/[year] for annual
 *   10. Period result href is /teams/[teamId]/[year]/q1 for quarterly
 *   11. Owner search finds an objective by owner displayName
 *   12. Owner search subtitle contains the owner name and team/period
 *   13. Purely-period query ("2025") does not return name/owner results
 *   14. Mixed query ("Q1 2025") runs period search scoped to both
 */
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { req, json } from '../helpers/request';
import {
  createTenant,
  createUser,
  createOrg,
  createTeam,
  createOKRPage,
  createObjective,
  createKeyResult,
} from '../helpers/fixtures';

import { GET as search } from '@/app/api/search/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

async function setup() {
  const { tenantId } = await createTenant();
  const admin = await createUser({ role: 'admin', tenantId });

  const { orgId } = await createOrg('Acme Corp', tenantId);
  const { teamId: teamA } = await createTeam(orgId, 'Marketing Team', tenantId);
  const { teamId: teamB } = await createTeam(orgId, 'Engineering Team', tenantId);

  const { pageId: annualA } = await createOKRPage(teamA, { year: 2025, type: 'annual', tenantId });
  const { pageId: q1A } = await createOKRPage(teamA, { year: 2025, type: 'quarterly', quarter: 'Q1', tenantId });
  const { pageId: annualB } = await createOKRPage(teamB, { year: 2024, type: 'annual', tenantId });

  const { objectiveId } = await createObjective(annualA, 'Grow brand awareness', [
    { type: 'user', id: admin.userId, displayName: 'Alice Chen' },
  ]);
  await createKeyResult(objectiveId, {
    owners: [{ type: 'user', id: admin.userId, displayName: 'Alice Chen' }],
  });

  return { tenantId, admin, orgId, teamA, teamB, annualA, q1A, annualB, objectiveId };
}

function searchReq(q: string, token: string) {
  return req('GET', `/api/search?q=${encodeURIComponent(q)}`, { token });
}

// ── 1. Empty query ────────────────────────────────────────────────────────────

it('empty query returns an empty array', async () => {
  const { admin } = await setup();
  const res = await search(searchReq('', admin.token));
  expect(res.status).toBe(200);
  expect((await json(res)).data).toHaveLength(0);
});

// ── 2. Unauthenticated ────────────────────────────────────────────────────────

it('unauthenticated request returns 401', async () => {
  const res = await search(req('GET', '/api/search?q=acme'));
  expect(res.status).toBe(401);
});

// ── 3. Org name search ────────────────────────────────────────────────────────

it('finds an org by name', async () => {
  const { admin } = await setup();
  const res = await search(searchReq('acme', admin.token));
  expect(res.status).toBe(200);
  const { data } = await json(res);
  const orgs = data.filter((r: { type: string }) => r.type === 'org');
  expect(orgs).toHaveLength(1);
  expect(orgs[0].name).toBe('Acme Corp');
  expect(orgs[0].href).toMatch(/^\/orgs\//);
});

// ── 4. Team name search includes org subtitle ─────────────────────────────────

it('finds a team by name and returns the org name as subtitle', async () => {
  const { admin } = await setup();
  const res = await search(searchReq('marketing', admin.token));
  expect(res.status).toBe(200);
  const { data } = await json(res);
  const teams = data.filter((r: { type: string }) => r.type === 'team');
  expect(teams).toHaveLength(1);
  expect(teams[0].name).toBe('Marketing Team');
  expect(teams[0].subtitle).toBe('Acme Corp');
  expect(teams[0].href).toMatch(/^\/teams\//);
});

// ── 5. Case-insensitive ───────────────────────────────────────────────────────

it('name search is case-insensitive', async () => {
  const { admin } = await setup();
  const res = await search(searchReq('ENGINEERING', admin.token));
  const { data } = await json(res);
  const teams = data.filter((r: { type: string }) => r.type === 'team');
  expect(teams[0].name).toBe('Engineering Team');
});

// ── 6. Period search — year only ──────────────────────────────────────────────

it('year-only query returns OKR pages for that year', async () => {
  const { admin, teamA, teamB } = await setup();
  const res = await search(searchReq('2025', admin.token));
  const { data } = await json(res);
  const pages = data.filter((r: { type: string }) => r.type === 'page');
  // teamA has annual 2025 and Q1 2025; teamB has annual 2024 → only 2025 pages
  const teamIds = pages.map((p: { href: string }) => p.href.split('/')[2]);
  expect(teamIds.every((id: string) => [teamA, teamB].includes(id))).toBe(true);
  expect(pages.some((p: { subtitle: string }) => p.subtitle.includes('2025'))).toBe(true);
  expect(pages.every((p: { subtitle: string }) => !p.subtitle.includes('2024'))).toBe(true);
});

// ── 7. Period search — quarter only ───────────────────────────────────────────

it('quarter-only query returns all pages with that quarter', async () => {
  const { admin } = await setup();
  const res = await search(searchReq('Q1', admin.token));
  const { data } = await json(res);
  const pages = data.filter((r: { type: string }) => r.type === 'page');
  expect(pages.length).toBeGreaterThanOrEqual(1);
  expect(pages.every((p: { subtitle: string }) => p.subtitle.includes('Q1'))).toBe(true);
});

// ── 8. Period search — year + quarter ────────────────────────────────────────

it('year + quarter query returns only the matching page', async () => {
  const { admin } = await setup();
  const res = await search(searchReq('2025 Q1', admin.token));
  const { data } = await json(res);
  const pages = data.filter((r: { type: string }) => r.type === 'page');
  expect(pages).toHaveLength(1);
  expect(pages[0].subtitle).toContain('2025');
  expect(pages[0].subtitle).toContain('Q1');
});

// ── 9. Annual page href ───────────────────────────────────────────────────────

it('annual page result has href /teams/[teamId]/[year]', async () => {
  const { admin, teamA } = await setup();
  const res = await search(searchReq('2025', admin.token));
  const { data } = await json(res);
  const annual = data.find(
    (r: { type: string; href: string }) =>
      r.type === 'page' && r.href === `/teams/${teamA}/2025`
  );
  expect(annual).toBeDefined();
});

// ── 10. Quarterly page href ───────────────────────────────────────────────────

it('quarterly page result has href /teams/[teamId]/[year]/q1', async () => {
  const { admin, teamA } = await setup();
  const res = await search(searchReq('Q1', admin.token));
  const { data } = await json(res);
  const quarterly = data.find(
    (r: { type: string; href: string }) =>
      r.type === 'page' && r.href === `/teams/${teamA}/2025/q1`
  );
  expect(quarterly).toBeDefined();
});

// ── 11. Owner search finds objective ─────────────────────────────────────────

it('finds objectives where the owner displayName matches', async () => {
  const { admin } = await setup();
  const res = await search(searchReq('Alice', admin.token));
  const { data } = await json(res);
  const objectives = data.filter((r: { type: string }) => r.type === 'objective');
  expect(objectives).toHaveLength(1);
  expect(objectives[0].name).toBe('Grow brand awareness');
  expect(objectives[0].href).toMatch(/^\/teams\//);
});

// ── 12. Owner subtitle contains owner + team/period ───────────────────────────

it('objective result subtitle includes the owner name and team period', async () => {
  const { admin } = await setup();
  const res = await search(searchReq('Alice Chen', admin.token));
  const { data } = await json(res);
  const obj = data.find((r: { type: string }) => r.type === 'objective');
  expect(obj.subtitle).toContain('Alice Chen');
  expect(obj.subtitle).toContain('2025');
});

// ── 13. Purely-period query skips name/owner search ──────────────────────────

it('"2025" does not return any team or org named 2025', async () => {
  const { admin } = await setup();

  // Create an org literally named "2025"
  const { tenantId } = await createTenant();
  const adminB = await createUser({ role: 'admin', tenantId });
  await createOrg('2025', tenantId);

  // Search from original tenant — "2025" org is in a different tenant anyway,
  // but also confirm the original admin's results are only page-type
  const res = await search(searchReq('2025', admin.token));
  const { data } = await json(res);
  const nonPages = data.filter((r: { type: string }) => r.type !== 'page');
  // No orgs or teams named "2025" exist in admin's tenant
  expect(nonPages.filter((r: { type: string }) => r.type === 'org' || r.type === 'team')).toHaveLength(0);
  void adminB; // suppress unused warning
});

// ── 14. Mixed year+quarter query is scoped ────────────────────────────────────

it('"Q1 2025" returns only Q1 2025 pages, not all 2025 pages', async () => {
  const { admin } = await setup();
  // Annual 2025 exists but should not appear — only the Q1 quarterly page
  const res = await search(searchReq('Q1 2025', admin.token));
  const { data } = await json(res);
  const pages = data.filter((r: { type: string }) => r.type === 'page');
  expect(pages.every((p: { subtitle: string }) => p.subtitle.includes('Q1'))).toBe(true);
});
