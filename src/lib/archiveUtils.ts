import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import type mongoose from 'mongoose';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export async function compress(data: unknown): Promise<Buffer> {
  const json = JSON.stringify(data);
  return gzipAsync(Buffer.from(json, 'utf8'));
}

export async function decompress(buffer: Buffer): Promise<unknown> {
  const decompressed = await gunzipAsync(buffer);
  return JSON.parse(decompressed.toString('utf8'));
}

/** Collect a team's OKR pages + objectives + KRs into a plain object */
export async function collectTeamData(teamId: string) {
  const Team = (await import('@/models/Team')).default;
  const OKRPage = (await import('@/models/OKRPage')).default;
  const Objective = (await import('@/models/Objective')).default;
  const KeyResult = (await import('@/models/KeyResult')).default;

  const team = await Team.findById(teamId).lean();
  const pages = await OKRPage.find({ teamId }).lean();
  const pageIds = pages.map((p: { _id: mongoose.Types.ObjectId }) => p._id);
  const objectives = await Objective.find({ okrPageId: { $in: pageIds } }).lean();
  const objectiveIds = objectives.map((o: { _id: mongoose.Types.ObjectId }) => o._id);
  const keyResults = await KeyResult.find({ objectiveId: { $in: objectiveIds } }).lean();

  return { team, pages, objectives, keyResults };
}

/** Restore a team archive back into the active collections */
export async function restoreTeamData(data: ReturnType<typeof collectTeamData> extends Promise<infer T> ? T : never, orgId: string) {
  const Team = (await import('@/models/Team')).default;
  const Org = (await import('@/models/Org')).default;
  const OKRPage = (await import('@/models/OKRPage')).default;
  const Objective = (await import('@/models/Objective')).default;
  const KeyResult = (await import('@/models/KeyResult')).default;

  const { team, pages, objectives, keyResults } = data as Awaited<ReturnType<typeof collectTeamData>>;

  if (team) {
    await Team.create([team]);
    await Org.findByIdAndUpdate(orgId, { $addToSet: { teams: team._id } });
  }
  if (pages.length) await OKRPage.insertMany(pages);
  if (objectives.length) await Objective.insertMany(objectives);
  if (keyResults.length) await KeyResult.insertMany(keyResults);
}
