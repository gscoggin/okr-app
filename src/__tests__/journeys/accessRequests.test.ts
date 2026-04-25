/**
 * Access request admin review journeys
 *
 * Covered:
 *   1.  Admin can list all access requests
 *   2.  Non-admin cannot list access requests
 *   3.  Unauthenticated cannot list access requests
 *   4.  Empty list returned when no requests exist
 *   5.  Approving a request generates a workspace_create invite code
 *   6.  Approving a request emails the requester (mocked)
 *   7.  Approving a request stores the code on the access request document
 *   8.  Re-approving an already-approved request does not generate a second code
 *   9.  Admin can decline a pending request
 *   10. Admin can set status back to pending
 *   11. Invalid status value is rejected
 *   12. Non-admin cannot update request status
 *   13. Unauthenticated cannot update request status
 *   14. 404 returned for non-existent request id
 */

import mongoose from 'mongoose';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { req } from '../helpers/request';
import { createUser } from '../helpers/fixtures';
import AccessRequest from '@/models/AccessRequest';
import InviteCode from '@/models/InviteCode';

import { GET as getRequests } from '@/app/api/demo/access-requests/route';
import { PATCH as patchRequest } from '@/app/api/demo/access-requests/[id]/route';

jest.mock('@/lib/email', () => ({
  sendInviteCodeEmail: jest.fn().mockResolvedValue(undefined),
}));

import { sendInviteCodeEmail } from '@/lib/email';
const mockSendInviteCodeEmail = sendInviteCodeEmail as jest.Mock;

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => { clearTestDB(); mockSendInviteCodeEmail.mockClear(); });

async function seedRequest(overrides: Partial<{ status: string; email: string; name: string }> = {}) {
  return AccessRequest.create({
    name: overrides.name ?? 'Jane',
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

// ── 5. Approval generates a workspace_create invite code ─────────────────────

it('approving a request generates a workspace_create invite code', async () => {
  const admin = await createUser({ role: 'admin' });
  const doc = await seedRequest({ name: 'Jane', email: 'jane@example.com' });
  const id = doc._id.toString();

  const res = await patchRequest(
    req('PATCH', `/api/demo/access-requests/${id}`, { token: admin.token, body: { status: 'approved' } }),
    { params: Promise.resolve({ id }) }
  );
  expect(res.status).toBe(200);

  const code = await InviteCode.findOne({ type: 'workspace_create', note: 'Jane' });
  expect(code).toBeTruthy();
  expect(code?.type).toBe('workspace_create');
});

// ── 6. Approval emails the requester ─────────────────────────────────────────

it('approving a request emails the invite code to the requester', async () => {
  const admin = await createUser({ role: 'admin' });
  const doc = await seedRequest({ name: 'Jane', email: 'jane@example.com' });
  const id = doc._id.toString();

  await patchRequest(
    req('PATCH', `/api/demo/access-requests/${id}`, { token: admin.token, body: { status: 'approved' } }),
    { params: Promise.resolve({ id }) }
  );

  expect(mockSendInviteCodeEmail).toHaveBeenCalledTimes(1);
  expect(mockSendInviteCodeEmail).toHaveBeenCalledWith(
    'jane@example.com',
    'Jane',
    expect.stringMatching(/^[A-Z0-9]{8}$/)
  );
});

// ── 7. Approval stores code on the request document ──────────────────────────

it('approving stores the invite code on the access request document', async () => {
  const admin = await createUser({ role: 'admin' });
  const doc = await seedRequest();
  const id = doc._id.toString();

  const res = await patchRequest(
    req('PATCH', `/api/demo/access-requests/${id}`, { token: admin.token, body: { status: 'approved' } }),
    { params: Promise.resolve({ id }) }
  );
  const { data } = await res.json();
  expect(data.inviteCode).toMatch(/^[A-Z0-9]{8}$/);

  const updated = await AccessRequest.findById(id);
  expect(updated?.inviteCode).toBe(data.inviteCode);
});

// ── 8. Re-approving does not generate a second code ──────────────────────────

it('re-approving an already-approved request does not generate a second code', async () => {
  const admin = await createUser({ role: 'admin' });
  const doc = await seedRequest({ status: 'approved' });
  await AccessRequest.findByIdAndUpdate(doc._id, { inviteCode: 'EXISTING1' });
  const id = doc._id.toString();

  await patchRequest(
    req('PATCH', `/api/demo/access-requests/${id}`, { token: admin.token, body: { status: 'approved' } }),
    { params: Promise.resolve({ id }) }
  );

  expect(mockSendInviteCodeEmail).not.toHaveBeenCalled();
  expect(await InviteCode.countDocuments()).toBe(0);
});

// ── 9. Admin declines request ─────────────────────────────────────────────────

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
  expect(mockSendInviteCodeEmail).not.toHaveBeenCalled();
});

// ── 10. Admin sets back to pending ────────────────────────────────────────────

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

// ── 11. Invalid status rejected ───────────────────────────────────────────────

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

// ── 12. Non-admin blocked ─────────────────────────────────────────────────────

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

// ── 13. Unauthenticated blocked ───────────────────────────────────────────────

it('unauthenticated cannot update request status', async () => {
  const doc = await seedRequest();
  const id = doc._id.toString();
  const res = await patchRequest(
    req('PATCH', `/api/demo/access-requests/${id}`, { body: { status: 'approved' } }),
    { params: Promise.resolve({ id }) }
  );
  expect(res.status).toBe(401);
});

// ── 14. 404 for non-existent id ───────────────────────────────────────────────

it('returns 404 for non-existent request id', async () => {
  const admin = await createUser({ role: 'admin' });
  const id = new mongoose.Types.ObjectId().toString();
  const res = await patchRequest(
    req('PATCH', `/api/demo/access-requests/${id}`, { token: admin.token, body: { status: 'approved' } }),
    { params: Promise.resolve({ id }) }
  );
  expect(res.status).toBe(404);
});
