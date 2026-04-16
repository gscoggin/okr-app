import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin } from '@/lib/auth';
import { compress, collectTeamData } from '@/lib/archiveUtils';
import Archive from '@/models/Archive';
import Org from '@/models/Org';
import Team from '@/models/Team';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';

const UNARCHIVE_YEAR_WINDOW = 4;
const MAX_YEAR_ARCHIVES = 20;

export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user || !isAdmin(user)) return err('Forbidden', 403);

  await connectDB();
  const archives = await Archive.find({})
    .sort({ archivedAt: -1 })
    .select('-compressedData')
    .lean();

  const currentYear = new Date().getFullYear();

  return ok(archives.map((a) => ({
    _id: a._id.toString(),
    type: a.type,
    name: a.name,
    archivedAt: a.archivedAt,
    originalId: a.originalId,
    metadata: a.metadata,
    canUnarchive:
      a.type !== 'year' ||
      (a.metadata?.year !== undefined &&
        currentYear - (a.metadata.year as number) <= UNARCHIVE_YEAR_WINDOW),
  })));
}

export async function POST(req: NextRequest) {
  const user = requireAuth(req);
  if (!user || !isAdmin(user)) return err('Forbidden', 403);

  await connectDB();

  const { type, targetId, year, auto } = await req.json();

  // ── Archive Team ────────────────────────────────────────────────────────────
  if (type === 'team') {
    if (!targetId) return err('targetId required', 400);

    const team = await Team.findById(targetId).lean();
    if (!team) return err('Team not found', 404);

    const data = await collectTeamData(targetId);
    const compressed = await compress(data);

    await Archive.create({
      type: 'team',
      name: team.name,
      compressedData: compressed,
      archivedBy: user.userId,
      originalId: targetId,
      metadata: { orgId: team.orgId.toString(), teamId: targetId, pageCount: data.pages.length },
    });

    // Remove from active collections
    const pageIds = data.pages.map((p: { _id: mongoose.Types.ObjectId }) => p._id);
    const objectiveIds = data.objectives.map((o: { _id: mongoose.Types.ObjectId }) => o._id);
    await KeyResult.deleteMany({ objectiveId: { $in: objectiveIds } });
    await Objective.deleteMany({ okrPageId: { $in: pageIds } });
    await OKRPage.deleteMany({ teamId: targetId });
    await Org.findByIdAndUpdate(team.orgId, { $pull: { teams: team._id } });
    await Team.findByIdAndDelete(targetId);

    return ok({ archived: true, name: team.name });
  }

  // ── Archive Org ─────────────────────────────────────────────────────────────
  if (type === 'org') {
    if (!targetId) return err('targetId required', 400);

    const org = await Org.findById(targetId).lean();
    if (!org) return err('Org not found', 404);

    const orgTeams = await Team.find({ orgId: targetId }).lean();
    const teamData = await Promise.all(
      orgTeams.map((t) => collectTeamData(t._id.toString()))
    );

    const data = { org, teams: teamData };
    const compressed = await compress(data);

    await Archive.create({
      type: 'org',
      name: org.name,
      compressedData: compressed,
      archivedBy: user.userId,
      originalId: targetId,
      metadata: { orgId: targetId, pageCount: teamData.reduce((n, t) => n + t.pages.length, 0) },
    });

    // Remove from active collections
    for (const td of teamData) {
      const pageIds = td.pages.map((p: { _id: mongoose.Types.ObjectId }) => p._id);
      const objectiveIds = td.objectives.map((o: { _id: mongoose.Types.ObjectId }) => o._id);
      await KeyResult.deleteMany({ objectiveId: { $in: objectiveIds } });
      await Objective.deleteMany({ okrPageId: { $in: pageIds } });
      await OKRPage.deleteMany({ teamId: td.team?._id });
      if (td.team) await Team.findByIdAndDelete(td.team._id);
    }
    await Org.findByIdAndDelete(targetId);

    return ok({ archived: true, name: org.name });
  }

  // ── Archive Year ────────────────────────────────────────────────────────────
  if (type === 'year') {
    if (!year || typeof year !== 'number') return err('year required', 400);

    // Enforce max 20 year archives
    const yearArchiveCount = await Archive.countDocuments({ type: 'year' });
    if (yearArchiveCount >= MAX_YEAR_ARCHIVES) {
      return err(`Maximum of ${MAX_YEAR_ARCHIVES} year archives reached`, 422);
    }

    // Check not already archived
    const existing = await Archive.findOne({ type: 'year', originalId: String(year) });
    if (existing) return err(`Year ${year} is already archived`, 409);

    const pages = await OKRPage.find({ 'period.year': year }).lean();
    if (pages.length === 0 && !auto) return err(`No OKR data found for ${year}`, 404);

    const pageIds = pages.map((p) => p._id);
    const objectives = await Objective.find({ okrPageId: { $in: pageIds } }).lean();
    const objectiveIds = objectives.map((o) => o._id);
    const keyResults = await KeyResult.find({ objectiveId: { $in: objectiveIds } }).lean();

    const data = { year, pages, objectives, keyResults };
    const compressed = await compress(data);

    await Archive.create({
      type: 'year',
      name: String(year),
      compressedData: compressed,
      archivedBy: user.userId,
      originalId: String(year),
      metadata: { year, pageCount: pages.length, autoArchived: !!auto },
    });

    await KeyResult.deleteMany({ objectiveId: { $in: objectiveIds } });
    await Objective.deleteMany({ okrPageId: { $in: pageIds } });
    await OKRPage.deleteMany({ 'period.year': year });

    return ok({ archived: true, year, pageCount: pages.length, auto: !!auto });
  }

  return err('Invalid archive type', 400);
}
