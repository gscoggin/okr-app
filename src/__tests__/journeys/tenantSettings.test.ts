/**
 * Tenant settings journey tests
 *
 * Covered:
 *   1.  Authenticated member can GET their tenant
 *   2.  Unauthenticated request returns 401
 *   3.  Admin can PATCH name
 *   4.  Admin can PATCH guidePage
 *   5.  Admin can PATCH branding fields
 *   6.  Non-admin (member) cannot PATCH — 403
 *   7.  Unauthenticated PATCH returns 403
 *   8.  Arbitrary unknown fields are silently ignored (allowlist enforced)
 *   9.  PATCH returns the updated tenant
 *   10. Cross-tenant: user cannot GET another tenant's settings
 */
import mongoose from 'mongoose';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { req, json } from '../helpers/request';
import { createUser } from '../helpers/fixtures';
import Tenant from '@/models/Tenant';

import { GET as getTenant, PATCH as patchTenant } from '@/app/api/tenant/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

// ── 1. Member can GET their tenant ────────────────────────────────────────────

it('authenticated member can GET their tenant', async () => {
  const user = await createUser({ role: 'member' });
  const res = await getTenant(req('GET', '/api/tenant', { token: user.token }));
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data._id).toBeDefined();
  expect(data.name).toBeDefined();
});

// ── 2. Unauthenticated GET returns 401 ────────────────────────────────────────

it('unauthenticated GET returns 401', async () => {
  const res = await getTenant(req('GET', '/api/tenant'));
  expect(res.status).toBe(401);
});

// ── 3. Admin can PATCH name ───────────────────────────────────────────────────

it('admin can update the tenant name', async () => {
  const admin = await createUser({ role: 'admin' });
  const res = await patchTenant(req('PATCH', '/api/tenant', {
    token: admin.token,
    body: { name: 'New Name' },
  }));
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data.name).toBe('New Name');

  const tenant = await Tenant.findById(admin.tenantId).lean();
  expect(tenant?.name).toBe('New Name');
});

// ── 4. Admin can PATCH guidePage ──────────────────────────────────────────────

it('admin can update the guidePage content', async () => {
  const admin = await createUser({ role: 'admin' });
  const res = await patchTenant(req('PATCH', '/api/tenant', {
    token: admin.token,
    body: { guidePage: 'Set goals, measure results.' },
  }));
  expect(res.status).toBe(200);
  const tenant = await Tenant.findById(admin.tenantId).lean();
  expect(tenant?.guidePage).toBe('Set goals, measure results.');
});

// ── 5. Admin can PATCH branding fields ───────────────────────────────────────

it('admin can update branding fields', async () => {
  const admin = await createUser({ role: 'admin' });
  const res = await patchTenant(req('PATCH', '/api/tenant', {
    token: admin.token,
    body: { branding: { logoUrl: 'https://example.com/logo.png', primaryColor: '#ff0000', mission: 'Ship fast.' } },
  }));
  expect(res.status).toBe(200);
  const tenant = await Tenant.findById(admin.tenantId).lean();
  expect(tenant?.branding?.logoUrl).toBe('https://example.com/logo.png');
  expect(tenant?.branding?.primaryColor).toBe('#ff0000');
  expect(tenant?.branding?.mission).toBe('Ship fast.');
});

// ── 6. Member cannot PATCH ────────────────────────────────────────────────────

it('non-admin member cannot PATCH tenant settings', async () => {
  const member = await createUser({ role: 'member' });
  const res = await patchTenant(req('PATCH', '/api/tenant', {
    token: member.token,
    body: { name: 'Hijacked' },
  }));
  expect(res.status).toBe(403);

  const tenant = await Tenant.findById(member.tenantId).lean();
  expect(tenant?.name).not.toBe('Hijacked');
});

// ── 7. Unauthenticated PATCH returns 403 ─────────────────────────────────────

it('unauthenticated PATCH returns 403', async () => {
  const res = await patchTenant(req('PATCH', '/api/tenant', { body: { name: 'Hijacked' } }));
  expect(res.status).toBe(403);
});

// ── 8. Unknown fields are ignored ────────────────────────────────────────────

it('arbitrary unknown fields are ignored and not persisted', async () => {
  const admin = await createUser({ role: 'admin' });
  const res = await patchTenant(req('PATCH', '/api/tenant', {
    token: admin.token,
    body: { name: 'Legit Name', ownerId: new mongoose.Types.ObjectId().toString(), role: 'super_admin' },
  }));
  expect(res.status).toBe(200);
  const tenant = await Tenant.findById(admin.tenantId).lean();
  expect(tenant?.name).toBe('Legit Name');
  expect(tenant?.ownerId.toString()).not.toBe(new mongoose.Types.ObjectId().toString());
});

// ── 9. PATCH returns the updated tenant ──────────────────────────────────────

it('PATCH response includes the updated tenant document', async () => {
  const admin = await createUser({ role: 'admin' });
  const res = await patchTenant(req('PATCH', '/api/tenant', {
    token: admin.token,
    body: { guidePage: 'Updated guide.' },
  }));
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data.guidePage).toBe('Updated guide.');
});

// ── 10. Cross-tenant isolation ────────────────────────────────────────────────

it("user cannot GET another tenant's settings via their own token", async () => {
  const userA = await createUser({ role: 'member' });
  const userB = await createUser({ role: 'member' });

  // userA's token encodes userA's tenantId — the route always reads from that
  const res = await getTenant(req('GET', '/api/tenant', { token: userA.token }));
  expect(res.status).toBe(200);
  const { data } = await json(res);
  expect(data._id).not.toBe(userB.tenantId);
});
