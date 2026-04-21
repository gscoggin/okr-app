/**
 * Tenant isolation journey tests
 *
 * Covered:
 *   1. User cannot list orgs from another tenant
 *   2. User cannot view an OKR page from another tenant
 *   3. User cannot add an objective to another tenant's page
 *   4. User cannot update an objective on another tenant's page
 *   5. User cannot delete another tenant's OKR page
 *   6. Admin cannot delete an org from another tenant
 *   7. User cannot edit a key result from another tenant
 *   8. User cannot delete a key result from another tenant
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

import { GET as getOrgs } from '@/app/api/orgs/route';
import { DELETE as deleteOrg } from '@/app/api/orgs/[orgId]/route';
import { GET as getPage } from '@/app/api/okr-pages/[pageId]/route';
import { DELETE as deletePage } from '@/app/api/okr-pages/[pageId]/route';
import { POST as postObjective } from '@/app/api/objectives/route';
import { PATCH as patchObjective } from '@/app/api/objectives/[objectiveId]/route';
import { PATCH as patchKR, DELETE as deleteKR } from '@/app/api/key-results/[krId]/route';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

async function twoTenantSetup() {
  const { tenantId: tenantA } = await createTenant('Tenant A');
  const { tenantId: tenantB } = await createTenant('Tenant B');

  const adminA = await createUser({ role: 'admin', tenantId: tenantA });
  const adminB = await createUser({ role: 'admin', tenantId: tenantB });

  const { orgId: orgA } = await createOrg('Org A', tenantA);
  const { orgId: orgB } = await createOrg('Org B', tenantB);

  const { teamId: teamA } = await createTeam(orgA, 'Team A', tenantA);
  const { teamId: teamB } = await createTeam(orgB, 'Team B', tenantB);

  const ownerA = await createUser({ role: 'member', tenantId: tenantA });
  await addTeamMember(teamA, ownerA.userId, 'owner');
  const ownerAToken = await ownerA.refreshToken();

  const { pageId: pageA } = await createOKRPage(teamA, { tenantId: tenantA });
  const { pageId: pageB } = await createOKRPage(teamB, { tenantId: tenantB });
  const { objectiveId: objA } = await createObjective(pageA, 'Tenant A Objective');

  return { tenantA, tenantB, adminA, adminB, orgA, orgB, teamA, teamB, ownerA, ownerAToken, pageA, pageB, objA };
}

// ── 1. Cannot list orgs from another tenant ───────────────────────────────────

it('admin only sees orgs from their own tenant', async () => {
  const { adminA, orgB } = await twoTenantSetup();

  const res = await getOrgs(req('GET', '/api/orgs', { token: adminA.token }));
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data).toHaveLength(1);
  expect(data[0].name).toBe('Org A');
  expect(data.map((o: { _id: string }) => o._id)).not.toContain(orgB);
});

// ── 2. Cannot view a page from another tenant ─────────────────────────────────

it('user cannot view an OKR page from another tenant', async () => {
  const { adminA, pageB } = await twoTenantSetup();

  const res = await getPage(
    req('GET', `/api/okr-pages/${pageB}`, { token: adminA.token }),
    { params: Promise.resolve({ pageId: pageB }) }
  );
  expect(res.status).toBe(404);
});

// ── 3. Cannot add objective to another tenant's page ─────────────────────────

it('team owner cannot add an objective to another tenant\'s page', async () => {
  const { ownerAToken, pageB } = await twoTenantSetup();

  const res = await postObjective(
    req('POST', '/api/objectives', {
      body: { okrPageId: pageB, title: 'Cross-tenant objective' },
      token: ownerAToken,
    })
  );
  expect(res.status).toBe(403);
});

// ── 4. Cannot update objective on another tenant's page ───────────────────────

it('user cannot update an objective that belongs to another tenant', async () => {
  const { adminA, pageB } = await twoTenantSetup();
  // Create an objective in tenant B's page directly via fixture
  const { objectiveId: objB } = await createObjective(pageB, 'Tenant B Objective');

  const res = await patchObjective(
    req('PATCH', `/api/objectives/${objB}`, {
      body: { title: 'Cross-tenant edit' },
      token: adminA.token,
    }),
    { params: Promise.resolve({ objectiveId: objB }) }
  );
  expect(res.status).toBe(403);
  // Original title unchanged
  const obj = await Objective.findById(objB).lean();
  expect(obj!.title).toBe('Tenant B Objective');
});

// ── 5. Cannot delete another tenant's OKR page ───────────────────────────────

it('team owner cannot delete an OKR page from another tenant', async () => {
  const { ownerAToken, pageB } = await twoTenantSetup();

  const res = await deletePage(
    req('DELETE', `/api/okr-pages/${pageB}`, { token: ownerAToken }),
    { params: Promise.resolve({ pageId: pageB }) }
  );
  // Route returns 404 to avoid leaking that the page exists in another tenant
  expect(res.status).toBe(404);
});

// ── 6. Admin cannot delete an org from another tenant ────────────────────────

it('admin cannot delete an org from another tenant', async () => {
  const { adminA, orgB } = await twoTenantSetup();

  const res = await deleteOrg(
    req('DELETE', `/api/orgs/${orgB}`, { token: adminA.token }),
    { params: Promise.resolve({ orgId: orgB }) }
  );
  // Route returns 404 to avoid leaking that the org exists in another tenant
  expect(res.status).toBe(404);
});

// ── 7. Cannot edit a KR from another tenant ───────────────────────────────────

it('user cannot edit a key result that belongs to another tenant', async () => {
  const { adminA, pageB } = await twoTenantSetup();
  const { objectiveId: objB } = await createObjective(pageB, 'Tenant B Objective');
  const { krId } = await createKeyResult(objB, { title: 'Original KR title' });

  const res = await patchKR(
    req('PATCH', `/api/key-results/${krId}`, {
      body: { title: 'Cross-tenant KR edit' },
      token: adminA.token,
    }),
    { params: Promise.resolve({ krId }) }
  );
  expect(res.status).toBe(403);
  const kr = await KeyResult.findById(krId).lean();
  expect(kr!.title).toBe('Original KR title');
});

// ── 8. Cannot delete a KR from another tenant ────────────────────────────────

it('user cannot delete a key result that belongs to another tenant', async () => {
  const { adminA, pageB } = await twoTenantSetup();
  const { objectiveId: objB } = await createObjective(pageB, 'Tenant B Objective');
  const { krId } = await createKeyResult(objB);

  const res = await deleteKR(
    req('DELETE', `/api/key-results/${krId}`, { token: adminA.token }),
    { params: Promise.resolve({ krId }) }
  );
  expect(res.status).toBe(403);
  expect(await KeyResult.findById(krId)).not.toBeNull();
});
