/**
 * Shared objectives (team-as-owner) journey tests
 *
 * Covered:
 *   1. Team added as owner of an objective appears in shared results for that team
 *   2. Team added as owner of a KR — the parent objective appears in shared results
 *   3. Team's own objectives are excluded from shared results
 *   4. Objectives from another tenant never appear in shared results
 *   5. No results returned when the team owns nothing shared
 *   6. Objective appears once when team owns both the objective and a KR on it (deduplication)
 *   7. Missing required params return 400
 */
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { req, json } from '../helpers/request';
import {
  createTenant,
  createUser,
  createOrg,
  createTeam,
  addTeamMember,
  createOKRPage,
  createObjective,
  createKeyResult,
} from '../helpers/fixtures';

import { GET as getShared } from '@/app/api/objectives/shared/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

async function setup() {
  const { tenantId } = await createTenant();
  const admin = await createUser({ role: 'admin', tenantId });

  const { orgId } = await createOrg('Test Org', tenantId);
  const { teamId: teamA } = await createTeam(orgId, 'Team A', tenantId);
  const { teamId: teamB } = await createTeam(orgId, 'Team B', tenantId);

  const { pageId: pageA } = await createOKRPage(teamA, { year: 2025, tenantId });
  const { pageId: pageB } = await createOKRPage(teamB, { year: 2025, tenantId });

  return { tenantId, admin, teamA, teamB, pageA, pageB };
}

// ── 1. Team as objective owner ────────────────────────────────────────────────

it('objective owned by a team appears in that team\'s shared results', async () => {
  const { admin, teamA, teamB, pageA } = await setup();

  await createObjective(pageA, 'Shared Objective', [{ type: 'team', id: teamB, displayName: 'Team B' }]);

  const res = await getShared(
    req('GET', `/api/objectives/shared?teamId=${teamB}&year=2025`, { token: admin.token })
  );
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data).toHaveLength(1);
  expect(data[0].title).toBe('Shared Objective');
  expect(data[0].sourceTeamId).toBe(teamA);
});

// ── 2. Team as KR owner ───────────────────────────────────────────────────────

it('objective whose KR is owned by a team appears in that team\'s shared results', async () => {
  const { admin, teamA, teamB, pageA } = await setup();

  const { objectiveId } = await createObjective(pageA, 'KR-shared Objective');
  await createKeyResult(objectiveId, {
    title: 'Team B owns this KR',
    owners: [{ type: 'team', id: teamB, displayName: 'Team B' }],
  });

  const res = await getShared(
    req('GET', `/api/objectives/shared?teamId=${teamB}&year=2025`, { token: admin.token })
  );
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data).toHaveLength(1);
  expect(data[0].title).toBe('KR-shared Objective');
});

// ── 3. Own objectives excluded ────────────────────────────────────────────────

it('a team\'s own objectives are excluded from shared results', async () => {
  const { admin, teamB, pageB } = await setup();

  // Team B owns an objective on their own page
  await createObjective(pageB, 'Team B Own Objective', [
    { type: 'team', id: teamB, displayName: 'Team B' },
  ]);

  const res = await getShared(
    req('GET', `/api/objectives/shared?teamId=${teamB}&year=2025`, { token: admin.token })
  );
  expect(res.status).toBe(200);
  expect((await json(res)).data).toHaveLength(0);
});

// ── 4. Cross-tenant isolation ─────────────────────────────────────────────────

it('objectives from another tenant do not appear in shared results', async () => {
  const { tenantId: tenantB } = await createTenant('Tenant B');
  const adminB = await createUser({ role: 'admin', tenantId: tenantB });
  const { orgId: orgB } = await createOrg('Org B', tenantB);
  const { teamId: teamX } = await createTeam(orgB, 'Team X', tenantB);
  const { teamId: teamY } = await createTeam(orgB, 'Team Y', tenantB);
  const { pageId: pageX } = await createOKRPage(teamX, { year: 2025, tenantId: tenantB });

  // Team Y is an owner of an objective in Tenant B
  await createObjective(pageX, 'Cross-tenant Objective', [
    { type: 'team', id: teamY, displayName: 'Team Y' },
  ]);

  // Set up a completely separate tenant
  const { admin, teamB: teamInA } = await setup();

  // Team from Tenant A should NOT see Tenant B's shared objectives
  const res = await getShared(
    req('GET', `/api/objectives/shared?teamId=${teamInA}&year=2025`, { token: admin.token })
  );
  expect(res.status).toBe(200);
  expect((await json(res)).data).toHaveLength(0);
});

// ── 5. No shared objectives ───────────────────────────────────────────────────

it('returns empty array when team owns nothing shared', async () => {
  const { admin, teamB } = await setup();

  const res = await getShared(
    req('GET', `/api/objectives/shared?teamId=${teamB}&year=2025`, { token: admin.token })
  );
  expect(res.status).toBe(200);
  expect((await json(res)).data).toHaveLength(0);
});

// ── 6. Deduplication ─────────────────────────────────────────────────────────

it('objective appears once when team owns both the objective and a KR on it', async () => {
  const { admin, teamB, pageA } = await setup();

  const { objectiveId } = await createObjective(pageA, 'Doubly-shared Objective', [
    { type: 'team', id: teamB, displayName: 'Team B' },
  ]);
  // Team B also owns a KR on the same objective
  await createKeyResult(objectiveId, {
    owners: [{ type: 'team', id: teamB, displayName: 'Team B' }],
  });

  const res = await getShared(
    req('GET', `/api/objectives/shared?teamId=${teamB}&year=2025`, { token: admin.token })
  );
  expect(res.status).toBe(200);
  expect((await json(res)).data).toHaveLength(1);
});

// ── 7. Missing params ─────────────────────────────────────────────────────────

it('returns 400 when teamId or year is missing', async () => {
  const { admin, teamB } = await setup();

  const noYear = await getShared(
    req('GET', `/api/objectives/shared?teamId=${teamB}`, { token: admin.token })
  );
  expect(noYear.status).toBe(400);

  const noTeam = await getShared(
    req('GET', `/api/objectives/shared?year=2025`, { token: admin.token })
  );
  expect(noTeam.status).toBe(400);
});
