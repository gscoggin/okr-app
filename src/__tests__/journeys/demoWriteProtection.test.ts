/**
 * Demo write-protection journeys
 *
 * Verifies that all write routes reject requests carrying isDemo: true.
 *
 * Covered:
 *   1.  POST /api/objectives — demo user blocked (403)
 *   2.  PATCH /api/objectives/[objectiveId] — demo user blocked
 *   3.  DELETE /api/objectives/[objectiveId] — demo user blocked
 *   4.  POST /api/key-results — demo user blocked
 *   5.  PATCH /api/key-results/[krId] — demo user blocked
 *   6.  DELETE /api/key-results/[krId] — demo user blocked
 *   7.  PATCH /api/okr-pages/[pageId] — demo user blocked
 *   8.  Regular member (isDemo: false) is NOT blocked by these routes
 */

import mongoose from 'mongoose';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { req } from '../helpers/request';
import { createUser, createOrg, createTeam, createOKRPage, createObjective, createKeyResult } from '../helpers/fixtures';
import { signDemoToken } from '@/lib/auth';

import { POST as postObjective } from '@/app/api/objectives/route';
import { PATCH as patchObjective, DELETE as deleteObjective } from '@/app/api/objectives/[objectiveId]/route';
import { POST as postKR } from '@/app/api/key-results/route';
import { PATCH as patchKR, DELETE as deleteKR } from '@/app/api/key-results/[krId]/route';
import { PATCH as patchPage } from '@/app/api/okr-pages/[pageId]/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

// ── Helpers ───────────────────────────────────────────────────────────────────

async function makeDemoToken(tenantId: string) {
  return signDemoToken({
    userId: new mongoose.Types.ObjectId().toString(),
    tenantId,
    name: 'Demo User',
    email: 'demo@demo.local',
    role: 'member',
    teamMemberships: [],
  });
}

// ── 1. POST /api/objectives ───────────────────────────────────────────────────

it('demo user cannot create an objective', async () => {
  const { orgId, tenantId } = await createOrg();
  const token = await makeDemoToken(tenantId);
  const res = await postObjective(req('POST', '/api/objectives', {
    token,
    body: { okrPageId: new mongoose.Types.ObjectId().toString(), title: 'Test' },
  }));
  expect(res.status).toBe(403);
});

// ── 2. PATCH /api/objectives/[objectiveId] ────────────────────────────────────

it('demo user cannot update an objective', async () => {
  const { orgId, tenantId } = await createOrg();
  const token = await makeDemoToken(tenantId);
  const objectiveId = new mongoose.Types.ObjectId().toString();
  const res = await patchObjective(
    req('PATCH', `/api/objectives/${objectiveId}`, { token, body: { title: 'Updated' } }),
    { params: Promise.resolve({ objectiveId }) }
  );
  expect(res.status).toBe(403);
});

// ── 3. DELETE /api/objectives/[objectiveId] ───────────────────────────────────

it('demo user cannot delete an objective', async () => {
  const { orgId, tenantId } = await createOrg();
  const token = await makeDemoToken(tenantId);
  const objectiveId = new mongoose.Types.ObjectId().toString();
  const res = await deleteObjective(
    req('DELETE', `/api/objectives/${objectiveId}`, { token }),
    { params: Promise.resolve({ objectiveId }) }
  );
  expect(res.status).toBe(403);
});

// ── 4. POST /api/key-results ──────────────────────────────────────────────────

it('demo user cannot create a key result', async () => {
  const { tenantId } = await createOrg();
  const token = await makeDemoToken(tenantId);
  const res = await postKR(req('POST', '/api/key-results', {
    token,
    body: { objectiveId: new mongoose.Types.ObjectId().toString(), title: 'KR' },
  }));
  expect(res.status).toBe(403);
});

// ── 5. PATCH /api/key-results/[krId] ─────────────────────────────────────────

it('demo user cannot update a key result', async () => {
  const { tenantId } = await createOrg();
  const token = await makeDemoToken(tenantId);
  const krId = new mongoose.Types.ObjectId().toString();
  const res = await patchKR(
    req('PATCH', `/api/key-results/${krId}`, { token, body: { title: 'Updated' } }),
    { params: Promise.resolve({ krId }) }
  );
  expect(res.status).toBe(403);
});

// ── 6. DELETE /api/key-results/[krId] ────────────────────────────────────────

it('demo user cannot delete a key result', async () => {
  const { tenantId } = await createOrg();
  const token = await makeDemoToken(tenantId);
  const krId = new mongoose.Types.ObjectId().toString();
  const res = await deleteKR(
    req('DELETE', `/api/key-results/${krId}`, { token }),
    { params: Promise.resolve({ krId }) }
  );
  expect(res.status).toBe(403);
});

// ── 7. PATCH /api/okr-pages/[pageId] ─────────────────────────────────────────

it('demo user cannot update an OKR page', async () => {
  const { tenantId } = await createOrg();
  const token = await makeDemoToken(tenantId);
  const pageId = new mongoose.Types.ObjectId().toString();
  const res = await patchPage(
    req('PATCH', `/api/okr-pages/${pageId}`, { token, body: { status: 'published' } }),
    { params: Promise.resolve({ pageId }) }
  );
  expect(res.status).toBe(403);
});

// ── 8. Regular member is NOT blocked ─────────────────────────────────────────

it('admin user is not blocked by demo write protection', async () => {
  const { orgId, tenantId } = await createOrg();
  const { teamId } = await createTeam(orgId, 'Team', tenantId);
  const admin = await createUser({ role: 'admin', tenantId });
  const { pageId } = await createOKRPage(teamId, { tenantId });
  const res = await postObjective(req('POST', '/api/objectives', {
    token: admin.token,
    body: { okrPageId: pageId, title: 'My Objective' },
  }));
  // 403 would mean demo-blocked; any other status means we passed the demo check
  expect(res.status).not.toBe(403);
});
