/**
 * User (member) journeys
 *
 * Covered:
 *   1.  Register a new workspace (tenant + tenant_owner)
 *   2.  Registration requires a company name
 *   3.  Duplicate email registration is rejected
 *   4.  Authenticated user can list orgs within their tenant
 *   5.  Unauthenticated request returns 401
 *   6.  Member cannot access admin-only routes (org creation)
 *   7.  Member can view an OKR page in their tenant
 *   8.  Member of a team cannot edit that team's OKR page (read-only role)
 *   9.  Me endpoint returns the authenticated user's profile
 */
import mongoose from 'mongoose';
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
} from '../helpers/fixtures';
import InviteCode from '@/models/InviteCode';

async function makeCode(code = 'TESTCODE') {
  return InviteCode.create({
    code,
    createdBy: new mongoose.Types.ObjectId(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
}

import { POST as register } from '@/app/api/auth/register/route';
import { GET as getMe } from '@/app/api/auth/me/route';
import { GET as getOrgs, POST as postOrg } from '@/app/api/orgs/route';
import { GET as getPage } from '@/app/api/okr-pages/[pageId]/route';
import { POST as postObjective } from '@/app/api/objectives/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

// ── 1. Register a new workspace ───────────────────────────────────────────────

it('registers a new workspace and returns a tenant_owner user', async () => {
  await makeCode();
  const res = await register(
    req('POST', '/api/auth/register', {
      body: { name: 'Alice Chen', email: 'alice@test.com', password: 'password123', companyName: 'Acme Corp', inviteCode: 'TESTCODE' },
    })
  );
  expect(res.status).toBe(201);
  const { data } = await json(res);
  expect(data).toMatchObject({ name: 'Alice Chen', email: 'alice@test.com', role: 'tenant_owner' });
  expect(data.tenantId).toBeTruthy();
  expect(data.tenantName).toBe('Acme Corp');
});

// ── 2. Registration requires company name ─────────────────────────────────────

it('registration is rejected without a company name', async () => {
  await makeCode();
  const res = await register(
    req('POST', '/api/auth/register', {
      body: { name: 'Bob', email: 'bob@test.com', password: 'password123', inviteCode: 'TESTCODE' },
    })
  );
  expect(res.status).toBe(400);
});

// ── 3. Duplicate email rejected ───────────────────────────────────────────────

it('duplicate email registration is rejected', async () => {
  await makeCode('TESTCODE1');
  await makeCode('TESTCODE2');
  await register(req('POST', '/api/auth/register', {
    body: { name: 'Alice', email: 'alice@test.com', password: 'password123', companyName: 'Acme', inviteCode: 'TESTCODE1' },
  }));
  const res = await register(req('POST', '/api/auth/register', {
    body: { name: 'Alice Again', email: 'alice@test.com', password: 'password456', companyName: 'Other Co', inviteCode: 'TESTCODE2' },
  }));
  expect(res.status).toBe(409);
});

// ── 4. Authenticated user lists orgs within their tenant ──────────────────────

it('authenticated user only sees orgs from their own tenant', async () => {
  const { tenantId } = await createTenant();
  const member = await createUser({ role: 'member', tenantId });
  await createOrg('Acme', tenantId);
  await createOrg('Globex', tenantId);

  // Create an org in a different tenant — should not appear
  const { tenantId: otherTenantId } = await createTenant('Other Co');
  await createOrg('Invisible Org', otherTenantId);

  const res = await getOrgs(req('GET', '/api/orgs', { token: member.token }));
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data).toHaveLength(2);
  expect(data.map((o: { name: string }) => o.name)).toEqual(expect.arrayContaining(['Acme', 'Globex']));
});

// ── 5. Unauthenticated request → 401 ─────────────────────────────────────────

it('unauthenticated request to protected route returns 401', async () => {
  const res = await getOrgs(req('GET', '/api/orgs'));
  expect(res.status).toBe(401);
});

// ── 6. Member cannot create org ───────────────────────────────────────────────

it('member cannot access admin-only org creation route', async () => {
  const member = await createUser({ role: 'member' });
  const res = await postOrg(req('POST', '/api/orgs', { body: { name: 'Unauthorized' }, token: member.token }));
  expect(res.status).toBe(403);
});

// ── 7. Member can view an OKR page in their tenant ───────────────────────────

it('member can view an OKR page within their tenant', async () => {
  const { tenantId } = await createTenant();
  const member = await createUser({ role: 'member', tenantId });
  const { orgId } = await createOrg('Org', tenantId);
  const { teamId } = await createTeam(orgId, 'Team', tenantId);
  await addTeamMember(teamId, member.userId, 'member');
  const memberToken = await member.refreshToken();

  const { pageId } = await createOKRPage(teamId, { year: 2025, tenantId });
  await createObjective(pageId, 'Q1 Goal');

  const res = await getPage(
    req('GET', `/api/okr-pages/${pageId}`, { token: memberToken }),
    { params: Promise.resolve({ pageId }) }
  );
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data.objectives[0].title).toBe('Q1 Goal');
});

// ── 8. Member cannot edit their team's OKR page ─────────────────────────────

it('team member without owner role cannot add objectives', async () => {
  const { tenantId } = await createTenant();
  const member = await createUser({ role: 'member', tenantId });
  const { orgId } = await createOrg('Org', tenantId);
  const { teamId } = await createTeam(orgId, 'Team', tenantId);
  await addTeamMember(teamId, member.userId, 'member');
  const memberToken = await member.refreshToken();

  const { pageId } = await createOKRPage(teamId, { tenantId });

  const res = await postObjective(
    req('POST', '/api/objectives', {
      body: { okrPageId: pageId, title: 'Sneaky objective' },
      token: memberToken,
    })
  );
  expect(res.status).toBe(403);
});

// ── 9. Me endpoint ───────────────────────────────────────────────────────────

it('me endpoint returns the authenticated user profile', async () => {
  const user = await createUser({ name: 'Dana Park', email: 'dana@test.com', role: 'member' });
  const res = await getMe(req('GET', '/api/auth/me', { token: user.token }));
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data).toMatchObject({ name: 'Dana Park', email: 'dana@test.com', role: 'member' });
});
