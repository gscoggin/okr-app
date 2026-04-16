/**
 * Team Owner user journeys
 *
 * Covered:
 *   1.  Create an OKR page for a team (starts as draft)
 *   2.  Add an objective to a page
 *   3.  Update an objective's title
 *   4.  Add a key result to an objective
 *   5.  Update a key result's score → objective score auto-recomputed
 *   6.  Cannot publish an empty page (no objectives)
 *   7.  Cannot publish when a key result has no owners
 *   8.  Successfully publish a page with valid objectives + owned KRs
 *   9.  Revert a published page back to draft
 *   10. Delete an OKR page (cascades to objectives and KRs)
 *   11. A member without owner role cannot create an OKR page
 *   12. A member without owner role cannot edit an OKR page
 */
import mongoose from 'mongoose';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { req, json } from '../helpers/request';
import {
  createUser,
  createOrg,
  createTeam,
  addTeamMember,
  createOKRPage,
  createObjective,
  createKeyResult,
  tokenWithMemberships,
} from '../helpers/fixtures';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';

// Route handlers
import { GET as getPage, PATCH as patchPage, DELETE as deletePage } from '@/app/api/okr-pages/[pageId]/route';
import { POST as postPage } from '@/app/api/okr-pages/route';
import { POST as postObjective } from '@/app/api/objectives/route';
import { PATCH as patchObjective, DELETE as deleteObjective } from '@/app/api/objectives/[objectiveId]/route';
import { POST as postKR } from '@/app/api/key-results/route';
import { PATCH as patchKR } from '@/app/api/key-results/[krId]/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

// Shared setup helper: org + team + owner token
async function setup(ownerName = 'Owner') {
  const { orgId } = await createOrg();
  const { teamId } = await createTeam(orgId);
  const owner = await createUser({ name: ownerName, role: 'member' });
  await addTeamMember(teamId, owner.userId, 'owner');
  const ownerToken = await owner.refreshToken();
  return { orgId, teamId, owner, ownerToken };
}

// ── 1. Create OKR page ────────────────────────────────────────────────────────

it('team owner creates an OKR page and it starts as draft', async () => {
  const { teamId, ownerToken } = await setup();

  const res = await postPage(
    req('POST', '/api/okr-pages', {
      body: { teamId, periodType: 'annual', year: 2025 },
      token: ownerToken,
    })
  );
  expect(res.status).toBe(201);
  const { data } = await json(res);
  expect(data.status).toBe('draft');
  expect(data.teamId.toString()).toBe(teamId);
});

it('creating a duplicate page for the same period returns 409', async () => {
  const { teamId, ownerToken } = await setup();
  await createOKRPage(teamId, { year: 2025, type: 'annual' });

  const res = await postPage(
    req('POST', '/api/okr-pages', {
      body: { teamId, periodType: 'annual', year: 2025 },
      token: ownerToken,
    })
  );
  expect(res.status).toBe(409);
});

// ── 2. Add objective ──────────────────────────────────────────────────────────

it('team owner adds an objective to their page', async () => {
  const { teamId, ownerToken } = await setup();
  const { pageId } = await createOKRPage(teamId);

  const res = await postObjective(
    req('POST', '/api/objectives', {
      body: { okrPageId: pageId, title: 'Grow revenue 30%' },
      token: ownerToken,
    })
  );
  expect(res.status).toBe(201);
  const { data } = await json(res);
  expect(data.title).toBe('Grow revenue 30%');
  expect(data.okrPageId.toString()).toBe(pageId);
});

// ── 3. Update objective ───────────────────────────────────────────────────────

it('team owner updates an objective title', async () => {
  const { teamId, ownerToken } = await setup();
  const { pageId } = await createOKRPage(teamId);
  const { objectiveId } = await createObjective(pageId, 'Old Title');

  const res = await patchObjective(
    req('PATCH', `/api/objectives/${objectiveId}`, {
      body: { title: 'New Title' },
      token: ownerToken,
    }),
    { params: Promise.resolve({ objectiveId }) }
  );
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data.title).toBe('New Title');
});

// ── 4. Add key result ─────────────────────────────────────────────────────────

it('team owner adds a key result to an objective', async () => {
  const { teamId, ownerToken } = await setup();
  const { pageId } = await createOKRPage(teamId);
  const { objectiveId } = await createObjective(pageId);

  const res = await postKR(
    req('POST', '/api/key-results', {
      body: {
        objectiveId,
        title: 'Increase MRR to $500k',
        metric: 'MRR',
        targetValue: 500000,
      },
      token: ownerToken,
    })
  );
  expect(res.status).toBe(201);
  const { data } = await json(res);
  expect(data.title).toBe('Increase MRR to $500k');
});

// ── 5. Update KR score → objective score auto-updates ─────────────────────────

it('updating a KR score auto-recomputes the objective score', async () => {
  const { teamId, ownerToken } = await setup();
  const { pageId } = await createOKRPage(teamId);
  const { objectiveId } = await createObjective(pageId);
  const { krId: krId1 } = await createKeyResult(objectiveId);
  const { krId: krId2 } = await createKeyResult(objectiveId);

  await patchKR(
    req('PATCH', `/api/key-results/${krId1}`, { body: { score: 0.8 }, token: ownerToken }),
    { params: Promise.resolve({ krId: krId1 }) }
  );
  await patchKR(
    req('PATCH', `/api/key-results/${krId2}`, { body: { score: 0.4 }, token: ownerToken }),
    { params: Promise.resolve({ krId: krId2 }) }
  );

  const objective = await Objective.findById(objectiveId).lean();
  // Average of 0.8 and 0.4 = 0.6
  expect(objective!.score).toBe(0.6);
});

// ── 6. Publish blocked — no objectives ───────────────────────────────────────

it('cannot publish an OKR page with no objectives', async () => {
  const { teamId, ownerToken } = await setup();
  const { pageId } = await createOKRPage(teamId);

  const res = await patchPage(
    req('PATCH', `/api/okr-pages/${pageId}`, {
      body: { status: 'published' },
      token: ownerToken,
    }),
    { params: Promise.resolve({ pageId }) }
  );
  expect(res.status).toBe(422);
  const { error } = await json(res);
  expect(error).toMatch(/objective/i);
});

// ── 7. Publish blocked — KR has no owners ────────────────────────────────────

it('cannot publish when a key result has no owners', async () => {
  const { teamId, ownerToken } = await setup();
  const { pageId } = await createOKRPage(teamId);
  const { objectiveId } = await createObjective(pageId);
  await createKeyResult(objectiveId, { owners: [] }); // no owners

  const res = await patchPage(
    req('PATCH', `/api/okr-pages/${pageId}`, {
      body: { status: 'published' },
      token: ownerToken,
    }),
    { params: Promise.resolve({ pageId }) }
  );
  expect(res.status).toBe(422);
  const { error } = await json(res);
  expect(error).toMatch(/owner/i);
});

// ── 8. Successful publish ─────────────────────────────────────────────────────

it('team owner successfully publishes a page with valid objectives and owned KRs', async () => {
  const { teamId, ownerToken, owner } = await setup();
  const { pageId } = await createOKRPage(teamId);
  const { objectiveId } = await createObjective(pageId);
  await createKeyResult(objectiveId, {
    owners: [{ type: 'user', id: owner.userId, displayName: owner.name }],
  });

  const res = await patchPage(
    req('PATCH', `/api/okr-pages/${pageId}`, {
      body: { status: 'published' },
      token: ownerToken,
    }),
    { params: Promise.resolve({ pageId }) }
  );
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data.status).toBe('published');
});

// ── 9. Revert to draft ────────────────────────────────────────────────────────

it('team owner reverts a published page back to draft', async () => {
  const { teamId, ownerToken, owner } = await setup();
  const { pageId } = await createOKRPage(teamId);
  const { objectiveId } = await createObjective(pageId);
  await createKeyResult(objectiveId, {
    owners: [{ type: 'user', id: owner.userId, displayName: owner.name }],
  });

  // Publish
  await patchPage(
    req('PATCH', `/api/okr-pages/${pageId}`, { body: { status: 'published' }, token: ownerToken }),
    { params: Promise.resolve({ pageId }) }
  );

  // Revert
  const res = await patchPage(
    req('PATCH', `/api/okr-pages/${pageId}`, { body: { status: 'draft' }, token: ownerToken }),
    { params: Promise.resolve({ pageId }) }
  );
  expect(res.status).toBe(200);
  expect((await json(res)).data.status).toBe('draft');
});

// ── 10. Delete page cascades ──────────────────────────────────────────────────

it('deleting an OKR page cascades to objectives and key results', async () => {
  const { teamId, ownerToken } = await setup();
  const { pageId } = await createOKRPage(teamId);
  const { objectiveId } = await createObjective(pageId);
  await createKeyResult(objectiveId);
  await createKeyResult(objectiveId);

  const res = await deletePage(
    req('DELETE', `/api/okr-pages/${pageId}`, { token: ownerToken }),
    { params: Promise.resolve({ pageId }) }
  );
  expect(res.status).toBe(200);

  expect(await OKRPage.findById(pageId)).toBeNull();
  expect(await Objective.findById(objectiveId)).toBeNull();
  expect(await KeyResult.countDocuments({ objectiveId })).toBe(0);
});

// ── 11. Member without owner role cannot create page ─────────────────────────

it('a team member without owner role cannot create an OKR page', async () => {
  const { teamId } = await setup();
  const plainMember = await createUser({ role: 'member' });
  await addTeamMember(teamId, plainMember.userId, 'member');
  const memberToken = await plainMember.refreshToken();

  const res = await postPage(
    req('POST', '/api/okr-pages', {
      body: { teamId, periodType: 'annual', year: 2025 },
      token: memberToken,
    })
  );
  expect(res.status).toBe(403);
  expect(await OKRPage.countDocuments()).toBe(0);
});

// ── 12. Member without owner role cannot edit page ────────────────────────────

it('a team member without owner role cannot edit an OKR page', async () => {
  const { teamId } = await setup();
  const { pageId } = await createOKRPage(teamId);
  const { objectiveId } = await createObjective(pageId);

  const plainMember = await createUser({ role: 'member' });
  await addTeamMember(teamId, plainMember.userId, 'member');
  const memberToken = await plainMember.refreshToken();

  const res = await patchObjective(
    req('PATCH', `/api/objectives/${objectiveId}`, {
      body: { title: 'Sneaky edit' },
      token: memberToken,
    }),
    { params: Promise.resolve({ objectiveId }) }
  );
  expect(res.status).toBe(403);

  // Title unchanged
  const obj = await Objective.findById(objectiveId).lean();
  expect(obj!.title).not.toBe('Sneaky edit');
});
