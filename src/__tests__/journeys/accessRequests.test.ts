/**
 * Access request admin review journeys
 *
 * Covered:
 *   1.  Admin can list all access requests
 *   2.  Non-admin cannot list access requests
 *   3.  Unauthenticated cannot list access requests
 *   4.  Empty list returned when no requests exist
 *   5.  Admin can approve a pending request
 *   6.  Admin can decline a pending request
 *   7.  Admin can set status back to pending
 *   8.  Invalid status value is rejected
 *   9.  Non-admin cannot update request status
 *   10. Unauthenticated cannot update request status
 *   11. 404 returned for non-existent request id
 */

import mongoose from 'mongoose';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { req } from '../helpers/request';
import { createUser } from '../helpers/fixtures';
import AccessRequest from '@/models/AccessRequest';

import { GET as getRequests } from '@/app/api/demo/access-requests/route';
import { PATCH as patchRequest } from '@/app/api/demo/access-requests/[id]/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

async function seedRequest(overrides: Partial<{ status: string; email: string }> = {}) {
  return AccessRequest.create({
    name: 'Jane',
    email: overrides.email ?? 'jane@example.com',
    status: overrides.status ?? 'pending',
  });
}

// ── 1. Admin lists requests ───────────────────────────────────────────────────

it('admin can list all access requests', async () => {
  const admin = await createUser({ role: 'admin' });
  await seedRequest();
  await seedRequest({ email: 'bob@example.com' });
  const res = await getRequests(req('GET', '/api/demo/access-requests', { token: admin.token }));
  expect(res.status).toBe(200);
  const { data } = await res.json();
  expect(data).toHaveLength(2);
});

// ── 2. Non-admin blocked ──────────────────────────────────────────────────────

it('non-admin cannot list access requests', async () => {
  const member = await createUser({ role: 'member' });
  const res = await getRequests(req('GET', '/api/demo/access-requests', { token: member.token }));
  expect(res.status).toBe(403);
});

// ── 3. Unauthenticated blocked ────────────────────────────────────────────────

it('unauthenticated cannot list access requests', async () => {
  const res = await getRequests(req('GET', '/api/demo/access-requests'));
  expect(res.status).toBe(401);
});

// ── 4. Empty list ─────────────────────────────────────────────────────────────

it('returns empty list when no requests exist', async () => {
  const admin = await createUser({ role: 'admin' });
  const res = await getRequests(req('GET', '/api/demo/access-requests', { token: admin.token }));
  expect(res.status).toBe(200);
  expect((await res.json()).data).toHaveLength(0);
});

// ── 5. Admin approves request ─────────────────────────────────────────────────

it('admin can approve a pending request', async () => {
  const admin = await createUser({ role: 'admin' });
  const doc = await seedRequest();
  const id = doc._id.toString();
  const res = await patchRequest(
    req('PATCH', `/api/demo/access-requests/${id}`, { token: admin.token, body: { status: 'approved' } }),
    { params: Promise.resolve({ id }) }
  );
  expect(res.status).toBe(200);
  expect((await res.json()).data.status).toBe('approved');
});

// ── 6. Admin declines request ─────────────────────────────────────────────────

it('admin can decline a pending request', async () => {
  const admin = await createUser({ role: 'admin' });
  const doc = await seedRequest();
  const id = doc._id.toString();
  const res = await patchRequest(
    req('PATCH', `/api/demo/access-requests/${id}`, { token: admin.token, body: { status: 'declined' } }),
    { params: Promise.resolve({ id }) }
  );
  expect(res.status).toBe(200);
  expect((await res.json()).data.status).toBe('declined');
});

// ── 7. Admin sets back to pending ─────────────────────────────────────────────

it('admin can set status back to pending', async () => {
  const admin = await createUser({ role: 'admin' });
  const doc = await seedRequest({ status: 'declined' });
  const id = doc._id.toString();
  const res = await patchRequest(
    req('PATCH', `/api/demo/access-requests/${id}`, { token: admin.token, body: { status: 'pending' } }),
    { params: Promise.resolve({ id }) }
  );
  expect(res.status).toBe(200);
  expect((await res.json()).data.status).toBe('pending');
});

// ── 8. Invalid status rejected ────────────────────────────────────────────────

it('rejects invalid status value', async () => {
  const admin = await createUser({ role: 'admin' });
  const doc = await seedRequest();
  const id = doc._id.toString();
  const res = await patchRequest(
    req('PATCH', `/api/demo/access-requests/${id}`, { token: admin.token, body: { status: 'hacked' } }),
    { params: Promise.resolve({ id }) }
  );
  expect(res.status).toBe(400);
});

// ── 9. Non-admin blocked ──────────────────────────────────────────────────────

it('non-admin cannot update request status', async () => {
  const member = await createUser({ role: 'member' });
  const doc = await seedRequest();
  const id = doc._id.toString();
  const res = await patchRequest(
    req('PATCH', `/api/demo/access-requests/${id}`, { token: member.token, body: { status: 'approved' } }),
    { params: Promise.resolve({ id }) }
  );
  expect(res.status).toBe(403);
});

// ── 10. Unauthenticated blocked ───────────────────────────────────────────────

it('unauthenticated cannot update request status', async () => {
  const doc = await seedRequest();
  const id = doc._id.toString();
  const res = await patchRequest(
    req('PATCH', `/api/demo/access-requests/${id}`, { body: { status: 'approved' } }),
    { params: Promise.resolve({ id }) }
  );
  expect(res.status).toBe(401);
});

// ── 11. 404 for non-existent id ───────────────────────────────────────────────

it('returns 404 for non-existent request id', async () => {
  const admin = await createUser({ role: 'admin' });
  const id = new mongoose.Types.ObjectId().toString();
  const res = await patchRequest(
    req('PATCH', `/api/demo/access-requests/${id}`, { token: admin.token, body: { status: 'approved' } }),
    { params: Promise.resolve({ id }) }
  );
  expect(res.status).toBe(404);
});
