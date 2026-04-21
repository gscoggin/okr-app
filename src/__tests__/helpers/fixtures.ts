/**
 * Fixture factories for test data.
 * Call createTenant() first, then pass tenantId to other factories so all
 * data lands in the same tenant and route-level tenantId filters work correctly.
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { signToken } from '@/lib/auth';
import User from '@/models/User';
import Org from '@/models/Org';
import Team from '@/models/Team';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';
import Tenant from '@/models/Tenant';
import type { UserRole, TeamRole, PeriodType, Quarter } from '@/types';

// ─── Tenant ───────────────────────────────────────────────────────────────────

export async function createTenant(name = 'Test Company') {
  const slug = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const tenant = await Tenant.create({
    name,
    slug,
    ownerId: new mongoose.Types.ObjectId(),
    branding: {},
  });
  return { tenantId: tenant._id.toString() };
}

// ─── Users ────────────────────────────────────────────────────────────────────

interface UserFixture {
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  token: string;
  refreshToken: () => Promise<string>;
}

export async function createUser(opts: {
  email?: string;
  password?: string;
  name?: string;
  role?: UserRole;
  tenantId?: string;
}): Promise<UserFixture> {
  const name = opts.name ?? 'Test User';
  const email = (opts.email ?? `user-${Date.now()}@test.com`).toLowerCase();
  const password = opts.password ?? 'password123';
  const role = opts.role ?? 'member';

  // Auto-create a tenant when none is provided so isolated user tests still work
  const tenantId = opts.tenantId ?? (await createTenant()).tenantId;

  const passwordHash = await bcrypt.hash(password, 4);
  const user = await User.create({
    name,
    email,
    passwordHash,
    role,
    tenantId: new mongoose.Types.ObjectId(tenantId),
  });
  const userId = user._id.toString();

  const makeToken = async () => {
    const fresh = await User.findById(userId).lean();
    if (!fresh) throw new Error('User not found');
    return signToken({
      userId,
      tenantId: fresh.tenantId?.toString() ?? tenantId,
      name: fresh.name,
      email: fresh.email,
      role: fresh.role,
      teamMemberships: (fresh.teamMemberships ?? []).map((m) => ({
        teamId: m.teamId.toString(),
        role: m.role,
      })),
    });
  };

  return {
    userId,
    tenantId,
    name,
    email,
    password,
    role,
    token: await makeToken(),
    refreshToken: makeToken,
  };
}

// ─── Orgs ─────────────────────────────────────────────────────────────────────

export async function createOrg(name = 'Test Org', tenantId?: string) {
  const tid = tenantId ?? (await createTenant()).tenantId;
  const org = await Org.create({
    name,
    slug: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    tenantId: new mongoose.Types.ObjectId(tid),
  });
  return { orgId: org._id.toString(), name, tenantId: tid };
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export async function createTeam(orgId: string, name = 'Test Team', tenantId?: string) {
  const org = await Org.findById(orgId);
  if (!org) throw new Error('Org not found');

  const tid = tenantId ?? org.tenantId?.toString() ?? (await createTenant()).tenantId;

  const team = await Team.create({
    name,
    slug: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    orgId: new mongoose.Types.ObjectId(orgId),
    tenantId: new mongoose.Types.ObjectId(tid),
  });
  await Org.findByIdAndUpdate(orgId, { $addToSet: { teams: team._id } });

  return { teamId: team._id.toString(), name, tenantId: tid };
}

// ─── Team memberships ─────────────────────────────────────────────────────────

export async function addTeamMember(
  teamId: string,
  userId: string,
  role: TeamRole = 'member'
) {
  await Team.findByIdAndUpdate(teamId, {
    $addToSet: { members: { userId: new mongoose.Types.ObjectId(userId), role } },
  });
  await User.findByIdAndUpdate(userId, {
    $addToSet: {
      teamMemberships: { teamId: new mongoose.Types.ObjectId(teamId), role },
    },
  });
}

// ─── OKR data ─────────────────────────────────────────────────────────────────

export async function createOKRPage(
  teamId: string,
  opts: { year?: number; type?: PeriodType; quarter?: Quarter; tenantId?: string } = {}
) {
  let tid = opts.tenantId;
  if (!tid) {
    const team = await Team.findById(teamId).lean();
    tid = team?.tenantId?.toString();
  }
  if (!tid) throw new Error('tenantId required for OKRPage');

  const year = opts.year ?? new Date().getFullYear();
  const type = opts.type ?? 'annual';
  const page = await OKRPage.create({
    teamId: new mongoose.Types.ObjectId(teamId),
    tenantId: new mongoose.Types.ObjectId(tid),
    period: { type, year, quarter: opts.quarter },
  });
  return { pageId: page._id.toString(), tenantId: tid };
}

export async function createObjective(pageId: string, title = 'Test Objective', owners: object[] = []) {
  const obj = await Objective.create({
    okrPageId: new mongoose.Types.ObjectId(pageId),
    title,
    owners,
    sortOrder: 0,
  });
  return { objectiveId: obj._id.toString() };
}

export async function createKeyResult(
  objectiveId: string,
  opts: { title?: string; owners?: object[] } = {}
) {
  const kr = await KeyResult.create({
    objectiveId: new mongoose.Types.ObjectId(objectiveId),
    title: opts.title ?? 'Test Key Result',
    owners: opts.owners ?? [],
    sortOrder: 0,
  });
  return { krId: kr._id.toString() };
}

// ─── Convenience: tenant + admin user in one call ─────────────────────────────

export async function createAdminContext(opts: { email?: string; password?: string } = {}) {
  const { tenantId } = await createTenant();
  const admin = await createUser({ role: 'tenant_owner', tenantId, ...opts });
  return { tenantId, admin };
}

// ─── Token builder for a user already in DB ──────────────────────────────────

export function tokenWithMemberships(
  userId: string,
  tenantId: string,
  email: string,
  role: UserRole,
  memberships: { teamId: string; role: TeamRole }[]
): string {
  return signToken({ userId, tenantId, name: 'Test', email, role, teamMemberships: memberships });
}
