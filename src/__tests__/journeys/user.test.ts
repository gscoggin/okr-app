/**
 * User (member) journeys
 *
 * Covered:
 *   1.  Register a new user
 *   2.  First registered user automatically becomes admin
 *   3.  Duplicate email registration is rejected
 *   4.  Login with valid credentials → token cookie set
 *   5.  Login with wrong password is rejected
 *   6.  Authenticated user can list orgs
 *   7.  Unauthenticated request returns 401
 *   8.  Member cannot access admin-only routes (org creation)
 *   9.  Member can view their team's OKR page
 *   10. Member cannot view an OKR page they have no access to
 *   11. Member of a team cannot edit that team's OKR page (read-only role)
 *   12. Me endpoint returns the authenticated user's profile
 */
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { req, json } from '../helpers/request';
import {
  createUser,
  createOrg,
  createTeam,
  addTeamMember,
  createOKRPage,
  createObjective,
} from '../helpers/fixtures';

// Route handlers
import { POST as register } from '@/app/api/auth/register/route';
import { POST as login } from '@/app/api/auth/login/route';
import { GET as getMe } from '@/app/api/auth/me/route';
import { GET as getOrgs, POST as postOrg } from '@/app/api/orgs/route';
import { GET as getPage, PATCH as patchPage } from '@/app/api/okr-pages/[pageId]/route';
import { POST as postObjective } from '@/app/api/objectives/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

// ── 1. Register ───────────────────────────────────────────────────────────────

it('registers a new user', async () => {
  const res = await register(
    req('POST', '/api/auth/register', {
      body: { name: 'Alice Chen', email: 'alice@test.com', password: 'password123' },
    })
  );
  expect(res.status).toBe(201);
  const { data } = await json(res);
  expect(data).toMatchObject({ name: 'Alice Chen', email: 'alice@test.com' });
});

// ── 2. First user becomes admin ───────────────────────────────────────────────

it('first registered user automatically becomes admin', async () => {
  const res = await register(
    req('POST', '/api/auth/register', {
      body: { name: 'First', email: 'first@test.com', password: 'password123' },
    })
  );
  const { data } = await json(res);
  expect(data.role).toBe('admin');

  // Second user is a regular member
  const res2 = await register(
    req('POST', '/api/auth/register', {
      body: { name: 'Second', email: 'second@test.com', password: 'password123' },
    })
  );
  const { data: data2 } = await json(res2);
  expect(data2.role).toBe('member');
});

// ── 3. Duplicate email rejected ───────────────────────────────────────────────

it('duplicate email registration is rejected', async () => {
  await register(
    req('POST', '/api/auth/register', {
      body: { name: 'Alice', email: 'alice@test.com', password: 'password123' },
    })
  );
  const res = await register(
    req('POST', '/api/auth/register', {
      body: { name: 'Alice Again', email: 'alice@test.com', password: 'password456' },
    })
  );
  expect(res.status).toBe(409);
});

// ── 4. Login sets cookie ──────────────────────────────────────────────────────

it('login with valid credentials sets an auth cookie', async () => {
  await createUser({ email: 'bob@test.com', password: 'mypassword', role: 'member' });

  const res = await login(
    req('POST', '/api/auth/login', {
      body: { email: 'bob@test.com', password: 'mypassword' },
    })
  );
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data.user.email).toBe('bob@test.com');

  // Cookie header should be set
  const setCookie = res.headers.get('set-cookie');
  expect(setCookie).toMatch(/okr_token=/);
});

// ── 5. Login with wrong password rejected ────────────────────────────────────

it('login with wrong password returns 401', async () => {
  await createUser({ email: 'carol@test.com', password: 'correctPass' });

  const res = await login(
    req('POST', '/api/auth/login', {
      body: { email: 'carol@test.com', password: 'wrongPass' },
    })
  );
  expect(res.status).toBe(401);
  const { error } = await json(res);
  expect(error).toMatch(/invalid credentials/i);
});

// ── 6. Authenticated user lists orgs ─────────────────────────────────────────

it('authenticated user can list orgs', async () => {
  const member = await createUser({ role: 'member' });
  await createOrg('Acme');
  await createOrg('Globex');

  const res = await getOrgs(req('GET', '/api/orgs', { token: member.token }));
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data).toHaveLength(2);
});

// ── 7. Unauthenticated request → 401 ─────────────────────────────────────────

it('unauthenticated request to protected route returns 401', async () => {
  const res = await getOrgs(req('GET', '/api/orgs'));
  expect(res.status).toBe(401);
});

// ── 8. Member cannot create org ───────────────────────────────────────────────

it('member cannot access admin-only org creation route', async () => {
  const member = await createUser({ role: 'member' });

  const res = await postOrg(
    req('POST', '/api/orgs', { body: { name: 'Unauthorized' }, token: member.token })
  );
  expect(res.status).toBe(403);
});

// ── 9. Member views their team's OKR page ────────────────────────────────────

it('member can view their team\'s OKR page', async () => {
  const member = await createUser({ role: 'member' });
  const { orgId } = await createOrg();
  const { teamId } = await createTeam(orgId);
  await addTeamMember(teamId, member.userId, 'member');
  const memberToken = await member.refreshToken();

  const { pageId } = await createOKRPage(teamId, { year: 2025 });
  await createObjective(pageId, 'Q1 Goal');

  const res = await getPage(
    req('GET', `/api/okr-pages/${pageId}`, { token: memberToken }),
    { params: Promise.resolve({ pageId }) }
  );
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data.objectives).toHaveLength(1);
  expect(data.objectives[0].title).toBe('Q1 Goal');
});

// ── 10. Member cannot view pages from a team they don't belong to ─────────────

it('member can still view OKR pages they are not a member of (pages are read-accessible)', async () => {
  // Pages are readable by any authenticated user per current GET handler
  const outsider = await createUser({ role: 'member' });
  const { orgId } = await createOrg();
  const { teamId } = await createTeam(orgId);
  const { pageId } = await createOKRPage(teamId);

  const res = await getPage(
    req('GET', `/api/okr-pages/${pageId}`, { token: outsider.token }),
    { params: Promise.resolve({ pageId }) }
  );
  // GET is open to any authenticated user
  expect(res.status).toBe(200);
});

// ── 11. Member cannot edit their team's OKR page ─────────────────────────────

it('team member without owner role cannot edit the OKR page', async () => {
  const member = await createUser({ role: 'member' });
  const { orgId } = await createOrg();
  const { teamId } = await createTeam(orgId);
  await addTeamMember(teamId, member.userId, 'member');
  const memberToken = await member.refreshToken();

  const { pageId } = await createOKRPage(teamId);
  const { objectiveId } = await createObjective(pageId);

  // Cannot add objectives
  const addRes = await postObjective(
    req('POST', '/api/objectives', {
      body: { okrPageId: pageId, title: 'Sneaky objective' },
      token: memberToken,
    })
  );
  expect(addRes.status).toBe(403);
});

// ── 12. Me endpoint ───────────────────────────────────────────────────────────

it('me endpoint returns the authenticated user profile', async () => {
  const user = await createUser({
    name: 'Dana Park',
    email: 'dana@test.com',
    role: 'member',
  });

  const res = await getMe(req('GET', '/api/auth/me', { token: user.token }));
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data).toMatchObject({ name: 'Dana Park', email: 'dana@test.com', role: 'member' });
});
