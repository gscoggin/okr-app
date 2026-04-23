/**
 * Demo tenant seed — idempotent, period-aware.
 * Creates or refreshes the demo tenant with realistic OKR data
 * for the current year and quarter.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from './mongodb';
import Tenant from '@/models/Tenant';
import User from '@/models/User';
import Org from '@/models/Org';
import Team from '@/models/Team';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';

const DEMO_SLUG = 'demo-workspace';
const DEMO_EMAIL = 'demo@demo.local';

function currentQuarter(): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
  const m = new Date().getMonth();
  if (m < 3) return 'Q1';
  if (m < 6) return 'Q2';
  if (m < 9) return 'Q3';
  return 'Q4';
}

function prevQuarter(q: 'Q1' | 'Q2' | 'Q3' | 'Q4'): { q: 'Q1' | 'Q2' | 'Q3' | 'Q4'; year: number } {
  const year = new Date().getFullYear();
  if (q === 'Q1') return { q: 'Q4', year: year - 1 };
  const map: Record<string, 'Q1' | 'Q2' | 'Q3'> = { Q2: 'Q1', Q3: 'Q2', Q4: 'Q3' };
  return { q: map[q], year };
}

type ObjSpec = {
  title: string;
  krs: {
    title: string;
    metricType: 'percent' | 'number' | 'currency' | 'milestone';
    startValue: number;
    targetValue: number;
    currentValue: number;
    confidence: 'high' | 'medium' | 'low';
  }[];
};

function score(start: number, current: number, target: number): number {
  if (target === start) return current >= target ? 1 : 0;
  const s = Math.max(0, Math.min(1, (current - start) / (target - start)));
  return Math.round(s * 100) / 100;
}

async function createPage(
  teamId: mongoose.Types.ObjectId,
  tenantId: mongoose.Types.ObjectId,
  period: { type: 'annual' | 'quarterly'; year: number; quarter?: string },
  objectives: ObjSpec[]
) {
  const page = await OKRPage.create({ teamId, tenantId, period, status: 'published' });

  for (let oi = 0; oi < objectives.length; oi++) {
    const oSpec = objectives[oi];
    const krDocs = [];

    for (let ki = 0; ki < oSpec.krs.length; ki++) {
      const k = oSpec.krs[ki];
      const krScore = score(k.startValue, k.currentValue, k.targetValue);
      const kr = await KeyResult.create({
        objectiveId: new mongoose.Types.ObjectId(), // placeholder, updated below
        title: k.title,
        owners: [],
        metricType: k.metricType,
        startValue: k.startValue,
        targetValue: k.targetValue,
        currentValue: k.currentValue,
        confidence: k.confidence,
        score: krScore,
        sortOrder: ki,
        status: 'published',
      });
      krDocs.push(kr);
    }

    const objScore =
      krDocs.reduce((s, kr) => s + (kr.score ?? 0), 0) / (krDocs.length || 1);

    const obj = await Objective.create({
      okrPageId: page._id,
      title: oSpec.title,
      owners: [],
      score: Math.round(objScore * 100) / 100,
      scoreHistory: [],
      sortOrder: oi,
      status: 'published',
    });

    // Fix objectiveId on KRs
    await KeyResult.updateMany(
      { _id: { $in: krDocs.map((k) => k._id) } },
      { $set: { objectiveId: obj._id } }
    );
  }

  return page;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

function platformObjectives(q: string): ObjSpec[] {
  return [
    {
      title: `Achieve 99.9% uptime across all production services in ${q}`,
      krs: [
        { title: 'Reduce P1 incidents from 8 to 2', metricType: 'number', startValue: 8, targetValue: 2, currentValue: 4, confidence: 'medium' },
        { title: 'Increase deployment frequency to 20 deploys/week', metricType: 'number', startValue: 8, targetValue: 20, currentValue: 14, confidence: 'high' },
        { title: 'MTTR below 15 minutes', metricType: 'number', startValue: 45, targetValue: 15, currentValue: 22, confidence: 'medium' },
      ],
    },
    {
      title: 'Modernise the data pipeline to reduce processing latency by 60%',
      krs: [
        { title: 'Migrate 3 legacy batch jobs to streaming', metricType: 'milestone', startValue: 0, targetValue: 3, currentValue: 1, confidence: 'low' },
        { title: 'Reduce p99 data freshness from 4h to 90min', metricType: 'number', startValue: 240, targetValue: 90, currentValue: 180, confidence: 'medium' },
      ],
    },
  ];
}

function productObjectives(q: string): ObjSpec[] {
  return [
    {
      title: `Launch and validate the new onboarding flow in ${q}`,
      krs: [
        { title: 'Increase activation rate from 38% to 55%', metricType: 'percent', startValue: 38, targetValue: 55, currentValue: 49, confidence: 'high' },
        { title: 'Reduce time-to-first-value from 14 days to 5 days', metricType: 'number', startValue: 14, targetValue: 5, currentValue: 8, confidence: 'medium' },
        { title: 'Achieve NPS ≥ 42 for onboarding experience', metricType: 'number', startValue: 28, targetValue: 42, currentValue: 35, confidence: 'medium' },
      ],
    },
    {
      title: 'Make collaboration the #1 reason users stay',
      krs: [
        { title: 'Ship real-time co-editing to 100% of teams', metricType: 'percent', startValue: 0, targetValue: 100, currentValue: 60, confidence: 'high' },
        { title: 'Weekly active collaboration sessions up 3×', metricType: 'number', startValue: 1200, targetValue: 3600, currentValue: 1900, confidence: 'medium' },
      ],
    },
  ];
}

function mobileObjectives(q: string): ObjSpec[] {
  return [
    {
      title: `Close the mobile-desktop feature gap in ${q}`,
      krs: [
        { title: 'Ship 8 of top 10 requested mobile features', metricType: 'milestone', startValue: 0, targetValue: 8, currentValue: 3, confidence: 'low' },
        { title: 'Mobile crash rate below 0.3%', metricType: 'percent', startValue: 1.2, targetValue: 0.3, currentValue: 0.7, confidence: 'medium' },
        { title: 'App Store rating ≥ 4.6', metricType: 'number', startValue: 4.1, targetValue: 4.6, currentValue: 4.3, confidence: 'medium' },
      ],
    },
  ];
}

function growthObjectives(q: string): ObjSpec[] {
  return [
    {
      title: `Drive 30% more qualified pipeline in ${q}`,
      krs: [
        { title: 'MQLs from organic up from 420 to 600/month', metricType: 'number', startValue: 420, targetValue: 600, currentValue: 530, confidence: 'high' },
        { title: 'Paid CAC reduced from $320 to $240', metricType: 'currency', startValue: 320, targetValue: 240, currentValue: 275, confidence: 'medium' },
        { title: 'Launch 2 new acquisition channels', metricType: 'milestone', startValue: 0, targetValue: 2, currentValue: 1, confidence: 'medium' },
      ],
    },
    {
      title: 'Make the product the primary growth channel',
      krs: [
        { title: 'PLG-sourced ARR from 12% to 25%', metricType: 'percent', startValue: 12, targetValue: 25, currentValue: 16, confidence: 'medium' },
        { title: 'Viral coefficient above 0.4', metricType: 'number', startValue: 0.1, targetValue: 0.4, currentValue: 0.18, confidence: 'low' },
      ],
    },
  ];
}

function brandObjectives(q: string): ObjSpec[] {
  return [
    {
      title: `Establish category leadership narrative in ${q}`,
      krs: [
        { title: 'Publish 8 thought leadership pieces', metricType: 'milestone', startValue: 0, targetValue: 8, currentValue: 6, confidence: 'high' },
        { title: 'Share of voice in target segment from 8% to 18%', metricType: 'percent', startValue: 8, targetValue: 18, currentValue: 13, confidence: 'medium' },
        { title: 'Branded search volume up 40%', metricType: 'percent', startValue: 0, targetValue: 40, currentValue: 28, confidence: 'high' },
      ],
    },
  ];
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function seedDemo(): Promise<{ tenantId: string; userId: string }> {
  await connectDB();

  const year = new Date().getFullYear();
  const q = currentQuarter();
  const prev = prevQuarter(q);

  // ── Tenant + demo user ────────────────────────────────────────────────────

  let tenant = await Tenant.findOne({ slug: DEMO_SLUG });
  let demoUser = await User.findOne({ email: DEMO_EMAIL });

  if (!tenant) {
    const placeholderId = new mongoose.Types.ObjectId();
    tenant = await Tenant.create({
      name: 'Acme Demo',
      slug: DEMO_SLUG,
      ownerId: placeholderId,
      branding: { mission: 'Make work meaningful.' },
      isDemo: true,
    });
  }

  if (!demoUser) {
    const hash = await bcrypt.hash('demo-password-not-for-login', 10);
    demoUser = await User.create({
      tenantId: tenant._id,
      name: 'Demo User',
      email: DEMO_EMAIL,
      passwordHash: hash,
      role: 'member',
    });
    await Tenant.findByIdAndUpdate(tenant._id, { ownerId: demoUser._id });
  }

  const tenantId = tenant._id as mongoose.Types.ObjectId;

  // ── Wipe existing OKR data for demo tenant ────────────────────────────────

  const existingPages = await OKRPage.find({ tenantId }).lean();
  const pageIds = existingPages.map((p) => p._id);
  const existingObjs = await Objective.find({ okrPageId: { $in: pageIds } }).lean();
  const objIds = existingObjs.map((o) => o._id);

  await KeyResult.deleteMany({ objectiveId: { $in: objIds } });
  await Objective.deleteMany({ okrPageId: { $in: pageIds } });
  await OKRPage.deleteMany({ tenantId });

  // ── Orgs & teams ──────────────────────────────────────────────────────────

  await Org.deleteMany({ tenantId });
  await Team.deleteMany({ tenantId });

  const engOrg = await Org.create({ tenantId, name: 'Engineering', slug: 'engineering' });
  const mktOrg = await Org.create({ tenantId, name: 'Marketing', slug: 'marketing' });

  const platform = await Team.create({ tenantId, orgId: engOrg._id, name: 'Platform', slug: 'platform', members: [] });
  const product  = await Team.create({ tenantId, orgId: engOrg._id, name: 'Product',  slug: 'product',  members: [] });
  const mobile   = await Team.create({ tenantId, orgId: engOrg._id, name: 'Mobile',   slug: 'mobile',   members: [] });
  const growth   = await Team.create({ tenantId, orgId: mktOrg._id, name: 'Growth',   slug: 'growth',   members: [] });
  const brand    = await Team.create({ tenantId, orgId: mktOrg._id, name: 'Brand',    slug: 'brand',    members: [] });

  const teams = [
    { doc: platform, annualObjs: platformObjectives('Annual'), qObjs: platformObjectives(q), prevObjs: platformObjectives(prev.q) },
    { doc: product,  annualObjs: productObjectives('Annual'),  qObjs: productObjectives(q),  prevObjs: productObjectives(prev.q) },
    { doc: mobile,   annualObjs: mobileObjectives('Annual'),   qObjs: mobileObjectives(q),   prevObjs: mobileObjectives(prev.q) },
    { doc: growth,   annualObjs: growthObjectives('Annual'),   qObjs: growthObjectives(q),   prevObjs: growthObjectives(prev.q) },
    { doc: brand,    annualObjs: brandObjectives('Annual'),    qObjs: brandObjectives(q),    prevObjs: brandObjectives(prev.q) },
  ];

  // ── OKR pages ─────────────────────────────────────────────────────────────

  for (const t of teams) {
    const tid = t.doc._id as mongoose.Types.ObjectId;
    await createPage(tid, tenantId, { type: 'annual', year }, t.annualObjs);
    await createPage(tid, tenantId, { type: 'quarterly', year, quarter: q }, t.qObjs);
    await createPage(tid, tenantId, { type: 'quarterly', year: prev.year, quarter: prev.q }, t.prevObjs);
  }

  return { tenantId: tenantId.toString(), userId: (demoUser._id as mongoose.Types.ObjectId).toString() };
}
