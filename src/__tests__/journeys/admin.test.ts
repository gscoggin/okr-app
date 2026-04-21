/**
 * Admin user journeys
 *
 * Covered:
 *   1. Create an org → appears in tenant's list
 *   2. Delete an org → cascades to teams, pages, objectives, KRs
 *   3. Archive an org → data disappears, archive record created → restore brings it back
 *   4. Archive a team → data disappears → restore
 *   5. Archive a year → year pages disappear → restore
 *   6. Delete a user → user removed from team memberships
 *   7. Reset all OKR data with valid credentials → data gone
 *   8. Reset rejected with wrong password
 *   9. Non-admin cannot create orgs
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
import Org from '@/models/Org';
import Team from '@/models/Team';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';
import Archive from '@/models/Archive';
import User from '@/models/User';

import { GET as getOrgs, POST as postOrg } from '@/app/api/orgs/route';
import { DELETE as deleteOrg } from '@/app/api/orgs/[orgId]/route';
import { DELETE as deleteTeam } from '@/app/api/teams/[teamId]/route';
import { DELETE as deleteUser } from '@/app/api/users/[userId]/route';
import { GET as getArchives, POST as postArchive } from '@/app/api/archives/route';
import { DELETE as unarchive } from '@/app/api/archives/[archiveId]/route';
import { POST as resetOKR } from '@/app/api/admin/reset-okr/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

// Shared setup: create a tenant + admin for each test
async function adminSetup(opts: { email?: string; password?: string } = {}) {
  const { tenantId } = await createTenant();
  const admin = await createUser({ role: 'admin', tenantId, ...opts });
  return { tenantId, admin };
}

// ── 1. Create org ─────────────────────────────────────────────────────────────

it('admin creates an org and it appears in the list', async () => {
  const { tenantId, admin } = await adminSetup();

  const createRes = await postOrg(
    req('POST', '/api/orgs', { body: { name: 'Acme Corp' }, token: admin.token })
  );
  expect(createRes.status).toBe(201);
  expect((await json(createRes)).data).toMatchObject({ name: 'Acme Corp' });

  const listRes = await getOrgs(req('GET', '/api/orgs', { token: admin.token }));
  const { data } = await json(listRes);
  expect(data).toHaveLength(1);
  expect(data[0].name).toBe('Acme Corp');
});

// ── 2. Delete org cascades ────────────────────────────────────────────────────

it('deleting an org cascades to teams, OKR pages, objectives, and key results', async () => {
  const { tenantId, admin } = await adminSetup();
  const { orgId } = await createOrg('Test Org', tenantId);
  const { teamId } = await createTeam(orgId, 'Test Team', tenantId);
  const { pageId } = await createOKRPage(teamId, { tenantId });
  const { objectiveId } = await createObjective(pageId);
  await createKeyResult(objectiveId);

  const res = await deleteOrg(
    req('DELETE', `/api/orgs/${orgId}`, { token: admin.token }),
    { params: Promise.resolve({ orgId }) }
  );
  expect(res.status).toBe(200);

  expect(await Org.findById(orgId)).toBeNull();
  expect(await Team.findOne({ orgId })).toBeNull();
  expect(await OKRPage.findOne({ teamId })).toBeNull();
  expect(await Objective.findOne({ okrPageId: pageId })).toBeNull();
  expect(await KeyResult.countDocuments()).toBe(0);
});

// ── 3. Archive & restore org ──────────────────────────────────────────────────

it('admin archives an org and can restore it', async () => {
  const { tenantId, admin } = await adminSetup();
  const { orgId } = await createOrg('Archived Org', tenantId);
  const { teamId } = await createTeam(orgId, 'Archived Team', tenantId);
  const { pageId } = await createOKRPage(teamId, { tenantId });
  await createObjective(pageId);

  const archiveRes = await postArchive(
    req('POST', '/api/archives', { body: { type: 'org', targetId: orgId }, token: admin.token })
  );
  expect(archiveRes.status).toBe(200);
  expect(await Org.findById(orgId)).toBeNull();
  expect(await Team.findById(teamId)).toBeNull();

  const listRes = await getArchives(req('GET', '/api/archives', { token: admin.token }));
  const { data: archives } = await json(listRes);
  expect(archives).toHaveLength(1);
  const archiveId = archives[0]._id;
  expect(archives[0]).toMatchObject({ type: 'org', name: 'Archived Org', canUnarchive: true });

  const restoreRes = await unarchive(
    req('DELETE', `/api/archives/${archiveId}`, { token: admin.token }),
    { params: Promise.resolve({ archiveId }) }
  );
  expect(restoreRes.status).toBe(200);
  expect(await Org.findById(orgId)).not.toBeNull();
  expect(await Team.findById(teamId)).not.toBeNull();
  expect(await OKRPage.findById(pageId)).not.toBeNull();
  expect(await Archive.findById(archiveId)).toBeNull();
});

// ── 4. Archive & restore team ─────────────────────────────────────────────────

it('admin archives a team and can restore it', async () => {
  const { tenantId, admin } = await adminSetup();
  const { orgId } = await createOrg('Test Org', tenantId);
  const { teamId } = await createTeam(orgId, 'Restored Team', tenantId);
  const { pageId } = await createOKRPage(teamId, { tenantId });
  const { objectiveId } = await createObjective(pageId);
  await createKeyResult(objectiveId);

  const archiveRes = await postArchive(
    req('POST', '/api/archives', { body: { type: 'team', targetId: teamId }, token: admin.token })
  );
  expect(archiveRes.status).toBe(200);
  expect(await Team.findById(teamId)).toBeNull();
  expect(await OKRPage.findById(pageId)).toBeNull();

  const { data: [archive] } = await json(await getArchives(req('GET', '/api/archives', { token: admin.token })));
  expect(archive).toMatchObject({ type: 'team', name: 'Restored Team' });

  const restoreRes = await unarchive(
    req('DELETE', `/api/archives/${archive._id}`, { token: admin.token }),
    { params: Promise.resolve({ archiveId: archive._id }) }
  );
  expect(restoreRes.status).toBe(200);
  expect(await Team.findById(teamId)).not.toBeNull();
  expect(await OKRPage.findById(pageId)).not.toBeNull();
});

// ── 5. Archive & restore year ─────────────────────────────────────────────────

it('admin archives a year and can restore it', async () => {
  const { tenantId, admin } = await adminSetup();
  const { orgId } = await createOrg('Test Org', tenantId);
  const { teamId } = await createTeam(orgId, 'Test Team', tenantId);
  const year = 2023;
  const { pageId } = await createOKRPage(teamId, { year, type: 'annual', tenantId });
  await createObjective(pageId);

  await postArchive(req('POST', '/api/archives', { body: { type: 'year', year }, token: admin.token }));
  expect(await OKRPage.findById(pageId)).toBeNull();

  const { data: [archive] } = await json(await getArchives(req('GET', '/api/archives', { token: admin.token })));
  expect(archive).toMatchObject({ type: 'year', name: '2023', canUnarchive: true });

  await unarchive(
    req('DELETE', `/api/archives/${archive._id}`, { token: admin.token }),
    { params: Promise.resolve({ archiveId: archive._id }) }
  );
  expect(await OKRPage.findById(pageId)).not.toBeNull();
});

it('year archives older than 4 years cannot be restored', async () => {
  const { tenantId, admin } = await adminSetup();
  const { orgId } = await createOrg('Test Org', tenantId);
  const { teamId } = await createTeam(orgId, 'Test Team', tenantId);
  const staleYear = new Date().getFullYear() - 5;
  const { pageId } = await createOKRPage(teamId, { year: staleYear, tenantId });
  await createObjective(pageId);

  await postArchive(req('POST', '/api/archives', { body: { type: 'year', year: staleYear }, token: admin.token }));

  const { data: [archive] } = await json(await getArchives(req('GET', '/api/archives', { token: admin.token })));
  expect(archive.canUnarchive).toBe(false);

  const res = await unarchive(
    req('DELETE', `/api/archives/${archive._id}`, { token: admin.token }),
    { params: Promise.resolve({ archiveId: archive._id }) }
  );
  expect(res.status).toBe(422);
});

// ── 6. Delete user ────────────────────────────────────────────────────────────

it('admin deletes a user and they are removed from team memberships', async () => {
  const { tenantId, admin } = await adminSetup();
  const member = await createUser({ email: 'member@test.com', role: 'member', tenantId });
  const { orgId } = await createOrg('Test Org', tenantId);
  const { teamId } = await createTeam(orgId, 'Test Team', tenantId);
  await addTeamMember(teamId, member.userId, 'member');

  expect((await Team.findById(teamId).lean())!.members).toHaveLength(1);

  const res = await deleteUser(
    req('DELETE', `/api/users/${member.userId}`, { token: admin.token }),
    { params: Promise.resolve({ userId: member.userId }) }
  );
  expect(res.status).toBe(200);

  expect(await User.findById(member.userId)).toBeNull();
  expect((await Team.findById(teamId).lean())!.members).toHaveLength(0);
});

// ── 7. Reset OKR data ─────────────────────────────────────────────────────────

it('admin resets all OKR data for their tenant', async () => {
  const { tenantId, admin } = await adminSetup({ email: 'admin@test.com', password: 'securePass1!' });
  const { orgId } = await createOrg('Test Org', tenantId);
  const { teamId } = await createTeam(orgId, 'Test Team', tenantId);
  const { pageId } = await createOKRPage(teamId, { tenantId });
  const { objectiveId } = await createObjective(pageId);
  await createKeyResult(objectiveId);

  expect(await OKRPage.countDocuments({ tenantId })).toBe(1);

  const res = await resetOKR(
    req('POST', '/api/admin/reset-okr', {
      body: { email: 'admin@test.com', password: 'securePass1!' },
      token: admin.token,
    })
  );
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data.deleted).toMatchObject({ pages: 1, objectives: 1, keyResults: 1 });
  expect(await OKRPage.countDocuments({ tenantId })).toBe(0);
});

// ── 8. Reset rejected with wrong password ────────────────────────────────────

it('reset is rejected with wrong password', async () => {
  const { admin } = await adminSetup({ email: 'admin2@test.com', password: 'correctPass1!' });

  const res = await resetOKR(
    req('POST', '/api/admin/reset-okr', {
      body: { email: 'admin2@test.com', password: 'wrongPassword' },
      token: admin.token,
    })
  );
  expect(res.status).toBe(401);
});

// ── 9. Non-admin access ───────────────────────────────────────────────────────

it('non-admin cannot create an org', async () => {
  const member = await createUser({ role: 'member' });
  const res = await postOrg(req('POST', '/api/orgs', { body: { name: 'Unauthorized Org' }, token: member.token }));
  expect(res.status).toBe(403);
  expect(await Org.countDocuments()).toBe(0);
});

it('unauthenticated request to admin route returns 403', async () => {
  const res = await postOrg(req('POST', '/api/orgs', { body: { name: 'No Token' } }));
  expect(res.status).toBe(403);
});
