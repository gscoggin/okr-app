import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin } from '@/lib/auth';
import { decompress } from '@/lib/archiveUtils';
import Archive from '@/models/Archive';
import Org from '@/models/Org';
import Team from '@/models/Team';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';

const UNARCHIVE_YEAR_WINDOW = 4;

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ archiveId: string }> }
) {
  const user = requireAuth(req);
  if (!user || !isAdmin(user)) return err('Forbidden', 403);

  const { archiveId } = await params;
  await connectDB();

  const archive = await Archive.findById(archiveId);
  if (!archive) return err('Archive not found', 404);
  if (archive.tenantId?.toString() !== user.tenantId) return err('Forbidden', 403);

  // Year archives older than the window cannot be restored
  if (archive.type === 'year' && archive.metadata?.year) {
    const currentYear = new Date().getFullYear();
    if (currentYear - (archive.metadata.year as number) > UNARCHIVE_YEAR_WINDOW) {
      return err(`Year ${archive.metadata.year} is outside the ${UNARCHIVE_YEAR_WINDOW}-year unarchive window`, 422);
    }
  }

  const data = await decompress(archive.compressedData) as Record<string, unknown>;

  // Verify the decompressed data's tenantId matches the requester's tenant
  const requesterTenantId = user.tenantId;
  function assertTenant(obj: Record<string, unknown> | null | undefined) {
    if (!obj) return;
    const tid = obj.tenantId?.toString();
    if (tid && tid !== requesterTenantId) throw new Error('Tenant mismatch in archive data');
  }

  try {
  // ── Restore Team ────────────────────────────────────────────────────────────
  if (archive.type === 'team') {
    const { team, pages, objectives, keyResults } = data as {
      team: Record<string, unknown>;
      pages: Record<string, unknown>[];
      objectives: Record<string, unknown>[];
      keyResults: Record<string, unknown>[];
    };

    assertTenant(team);
    pages?.forEach(assertTenant);

    if (team) {
      await Team.create([team]);
      if (team.orgId) {
        await Org.findByIdAndUpdate(team.orgId, { $addToSet: { teams: team._id } });
      }
    }
    if (pages?.length) await OKRPage.insertMany(pages);
    if (objectives?.length) await Objective.insertMany(objectives);
    if (keyResults?.length) await KeyResult.insertMany(keyResults);
  }

  // ── Restore Org ─────────────────────────────────────────────────────────────
  if (archive.type === 'org') {
    const { org, teams } = data as {
      org: Record<string, unknown>;
      teams: Array<{
        team: Record<string, unknown>;
        pages: Record<string, unknown>[];
        objectives: Record<string, unknown>[];
        keyResults: Record<string, unknown>[];
      }>;
    };

    assertTenant(org);
    teams?.forEach((td) => { assertTenant(td.team); td.pages?.forEach(assertTenant); });

    if (org) await Org.create([org]);
    for (const td of teams ?? []) {
      if (td.team) await Team.create([td.team]);
      if (td.pages?.length) await OKRPage.insertMany(td.pages);
      if (td.objectives?.length) await Objective.insertMany(td.objectives);
      if (td.keyResults?.length) await KeyResult.insertMany(td.keyResults);
    }
  }

  // ── Restore Year ─────────────────────────────────────────────────────────
  if (archive.type === 'year') {
    const { pages, objectives, keyResults } = data as {
      year: number;
      pages: Record<string, unknown>[];
      objectives: Record<string, unknown>[];
      keyResults: Record<string, unknown>[];
    };

    pages?.forEach(assertTenant);

    if (pages?.length) await OKRPage.insertMany(pages);
    if (objectives?.length) await Objective.insertMany(objectives);
    if (keyResults?.length) await KeyResult.insertMany(keyResults);
  }

  } catch (e) {
    if (e instanceof Error && e.message === 'Tenant mismatch in archive data') {
      return err('Forbidden', 403);
    }
    throw e;
  }

  await Archive.findByIdAndDelete(archiveId);
  return ok({ restored: true, type: archive.type, name: archive.name });
}
