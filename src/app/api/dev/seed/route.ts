/**
 * Dev-only seed endpoint — clears all data and inserts realistic OKR data.
 * Blocked in production. Call with: GET /api/dev/seed
 */
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import Org from '@/models/Org';
import Team from '@/models/Team';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';
import Tenant from '@/models/Tenant';
import type { Quarter, ConfidenceLevel } from '@/types';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  await connectDB();

  // ── Clear all collections ────────────────────────────────────────────────────
  await Promise.all([
    Tenant.deleteMany({}),
    User.deleteMany({}),
    Org.deleteMany({}),
    Team.deleteMany({}),
    OKRPage.deleteMany({}),
    Objective.deleteMany({}),
    KeyResult.deleteMany({}),
  ]);

  // ── Shared password hash ─────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 4);

  // ── Seed tenant ───────────────────────────────────────────────────────────────
  const seedTenant = await Tenant.create({
    name: 'Seed Company',
    slug: 'seed-company',
    ownerId: new mongoose.Types.ObjectId(), // updated after admin user creation
    branding: { mission: 'Aligning teams through great OKRs.' },
  });
  const tenantId = seedTenant._id;

  // ── Orgs ─────────────────────────────────────────────────────────────────────
  const orgDefs = [
    { tenantId, name: 'Acme Corp', slug: 'acme-corp' },
    { tenantId, name: 'Northstar Labs', slug: 'northstar-labs' },
  ];

  const orgs = await Org.insertMany(orgDefs);

  // ── Team + user definitions per org ─────────────────────────────────────────
  type TeamDef = {
    name: string;
    users: { name: string; email: string; isOwner: boolean }[];
  };

  const orgTeams: Record<string, TeamDef[]> = {
    'acme-corp': [
      {
        name: 'Product',
        users: [
          { name: 'Alice Chen', email: 'alice@acme.com', isOwner: true },
          { name: 'Bob Marsh', email: 'bob@acme.com', isOwner: false },
          { name: 'Carol Lin', email: 'carol@acme.com', isOwner: false },
          { name: 'Dan Park', email: 'dan@acme.com', isOwner: false },
        ],
      },
      {
        name: 'Engineering',
        users: [
          { name: 'Eva Torres', email: 'eva@acme.com', isOwner: true },
          { name: 'Frank Yu', email: 'frank@acme.com', isOwner: false },
          { name: 'Grace Kim', email: 'grace@acme.com', isOwner: false },
          { name: 'Henry Bell', email: 'henry@acme.com', isOwner: false },
          { name: 'Iris Patel', email: 'iris@acme.com', isOwner: false },
        ],
      },
      {
        name: 'Growth',
        users: [
          { name: 'James Liu', email: 'james@acme.com', isOwner: true },
          { name: 'Kate Morgan', email: 'kate@acme.com', isOwner: false },
          { name: 'Leo Hassan', email: 'leo@acme.com', isOwner: false },
        ],
      },
      {
        name: 'Design',
        users: [
          { name: 'Mia Foster', email: 'mia@acme.com', isOwner: true },
          { name: 'Nate Wu', email: 'nate@acme.com', isOwner: false },
          { name: 'Olivia Stone', email: 'olivia@acme.com', isOwner: false },
        ],
      },
    ],
    'northstar-labs': [
      {
        name: 'Platform',
        users: [
          { name: 'Paul Reeves', email: 'paul@northstar.com', isOwner: true },
          { name: 'Quinn Sato', email: 'quinn@northstar.com', isOwner: false },
          { name: 'Rachel Obi', email: 'rachel@northstar.com', isOwner: false },
          { name: 'Sam Diaz', email: 'sam@northstar.com', isOwner: false },
        ],
      },
      {
        name: 'Data',
        users: [
          { name: 'Tara Flynn', email: 'tara@northstar.com', isOwner: true },
          { name: 'Uri Cohen', email: 'uri@northstar.com', isOwner: false },
          { name: 'Vera Singh', email: 'vera@northstar.com', isOwner: false },
        ],
      },
      {
        name: 'Customer Success',
        users: [
          { name: 'Will Reed', email: 'will@northstar.com', isOwner: true },
          { name: 'Xena Brooks', email: 'xena@northstar.com', isOwner: false },
          { name: 'Yusuf Ali', email: 'yusuf@northstar.com', isOwner: false },
          { name: 'Zoe Grant', email: 'zoe@northstar.com', isOwner: false },
        ],
      },
    ],
  };

  // ── OKR content per team type ────────────────────────────────────────────────
  type KRDef = {
    title: string;
    metric: string;
    startValue: number;
    targetValue: number;
    currentValue: number;
    score: number;
    confidence: ConfidenceLevel;
  };

  type ObjectiveDef = { title: string; krs: KRDef[] };

  const okrContent: Record<string, ObjectiveDef[]> = {
    Product: [
      {
        title: 'Ship a world-class onboarding experience',
        krs: [
          { title: 'Reduce time-to-first-value from 14 days to 3 days', metric: 'Days', startValue: 14, targetValue: 3, currentValue: 6, score: 0.73, confidence: 'high' },
          { title: 'Increase onboarding completion rate to 85%', metric: 'Percent', startValue: 42, targetValue: 85, currentValue: 68, score: 0.61, confidence: 'medium' },
          { title: 'Achieve NPS ≥ 45 for new users in first 30 days', metric: 'NPS', startValue: 22, targetValue: 45, currentValue: 38, score: 0.70, confidence: 'medium' },
        ],
      },
      {
        title: 'Accelerate feature velocity without sacrificing quality',
        krs: [
          { title: 'Ship 4 major features per quarter', metric: 'Features', startValue: 2, targetValue: 4, currentValue: 3, score: 0.75, confidence: 'high' },
          { title: 'Keep P1 bug backlog under 5 open items', metric: 'Bugs', startValue: 18, targetValue: 5, currentValue: 7, score: 0.85, confidence: 'high' },
        ],
      },
      {
        title: 'Build a deeply integrated partner ecosystem',
        krs: [
          { title: 'Launch 3 native integrations with top CRMs', metric: 'Integrations', startValue: 0, targetValue: 3, currentValue: 1, score: 0.33, confidence: 'low' },
          { title: 'Sign 10 technology partnership agreements', metric: 'Partners', startValue: 2, targetValue: 10, currentValue: 4, score: 0.25, confidence: 'low' },
        ],
      },
    ],
    Engineering: [
      {
        title: 'Achieve 99.9% uptime across all production services',
        krs: [
          { title: 'Reduce mean time to recovery (MTTR) to < 15 min', metric: 'Minutes', startValue: 68, targetValue: 15, currentValue: 22, score: 0.87, confidence: 'high' },
          { title: 'Keep error rate below 0.1% across all endpoints', metric: 'Percent', startValue: 0.8, targetValue: 0.1, currentValue: 0.15, score: 0.93, confidence: 'high' },
          { title: 'Deploy infrastructure-as-code coverage to 100%', metric: 'Percent', startValue: 30, targetValue: 100, currentValue: 75, score: 0.64, confidence: 'medium' },
        ],
      },
      {
        title: 'Cut p95 API response time in half',
        krs: [
          { title: 'Reduce p95 latency from 800ms to 400ms', metric: 'Milliseconds', startValue: 800, targetValue: 400, currentValue: 510, score: 0.73, confidence: 'high' },
          { title: 'Achieve database query cache hit rate ≥ 90%', metric: 'Percent', startValue: 55, targetValue: 90, currentValue: 82, score: 0.77, confidence: 'high' },
        ],
      },
      {
        title: 'Modernise the test suite and eliminate flaky tests',
        krs: [
          { title: 'Increase unit test coverage to 80%', metric: 'Percent', startValue: 41, targetValue: 80, currentValue: 62, score: 0.54, confidence: 'medium' },
          { title: 'Reduce flaky test rate to < 2%', metric: 'Percent', startValue: 14, targetValue: 2, currentValue: 5, score: 0.75, confidence: 'medium' },
          { title: 'Achieve CI pipeline completion under 8 minutes', metric: 'Minutes', startValue: 22, targetValue: 8, currentValue: 11, score: 0.79, confidence: 'high' },
        ],
      },
    ],
    Growth: [
      {
        title: 'Double monthly recurring revenue',
        krs: [
          { title: 'Grow MRR from $200k to $400k', metric: 'USD', startValue: 200000, targetValue: 400000, currentValue: 295000, score: 0.48, confidence: 'medium' },
          { title: 'Increase trial-to-paid conversion rate to 25%', metric: 'Percent', startValue: 12, targetValue: 25, currentValue: 18, score: 0.46, confidence: 'medium' },
          { title: 'Reduce churn to below 2% monthly', metric: 'Percent', startValue: 4.5, targetValue: 2, currentValue: 2.8, score: 0.68, confidence: 'medium' },
        ],
      },
      {
        title: 'Build a repeatable outbound sales motion',
        krs: [
          { title: 'Book 50 qualified demos per month', metric: 'Demos', startValue: 8, targetValue: 50, currentValue: 31, score: 0.54, confidence: 'medium' },
          { title: 'Achieve < 48hr lead response time', metric: 'Hours', startValue: 120, targetValue: 48, currentValue: 52, score: 0.94, confidence: 'high' },
        ],
      },
    ],
    Design: [
      {
        title: 'Establish a mature design system used across all products',
        krs: [
          { title: 'Document and publish 50+ reusable components', metric: 'Components', startValue: 12, targetValue: 50, currentValue: 38, score: 0.68, confidence: 'medium' },
          { title: 'Achieve 95% adoption of design tokens in codebase', metric: 'Percent', startValue: 20, targetValue: 95, currentValue: 71, score: 0.68, confidence: 'medium' },
        ],
      },
      {
        title: 'Improve core user experience metrics',
        krs: [
          { title: 'Increase SUS score from 62 to 80', metric: 'SUS Score', startValue: 62, targetValue: 80, currentValue: 74, score: 0.67, confidence: 'medium' },
          { title: 'Conduct 12 usability sessions per quarter', metric: 'Sessions', startValue: 2, targetValue: 12, currentValue: 9, score: 0.70, confidence: 'high' },
        ],
      },
    ],
    Platform: [
      {
        title: 'Scale infrastructure to support 10x traffic growth',
        krs: [
          { title: 'Migrate all services to auto-scaling groups', metric: 'Services', startValue: 3, targetValue: 18, currentValue: 12, score: 0.60, confidence: 'medium' },
          { title: 'Achieve 99.95% monthly uptime SLA', metric: 'Percent', startValue: 99.1, targetValue: 99.95, currentValue: 99.8, score: 0.82, confidence: 'high' },
          { title: 'Reduce infrastructure cost per request by 40%', metric: 'Percent', startValue: 0, targetValue: 40, currentValue: 28, score: 0.70, confidence: 'medium' },
        ],
      },
      {
        title: 'Deliver self-serve developer tooling',
        krs: [
          { title: 'Launch internal developer portal with 100% service coverage', metric: 'Percent', startValue: 0, targetValue: 100, currentValue: 55, score: 0.55, confidence: 'medium' },
          { title: 'Reduce new service onboarding time from 2 weeks to 1 day', metric: 'Days', startValue: 14, targetValue: 1, currentValue: 3, score: 0.85, confidence: 'high' },
        ],
      },
    ],
    Data: [
      {
        title: 'Make data accessible to every team without engineering support',
        krs: [
          { title: 'Deploy self-serve analytics to 8 internal teams', metric: 'Teams', startValue: 1, targetValue: 8, currentValue: 5, score: 0.57, confidence: 'medium' },
          { title: 'Achieve < 2hr data freshness on all key dashboards', metric: 'Hours', startValue: 24, targetValue: 2, currentValue: 4, score: 0.91, confidence: 'high' },
          { title: 'Document 100% of data model in the data catalog', metric: 'Percent', startValue: 10, targetValue: 100, currentValue: 58, score: 0.53, confidence: 'medium' },
        ],
      },
      {
        title: 'Launch ML-powered product features in production',
        krs: [
          { title: 'Ship 2 ML features with measurable user impact', metric: 'Features', startValue: 0, targetValue: 2, currentValue: 1, score: 0.50, confidence: 'medium' },
          { title: 'Achieve model inference latency < 100ms at p95', metric: 'Milliseconds', startValue: 800, targetValue: 100, currentValue: 140, score: 0.93, confidence: 'high' },
        ],
      },
    ],
    'Customer Success': [
      {
        title: 'Achieve best-in-class customer retention',
        krs: [
          { title: 'Reach net revenue retention of 120%', metric: 'Percent', startValue: 98, targetValue: 120, currentValue: 108, score: 0.45, confidence: 'medium' },
          { title: 'Increase CSAT score to 4.7/5.0', metric: 'Score', startValue: 4.1, targetValue: 4.7, currentValue: 4.5, score: 0.67, confidence: 'medium' },
          { title: 'Resolve 90% of support tickets within 4 hours', metric: 'Percent', startValue: 55, targetValue: 90, currentValue: 80, score: 0.71, confidence: 'high' },
        ],
      },
      {
        title: 'Scale the customer success team to cover enterprise segment',
        krs: [
          { title: 'Hire 3 enterprise CSMs by end of Q2', metric: 'Hires', startValue: 0, targetValue: 3, currentValue: 2, score: 0.67, confidence: 'medium' },
          { title: 'Launch enterprise QBR program for all accounts > $50k ARR', metric: 'Accounts', startValue: 0, targetValue: 12, currentValue: 7, score: 0.58, confidence: 'medium' },
        ],
      },
    ],
  };

  // ── Build teams, users, and OKR pages ───────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash('admin123', 4);
  const adminUser = await User.create({
    tenantId,
    name: 'Admin User',
    email: 'admin@seed.dev',
    passwordHash: adminPasswordHash,
    role: 'tenant_owner',
    teamMemberships: [],
  });
  await Tenant.findByIdAndUpdate(tenantId, { ownerId: adminUser._id });

  const summary: Record<string, unknown> = {
    admin: { email: 'admin@seed.dev', password: 'admin123' },
    orgs: [] as unknown[],
  };

  const currentYear = new Date().getFullYear();
  const YEARS = [2024, 2025, currentYear].filter((y, i, a) => a.indexOf(y) === i);
  const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

  for (const org of orgs) {
    const teamDefs = orgTeams[org.slug] ?? [];
    const orgSummary: Record<string, unknown> = { name: org.name, teams: [] as unknown[] };

    const createdTeamIds: mongoose.Types.ObjectId[] = [];

    for (const teamDef of teamDefs) {
      const slug = teamDef.name.toLowerCase().replace(/\s+/g, '-');
      const team = await Team.create({
        tenantId,
        name: teamDef.name,
        slug,
        orgId: org._id,
        members: [],
      });
      createdTeamIds.push(team._id);

      // Create users for this team
      const teamUsers: { userId: mongoose.Types.ObjectId; name: string; email: string; isOwner: boolean }[] = [];

      for (const ud of teamDef.users) {
        const user = await User.create({
          tenantId,
          name: ud.name,
          email: ud.email,
          passwordHash,
          role: 'member',
          teamMemberships: [{ teamId: team._id, role: ud.isOwner ? 'owner' : 'member' }],
        });
        teamUsers.push({ userId: user._id, name: ud.name, email: ud.email, isOwner: ud.isOwner });

        await Team.findByIdAndUpdate(team._id, {
          $push: { members: { userId: user._id, role: ud.isOwner ? 'owner' : 'member' } },
        });
      }

      const owner = teamUsers.find((u) => u.isOwner) ?? teamUsers[0];
      const ownerRef = { type: 'user' as const, id: owner.userId.toString(), displayName: owner.name };

      // Determine OKR content for this team (fall back to Product if unknown)
      const contentKey = Object.keys(okrContent).find((k) => teamDef.name.includes(k)) ?? 'Product';
      const objectiveDefs = okrContent[contentKey];

      // Create annual + quarterly pages for each year
      for (const year of YEARS) {
        // Annual page
        const annualPage = await OKRPage.create({
          tenantId,
          teamId: team._id,
          period: { type: 'annual', year },
          status: year === 2024 ? 'published' : 'draft',
        });

        // Seed objectives on the annual page
        await seedObjectives(annualPage._id, objectiveDefs, ownerRef, year === 2024 ? 'published' : 'draft');

        // Quarterly pages — all 4 for 2024 (published), Q1+Q2 for other years (draft)
        const quarters: Quarter[] = year === 2024 ? QUARTERS : ['Q1', 'Q2'];
        for (const quarter of quarters) {
          const qPage = await OKRPage.create({
            tenantId,
            teamId: team._id,
            period: { type: 'quarterly', year, quarter },
            status: year === 2024 ? 'published' : 'draft',
            parentOKRPageId: annualPage._id,
          });
          await seedObjectives(qPage._id, objectiveDefs, ownerRef, year === 2024 ? 'published' : 'draft');
        }
      }

      (orgSummary.teams as unknown[]).push({
        name: teamDef.name,
        users: teamUsers.map((u) => ({ name: u.name, email: u.email, password: 'password123', isOwner: u.isOwner })),
      });
    }

    // Link teams to org
    await Org.findByIdAndUpdate(org._id, { $set: { teams: createdTeamIds } });
    (summary.orgs as unknown[]).push(orgSummary);
  }

  return NextResponse.json({ seeded: true, summary }, { status: 200 });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function seedObjectives(
  pageId: mongoose.Types.ObjectId,
  defs: { title: string; krs: { title: string; metric: string; startValue: number; targetValue: number; currentValue: number; score: number; confidence: ConfidenceLevel }[] }[],
  ownerRef: { type: 'user'; id: string; displayName: string },
  status: 'draft' | 'published'
) {
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    const krDocs = await KeyResult.insertMany(
      def.krs.map((kr, j) => ({
        objectiveId: new mongoose.Types.ObjectId(), // placeholder, updated below
        title: kr.title,
        owners: [ownerRef],
        metric: kr.metric,
        startValue: kr.startValue,
        targetValue: kr.targetValue,
        currentValue: kr.currentValue,
        score: kr.score,
        confidence: kr.confidence,
        status,
        sortOrder: j,
      }))
    );

    // Compute objective score as average of KR scores
    const avgScore =
      Math.round((krDocs.reduce((sum, kr) => sum + (kr.score ?? 0), 0) / krDocs.length) * 100) / 100;

    // Generate 8-week fake score history ending at current score
    const scoreHistory = Array.from({ length: 8 }, (_, w) => {
      const d = new Date();
      d.setDate(d.getDate() - (7 - w) * 7);
      d.setHours(0, 0, 0, 0);
      const t = (w + 1) / 8;
      return { date: d, score: Math.round(Math.max(0, avgScore * t + (Math.random() - 0.5) * 0.1) * 100) / 100 };
    });

    const objective = await Objective.create({
      okrPageId: pageId,
      title: def.title,
      owners: [ownerRef],
      score: avgScore,
      scoreHistory,
      priority: i + 1,
      sortOrder: i,
      status,
    });

    // Update KR objectiveIds to point to the real objective
    await KeyResult.updateMany(
      { _id: { $in: krDocs.map((kr) => kr._id) } },
      { $set: { objectiveId: objective._id } }
    );
  }
}
