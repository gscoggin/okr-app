/**
 * Fixture factories for test data.
 * These write directly to the database and return a JWT token ready to use
 * in request headers.
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
import type { UserRole, TeamRole, PeriodType, Quarter } from '@/types';

// ─── Users ────────────────────────────────────────────────────────────────────

interface UserFixture {
  userId: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  token: string;
  /** Re-derive token after team memberships change */
  refreshToken: () => Promise<string>;
}

export async function createUser(opts: {
  email?: string;
  password?: string;
  name?: string;
  role?: UserRole;
}): Promise<UserFixture> {
  const name = opts.name ?? 'Test User';
  const email = (opts.email ?? `user-${Date.now()}@test.com`).toLowerCase();
  const password = opts.password ?? 'password123';
  const role = opts.role ?? 'member';

  // Low bcrypt rounds for test speed
  const passwordHash = await bcrypt.hash(password, 4);
  const user = await User.create({ name, email, passwordHash, role });
  const userId = user._id.toString();

  const makeToken = async () => {
    const fresh = await User.findById(userId).lean();
    if (!fresh) throw new Error('User not found');
    return signToken({
      userId,
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
    name,
    email,
    password,
    role,
    token: await makeToken(),
    refreshToken: makeToken,
  };
}

// ─── Orgs ─────────────────────────────────────────────────────────────────────

export async function createOrg(name = 'Test Org') {
  const org = await Org.create({ name, slug: name.toLowerCase().replace(/\s+/g, '-') });
  return { orgId: org._id.toString(), name };
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export async function createTeam(orgId: string, name = 'Test Team') {
  const org = await Org.findById(orgId);
  if (!org) throw new Error('Org not found');

  const team = await Team.create({
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    orgId: new mongoose.Types.ObjectId(orgId),
  });
  await Org.findByIdAndUpdate(orgId, { $addToSet: { teams: team._id } });

  return { teamId: team._id.toString(), name };
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
  opts: { year?: number; type?: PeriodType; quarter?: Quarter } = {}
) {
  const year = opts.year ?? new Date().getFullYear();
  const type = opts.type ?? 'annual';
  const page = await OKRPage.create({
    teamId: new mongoose.Types.ObjectId(teamId),
    period: { type, year, quarter: opts.quarter },
  });
  return { pageId: page._id.toString() };
}

export async function createObjective(pageId: string, title = 'Test Objective') {
  const obj = await Objective.create({
    okrPageId: new mongoose.Types.ObjectId(pageId),
    title,
    owners: [],
    sortOrder: 0,
  });
  return { objectiveId: obj._id.toString() };
}

export async function createKeyResult(
  objectiveId: string,
  opts: { title?: string; owners?: unknown[] } = {}
) {
  const kr = await KeyResult.create({
    objectiveId: new mongoose.Types.ObjectId(objectiveId),
    title: opts.title ?? 'Test Key Result',
    owners: opts.owners ?? [],
    sortOrder: 0,
  });
  return { krId: kr._id.toString() };
}

// ─── Token builder for a user already in DB ──────────────────────────────────

/** Build a token carrying specific team memberships — without touching the DB */
export function tokenWithMemberships(
  userId: string,
  email: string,
  role: UserRole,
  memberships: { teamId: string; role: TeamRole }[]
): string {
  return signToken({ userId, name: 'Test', email, role, teamMemberships: memberships });
}
