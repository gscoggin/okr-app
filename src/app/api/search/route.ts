import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import Org from '@/models/Org';
import Team from '@/models/Team';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';

export interface SearchResult {
  type: 'org' | 'team' | 'page' | 'objective';
  _id: string;
  name: string;
  href: string;
  subtitle?: string;
}

// Parse year (2000–2099) and quarter (Q1–Q4) out of a query string
function parsePeriod(q: string) {
  const yearMatch = q.match(/\b(20\d{2})\b/);
  const quarterMatch = q.match(/\bq([1-4])\b/i);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;
  const quarter = quarterMatch ? (`Q${quarterMatch[1]}` as 'Q1' | 'Q2' | 'Q3' | 'Q4') : null;
  // "purely period" = after stripping year/quarter tokens nothing meaningful remains
  const remainder = q
    .replace(/\b20\d{2}\b/, '')
    .replace(/\bq[1-4]\b/i, '')
    .trim();
  const isPurelyPeriod = (year !== null || quarter !== null) && remainder === '';
  return { year, quarter, isPurelyPeriod };
}

function pageHref(teamId: string, year: number, type: string, quarter?: string | null) {
  return type === 'annual'
    ? `/teams/${teamId}/${year}`
    : `/teams/${teamId}/${year}/${quarter?.toLowerCase()}`;
}

export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (!q) return ok([]);

  const tenantId = user.tenantId;
  await connectDB();

  const nameRegex = { $regex: q, $options: 'i' };
  const { year, quarter, isPurelyPeriod } = parsePeriod(q);
  const hasPeriod = year !== null || quarter !== null;

  // Run all applicable searches in parallel
  const [orgResults, teamResults, pageResults, objectiveResults] = await Promise.all([
    // 1. Org name search — skip when query is purely a period token
    isPurelyPeriod
      ? Promise.resolve([])
      : Org.find({ tenantId, name: nameRegex }).select('name').limit(4).lean(),

    // 2. Team name search — same skip
    isPurelyPeriod
      ? Promise.resolve([])
      : Team.find({ tenantId, name: nameRegex }).select('name orgId').limit(8).lean(),

    // 3. Period search — only when year or quarter present
    hasPeriod
      ? (async () => {
          const filter: Record<string, unknown> = { tenantId };
          if (year) filter['period.year'] = year;
          if (quarter) filter['period.quarter'] = quarter;
          return OKRPage.find(filter).select('teamId period').limit(12).lean();
        })()
      : Promise.resolve([]),

    // 4. Owner search — skip when purely a period
    isPurelyPeriod
      ? Promise.resolve([])
      : (async () => {
          // Scope to tenant by finding tenant page IDs first
          const pageIds = await OKRPage.find({ tenantId })
            .select('_id')
            .limit(500)
            .lean()
            .then((ps) => ps.map((p) => p._id));
          if (!pageIds.length) return [];
          return Objective.find({
            okrPageId: { $in: pageIds },
            'owners.displayName': nameRegex,
          })
            .select('title okrPageId owners')
            .limit(6)
            .lean();
        })(),
  ]);

  // ── Resolve org names for team subtitles ──────────────────────────────────

  const orgIds = [
    ...new Set([
      ...teamResults.map((t) => t.orgId.toString()),
    ]),
  ];
  const orgMap = new Map(
    orgIds.length
      ? (await Org.find({ _id: { $in: orgIds } }).select('name').lean()).map((o) => [
          o._id.toString(),
          o.name,
        ])
      : []
  );

  // ── Resolve team names for page + objective results ───────────────────────

  const pageTeamIds = [
    ...new Set([
      ...pageResults.map((p) => p.teamId.toString()),
    ]),
  ];

  // Objectives need page info → team info
  const objPageIds = [
    ...new Set(objectiveResults.map((o) => o.okrPageId.toString())),
  ];
  const objPages =
    objPageIds.length
      ? await OKRPage.find({
          _id: { $in: objPageIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select('teamId period')
          .lean()
      : [];
  const objPageMap = new Map(objPages.map((p) => [p._id.toString(), p]));

  const allTeamIds = [
    ...new Set([
      ...pageTeamIds,
      ...objPages.map((p) => p.teamId.toString()),
    ]),
  ];
  const teamMap = new Map(
    allTeamIds.length
      ? (await Team.find({ _id: { $in: allTeamIds } }).select('name orgId').lean()).map((t) => [
          t._id.toString(),
          t,
        ])
      : []
  );

  // Resolve org names for page subtitles
  const pageOrgIds = [
    ...new Set([...teamMap.values()].map((t) => t.orgId.toString())),
  ];
  const pageOrgMap = new Map(
    pageOrgIds.length
      ? (await Org.find({ _id: { $in: pageOrgIds } }).select('name').lean()).map((o) => [
          o._id.toString(),
          o.name,
        ])
      : []
  );

  // ── Assemble results ──────────────────────────────────────────────────────

  const results: SearchResult[] = [];

  for (const o of orgResults) {
    results.push({ type: 'org', _id: o._id.toString(), name: o.name, href: `/orgs/${o._id}` });
  }

  for (const t of teamResults) {
    results.push({
      type: 'team',
      _id: t._id.toString(),
      name: t.name,
      href: `/teams/${t._id}`,
      subtitle: orgMap.get(t.orgId.toString()),
    });
  }

  for (const p of pageResults) {
    const team = teamMap.get(p.teamId.toString());
    if (!team) continue;
    const { year: y, quarter: q2, type } = p.period;
    const periodLabel = type === 'annual' ? `${y}` : `${y} ${q2}`;
    const orgName = pageOrgMap.get(team.orgId.toString());
    results.push({
      type: 'page',
      _id: p._id.toString(),
      name: team.name,
      href: pageHref(p.teamId.toString(), y, type, q2),
      subtitle: orgName ? `${periodLabel} · ${orgName}` : periodLabel,
    });
  }

  for (const obj of objectiveResults) {
    const page = objPageMap.get(obj.okrPageId.toString());
    if (!page) continue;
    const team = teamMap.get(page.teamId.toString());
    if (!team) continue;
    const { year: y, quarter: q2, type } = page.period;
    const periodLabel = type === 'annual' ? `${y}` : `${y} ${q2}`;
    const ownerNames = obj.owners.map((o: { displayName: string }) => o.displayName).join(', ');
    results.push({
      type: 'objective',
      _id: obj._id.toString(),
      name: obj.title || '(untitled)',
      href: pageHref(page.teamId.toString(), y, type, q2),
      subtitle: `${ownerNames} · ${team.name} ${periodLabel}`,
    });
  }

  return ok(results);
}
