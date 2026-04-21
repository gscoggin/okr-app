/**
 * Team membership management journeys
 *
 * Covered:
 *   1. Admin adds a member to a team
 *   2. Admin removes a member from a team
 *   3. Non-admin cannot add/remove members
 *   4. Cross-tenant: cannot add member from another tenant's team
 *   5. Cross-tenant: cannot add a user from another tenant
 *   6. Cannot add member to a team that doesn't exist
 */
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { req, json } from '../helpers/request';
import {
  createTenant,
  createUser,
  createOrg,
  createTeam,
  addTeamMember,
} from '../helpers/fixtures';
import Team from '@/models/Team';
import User from '@/models/User';

import { POST as addMember, DELETE as removeMember } from '@/app/api/teams/[teamId]/members/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

async function setup() {
  const { tenantId } = await createTenant();
  const admin = await createUser({ role: 'admin', tenantId });
  const member = await createUser({ role: 'member', tenantId });
  const { orgId } = await createOrg('Test Org', tenantId);
  const { teamId } = await createTeam(orgId, 'Test Team', tenantId);
  return { tenantId, admin, member, orgId, teamId };
}

// ── 1. Add member ─────────────────────────────────────────────────────────────

it('admin adds a user to a team', async () => {
  const { admin, member, teamId } = await setup();

  const res = await addMember(
    req('POST', `/api/teams/${teamId}/members`, {
      body: { userId: member.userId, role: 'member' },
      token: admin.token,
    }),
    { params: Promise.resolve({ teamId }) }
  );
  expect(res.status).toBe(200);

  const team = await Team.findById(teamId).lean();
  expect(team!.members.some((m: { userId: { toString(): string } }) => m.userId.toString() === member.userId)).toBe(true);

  const user = await User.findById(member.userId).lean();
  expect(user!.teamMemberships.some((m: { teamId: { toString(): string } }) => m.teamId.toString() === teamId)).toBe(true);
});

// ── 2. Remove member ──────────────────────────────────────────────────────────

it('admin removes a user from a team', async () => {
  const { admin, member, teamId } = await setup();
  await addTeamMember(teamId, member.userId, 'member');

  const res = await removeMember(
    req('DELETE', `/api/teams/${teamId}/members`, {
      body: { userId: member.userId },
      token: admin.token,
    }),
    { params: Promise.resolve({ teamId }) }
  );
  expect(res.status).toBe(200);

  const team = await Team.findById(teamId).lean();
  expect(team!.members).toHaveLength(0);

  const user = await User.findById(member.userId).lean();
  expect(user!.teamMemberships).toHaveLength(0);
});

// ── 3. Non-admin forbidden ────────────────────────────────────────────────────

it('non-admin cannot add a team member', async () => {
  const { member, teamId } = await setup();
  const other = await createUser({ role: 'member', tenantId: (await setup()).tenantId });

  const res = await addMember(
    req('POST', `/api/teams/${teamId}/members`, {
      body: { userId: other.userId, role: 'member' },
      token: member.token,
    }),
    { params: Promise.resolve({ teamId }) }
  );
  expect(res.status).toBe(403);
});

// ── 4. Cross-tenant: team belongs to another tenant ──────────────────────────

it('cannot add member to a team in another tenant', async () => {
  const { admin, member } = await setup();

  const { tenantId: otherTenantId } = await createTenant();
  const { orgId: otherOrgId } = await createOrg('Other Org', otherTenantId);
  const { teamId: otherTeamId } = await createTeam(otherOrgId, 'Other Team', otherTenantId);

  const res = await addMember(
    req('POST', `/api/teams/${otherTeamId}/members`, {
      body: { userId: member.userId, role: 'member' },
      token: admin.token,
    }),
    { params: Promise.resolve({ teamId: otherTeamId }) }
  );
  expect(res.status).toBe(403);
});

// ── 5. Cross-tenant: target user belongs to another tenant ───────────────────

it('cannot add a user from another tenant to a team', async () => {
  const { admin, teamId } = await setup();

  const { tenantId: otherTenantId } = await createTenant();
  const outsider = await createUser({ role: 'member', tenantId: otherTenantId });

  const res = await addMember(
    req('POST', `/api/teams/${teamId}/members`, {
      body: { userId: outsider.userId, role: 'member' },
      token: admin.token,
    }),
    { params: Promise.resolve({ teamId }) }
  );
  expect(res.status).toBe(403);
});

// ── 6. Team not found ─────────────────────────────────────────────────────────

it('returns 404 when team does not exist', async () => {
  const { admin, member } = await setup();
  const fakeId = '000000000000000000000000';

  const res = await addMember(
    req('POST', `/api/teams/${fakeId}/members`, {
      body: { userId: member.userId, role: 'member' },
      token: admin.token,
    }),
    { params: Promise.resolve({ teamId: fakeId }) }
  );
  expect(res.status).toBe(404);
});
