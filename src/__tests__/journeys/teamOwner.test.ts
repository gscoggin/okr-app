/**
 * Team Owner user journeys
 *
 * Covered:
 *   1.  Create an OKR page for a team (starts as draft)
 *   2.  Duplicate page for same period returns 409
 *   3.  Add an objective to a page
 *   4.  Update an objective's title
 *   5.  Add a key result to an objective
 *   6.  Update a KR score → objective score auto-recomputed
 *   7.  Cannot publish an empty page (no objectives)
 *   8.  Cannot publish when a key result has no owners
 *   9.  Successfully publish a page with valid objectives + owned KRs
 *   10. Revert a published page back to draft
 *   11. Delete an OKR page (cascades to objectives and KRs)
 *   12. A member without owner role cannot create an OKR page
 *   13. A member without owner role cannot edit an OKR page
 *   14. Creating a quarterly page auto-creates the annual page if missing
 *   15. The quarterly page's parentOKRPageId points to the annual page
 *   16. Creating a quarterly page when annual exists reuses it (no duplicate)
 *   17. Creating multiple quarterly pages for the same year share one annual parent
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
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';

import { PATCH as patchPage, DELETE as deletePage } from '@/app/api/okr-pages/[pageId]/route';
import { POST as postPage } from '@/app/api/okr-pages/route';
import { POST as postObjective } from '@/app/api/objectives/route';
import { PATCH as patchObjective } from '@/app/api/objectives/[objectiveId]/route';
import { POST as postKR } from '@/app/api/key-results/route';
import { PATCH as patchKR } from '@/app/api/key-results/[krId]/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

async function setup(ownerName = 'Owner') {
  const { tenantId } = await createTenant();
  const { orgId } = await createOrg('Test Org', tenantId);
  const { teamId } = await createTeam(orgId, 'Test Team', tenantId);
  const owner = await createUser({ name: ownerName, role: 'member', tenantId });
  await addTeamMember(teamId, owner.userId, 'owner');
  const ownerToken = await owner.refreshToken();
  return { tenantId, orgId, teamId, owner, ownerToken };
}

// ── 1. Create OKR page ────────────────────────────────────────────────────────

it('team owner creates an OKR page and it starts as draft', async () => {
  const { teamId, ownerToken } = await setup();

  const res = await postPage(
    req('POST', '/api/okr-pages', { body: { teamId, periodType: 'annual', year: 2025 }, token: ownerToken })
  );
  expect(res.status).toBe(201);
  const { data } = await json(res);
  expect(data.status).toBe('draft');
  expect(data.teamId.toString()).toBe(teamId);
});

// ── 2. Duplicate page → 409 ───────────────────────────────────────────────────

it('creating a duplicate page for the same period returns 409', async () => {
  const { teamId, tenantId, ownerToken } = await setup();
  await createOKRPage(teamId, { year: 2025, type: 'annual', tenantId });

  const res = await postPage(
    req('POST', '/api/okr-pages', { body: { teamId, periodType: 'annual', year: 2025 }, token: ownerToken })
  );
  expect(res.status).toBe(409);
});

// ── 3. Add objective ──────────────────────────────────────────────────────────

it('team owner adds an objective to their page', async () => {
  const { teamId, tenantId, ownerToken } = await setup();
  const { pageId } = await createOKRPage(teamId, { tenantId });

  const res = await postObjective(
    req('POST', '/api/objectives', { body: { okrPageId: pageId, title: 'Grow revenue 30%' }, token: ownerToken })
  );
  expect(res.status).toBe(201);
  const { data } = await json(res);
  expect(data.title).toBe('Grow revenue 30%');
});

// ── 4. Update objective ───────────────────────────────────────────────────────

it('team owner updates an objective title', async () => {
  const { teamId, tenantId, ownerToken } = await setup();
  const { pageId } = await createOKRPage(teamId, { tenantId });
  const { objectiveId } = await createObjective(pageId, 'Old Title');

  const res = await patchObjective(
    req('PATCH', `/api/objectives/${objectiveId}`, { body: { title: 'New Title' }, token: ownerToken }),
    { params: Promise.resolve({ objectiveId }) }
  );
  expect(res.status).toBe(200);
  expect((await json(res)).data.title).toBe('New Title');
});

// ── 5. Add key result ─────────────────────────────────────────────────────────

it('team owner adds a key result to an objective', async () => {
  const { teamId, tenantId, ownerToken } = await setup();
  const { pageId } = await createOKRPage(teamId, { tenantId });
  const { objectiveId } = await createObjective(pageId);

  const res = await postKR(
    req('POST', '/api/key-results', {
      body: { objectiveId, title: 'Increase MRR to $500k', metric: 'MRR', targetValue: 500000 },
      token: ownerToken,
    })
  );
  expect(res.status).toBe(201);
  expect((await json(res)).data.title).toBe('Increase MRR to $500k');
});

// ── 6. KR score → objective score auto-updates ────────────────────────────────

it('updating a KR score auto-recomputes the objective score', async () => {
  const { teamId, tenantId, ownerToken } = await setup();
  const { pageId } = await createOKRPage(teamId, { tenantId });
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

  // Average of 0.8 and 0.4 = 0.6
  expect((await Objective.findById(objectiveId).lean())!.score).toBe(0.6);
});

// ── 7. Publish blocked — no objectives ───────────────────────────────────────

it('cannot publish an OKR page with no objectives', async () => {
  const { teamId, tenantId, ownerToken } = await setup();
  const { pageId } = await createOKRPage(teamId, { tenantId });

  const res = await patchPage(
    req('PATCH', `/api/okr-pages/${pageId}`, { body: { status: 'published' }, token: ownerToken }),
    { params: Promise.resolve({ pageId }) }
  );
  expect(res.status).toBe(422);
  expect((await json(res)).error).toMatch(/objective/i);
});

// ── 8. Publish blocked — KR has no owners ────────────────────────────────────

it('cannot publish when a key result has no owners', async () => {
  const { teamId, tenantId, ownerToken } = await setup();
  const { pageId } = await createOKRPage(teamId, { tenantId });
  const { objectiveId } = await createObjective(pageId);
  await createKeyResult(objectiveId, { owners: [] });

  const res = await patchPage(
    req('PATCH', `/api/okr-pages/${pageId}`, { body: { status: 'published' }, token: ownerToken }),
    { params: Promise.resolve({ pageId }) }
  );
  expect(res.status).toBe(422);
  expect((await json(res)).error).toMatch(/owner/i);
});

// ── 9. Successful publish ─────────────────────────────────────────────────────

it('team owner successfully publishes a page with valid objectives and owned KRs', async () => {
  const { teamId, tenantId, ownerToken, owner } = await setup();
  const { pageId } = await createOKRPage(teamId, { tenantId });
  const { objectiveId } = await createObjective(pageId);
  await createKeyResult(objectiveId, {
    owners: [{ type: 'user', id: owner.userId, displayName: owner.name }],
  });

  const res = await patchPage(
    req('PATCH', `/api/okr-pages/${pageId}`, { body: { status: 'published' }, token: ownerToken }),
    { params: Promise.resolve({ pageId }) }
  );
  expect(res.status).toBe(200);
  expect((await json(res)).data.status).toBe('published');
});

// ── 10. Revert to draft ───────────────────────────────────────────────────────

it('team owner reverts a published page back to draft', async () => {
  const { teamId, tenantId, ownerToken, owner } = await setup();
  const { pageId } = await createOKRPage(teamId, { tenantId });
  const { objectiveId } = await createObjective(pageId);
  await createKeyResult(objectiveId, {
    owners: [{ type: 'user', id: owner.userId, displayName: owner.name }],
  });

  await patchPage(
    req('PATCH', `/api/okr-pages/${pageId}`, { body: { status: 'published' }, token: ownerToken }),
    { params: Promise.resolve({ pageId }) }
  );
  const res = await patchPage(
    req('PATCH', `/api/okr-pages/${pageId}`, { body: { status: 'draft' }, token: ownerToken }),
    { params: Promise.resolve({ pageId }) }
  );
  expect(res.status).toBe(200);
  expect((await json(res)).data.status).toBe('draft');
});

// ── 11. Delete page cascades ──────────────────────────────────────────────────

it('deleting an OKR page cascades to objectives and key results', async () => {
  const { teamId, tenantId, ownerToken } = await setup();
  const { pageId } = await createOKRPage(teamId, { tenantId });
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

// ── 12. Member without owner role cannot create page ─────────────────────────

it('a team member without owner role cannot create an OKR page', async () => {
  const { teamId, tenantId } = await setup();
  const plainMember = await createUser({ role: 'member', tenantId });
  await addTeamMember(teamId, plainMember.userId, 'member');
  const memberToken = await plainMember.refreshToken();

  const res = await postPage(
    req('POST', '/api/okr-pages', { body: { teamId, periodType: 'annual', year: 2025 }, token: memberToken })
  );
  expect(res.status).toBe(403);
  expect(await OKRPage.countDocuments()).toBe(0);
});

// ── 13. Member without owner role cannot edit page ────────────────────────────

it('a team member without owner role cannot edit an OKR page', async () => {
  const { teamId, tenantId } = await setup();
  const { pageId } = await createOKRPage(teamId, { tenantId });
  const { objectiveId } = await createObjective(pageId);

  const plainMember = await createUser({ role: 'member', tenantId });
  await addTeamMember(teamId, plainMember.userId, 'member');
  const memberToken = await plainMember.refreshToken();

  const res = await patchObjective(
    req('PATCH', `/api/objectives/${objectiveId}`, { body: { title: 'Sneaky edit' }, token: memberToken }),
    { params: Promise.resolve({ objectiveId }) }
  );
  expect(res.status).toBe(403);
  expect((await Objective.findById(objectiveId).lean())!.title).not.toBe('Sneaky edit');
});

// ── 14–17. Annual / quarterly hierarchy ──────────────────────────────────────

it('creating a quarterly page auto-creates the annual page when none exists', async () => {
  const { teamId, ownerToken } = await setup();
  expect(await OKRPage.countDocuments({ teamId, 'period.type': 'annual' })).toBe(0);

  const res = await postPage(
    req('POST', '/api/okr-pages', { body: { teamId, periodType: 'quarterly', year: 2025, quarter: 'Q1' }, token: ownerToken })
  );
  expect(res.status).toBe(201);
  expect(await OKRPage.findOne({ teamId, 'period.type': 'annual', 'period.year': 2025 })).not.toBeNull();
});

it('the quarterly page parentOKRPageId points to the annual page', async () => {
  const { teamId, ownerToken } = await setup();

  const res = await postPage(
    req('POST', '/api/okr-pages', { body: { teamId, periodType: 'quarterly', year: 2025, quarter: 'Q2' }, token: ownerToken })
  );
  const { data: quarterlyPage } = await json(res);
  const annualPage = await OKRPage.findOne({ teamId, 'period.type': 'annual', 'period.year': 2025 });
  expect(quarterlyPage.parentOKRPageId.toString()).toBe(annualPage!._id.toString());
});

it('creating a quarterly page when the annual already exists reuses it without creating a duplicate', async () => {
  const { teamId, tenantId, ownerToken } = await setup();
  const { pageId: annualPageId } = await createOKRPage(teamId, { year: 2025, type: 'annual', tenantId });

  const res = await postPage(
    req('POST', '/api/okr-pages', { body: { teamId, periodType: 'quarterly', year: 2025, quarter: 'Q3' }, token: ownerToken })
  );
  const { data: quarterlyPage } = await json(res);
  expect(await OKRPage.countDocuments({ teamId, 'period.type': 'annual', 'period.year': 2025 })).toBe(1);
  expect(quarterlyPage.parentOKRPageId.toString()).toBe(annualPageId);
});

it('creating multiple quarterly pages for the same year all share the same annual parent', async () => {
  const { teamId, ownerToken } = await setup();

  for (const quarter of ['Q1', 'Q2', 'Q3']) {
    await postPage(req('POST', '/api/okr-pages', {
      body: { teamId, periodType: 'quarterly', year: 2025, quarter },
      token: ownerToken,
    }));
  }

  expect(await OKRPage.countDocuments({ teamId, 'period.type': 'annual', 'period.year': 2025 })).toBe(1);
  expect(await OKRPage.countDocuments({ teamId, 'period.type': 'quarterly', 'period.year': 2025 })).toBe(3);

  const annual = await OKRPage.findOne({ teamId, 'period.type': 'annual', 'period.year': 2025 });
  const quarters = await OKRPage.find({ teamId, 'period.type': 'quarterly', 'period.year': 2025 });
  for (const q of quarters) {
    expect(q.parentOKRPageId!.toString()).toBe(annual!._id.toString());
  }
});
