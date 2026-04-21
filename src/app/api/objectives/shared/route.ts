import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';
import Team from '@/models/Team';

/**
 * GET /api/objectives/shared?teamId=xxx&year=xxx&quarter=Q1
 *
 * Returns objectives from OTHER teams where the given team appears as an owner
 * (either on the objective itself or on one of its key results).
 * Each objective includes its KRs and a `sourceTeam` with the team name.
 */
export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('teamId');
  const year = searchParams.get('year');
  const quarter = searchParams.get('quarter');

  if (!teamId || !year) return err('teamId and year are required', 400);

  await connectDB();

  // Find all OKR pages for this year/period scoped to the tenant, excluding this team's own page
  const pageFilter: Record<string, unknown> = {
    tenantId: user.tenantId,
    teamId: { $ne: teamId },
    'period.year': parseInt(year),
  };
  if (quarter) {
    pageFilter['period.type'] = 'quarterly';
    pageFilter['period.quarter'] = quarter;
  } else {
    pageFilter['period.type'] = 'annual';
  }

  const pages = await OKRPage.find(pageFilter).lean();
  if (pages.length === 0) return ok([]);

  const pageIds = pages.map((p) => p._id);
  const pageMap = Object.fromEntries(pages.map((p) => [p._id.toString(), p]));

  // Find objectives on those pages where this team is an owner
  const objectivesWithDirectOwnership = await Objective.find({
    okrPageId: { $in: pageIds },
    'owners.type': 'team',
    'owners.id': teamId,
  }).lean();

  // Find objectives on those pages that have KRs where this team is an owner
  const krsOwnedByTeam = await KeyResult.find({
    'owners.type': 'team',
    'owners.id': teamId,
  }).lean();

  const objectiveIdsFromKRs = [...new Set(krsOwnedByTeam.map((kr) => kr.objectiveId.toString()))];

  const objectivesFromKROwnership = objectiveIdsFromKRs.length > 0
    ? await Objective.find({
        _id: { $in: objectiveIdsFromKRs },
        okrPageId: { $in: pageIds },
      }).lean()
    : [];

  // Merge, deduplicate, and annotate with KRs + source team
  const seen = new Set<string>();
  const allObjectives = [...objectivesWithDirectOwnership, ...objectivesFromKROwnership].filter((o) => {
    const id = o._id.toString();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  if (allObjectives.length === 0) return ok([]);

  // Load all KRs for these objectives
  const allObjectiveIds = allObjectives.map((o) => o._id);
  const allKRs = await KeyResult.find({ objectiveId: { $in: allObjectiveIds } }).lean();
  const krsByObjective: Record<string, typeof allKRs> = {};
  for (const kr of allKRs) {
    const key = kr.objectiveId.toString();
    if (!krsByObjective[key]) krsByObjective[key] = [];
    krsByObjective[key].push(kr);
  }

  // Load source team names
  const sourceTeamIds = [...new Set(allObjectives.map((o) => {
    const page = pageMap[o.okrPageId.toString()];
    return page?.teamId.toString();
  }).filter(Boolean))];

  const sourceTeams = await Team.find({ _id: { $in: sourceTeamIds } }).lean();
  const teamNameMap = Object.fromEntries(sourceTeams.map((t) => [t._id.toString(), t.name]));

  // Shape the response
  const result = allObjectives.map((o) => {
    const page = pageMap[o.okrPageId.toString()];
    const sourceTeamId = page?.teamId.toString() ?? '';
    const krs = (krsByObjective[o._id.toString()] ?? []).map((kr) => ({
      _id: kr._id.toString(),
      objectiveId: o._id.toString(),
      title: kr.title,
      owners: kr.owners ?? [],
      metric: kr.metric,
      targetValue: kr.targetValue,
      currentValue: kr.currentValue,
      score: kr.score,
      confidence: kr.confidence,
      comments: kr.comments,
      sortOrder: kr.sortOrder ?? 0,
      createdAt: kr.createdAt.toISOString(),
      updatedAt: kr.updatedAt.toISOString(),
    }));

    return {
      _id: o._id.toString(),
      okrPageId: o.okrPageId.toString(),
      title: o.title,
      owners: o.owners ?? [],
      score: o.score,
      status: o.status ?? 'draft',
      sortOrder: o.sortOrder ?? 0,
      comments: o.comments,
      keyResults: krs,
      sourceTeamId,
      sourceTeamName: teamNameMap[sourceTeamId] ?? 'Unknown Team',
      pageStatus: page?.status ?? 'draft',
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    };
  });

  return ok(result);
}
