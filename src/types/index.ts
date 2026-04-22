// ─── Core Enums ─────────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'tenant_owner' | 'admin' | 'member';
export type TeamRole = 'owner' | 'member';
export type PeriodType = 'annual' | 'quarterly';
export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type OKRStatus = 'draft' | 'published';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type OwnerType = 'user' | 'team';

// ─── Owner Reference ─────────────────────────────────────────────────────────

export interface OwnerRef {
  type: OwnerType;
  id: string;
  displayName: string;
}

// ─── Time Period ──────────────────────────────────────────────────────────────

export interface TimePeriod {
  type: PeriodType;
  year: number;
  quarter?: Quarter;
}

export function periodLabel(p: TimePeriod): string {
  return p.type === 'annual' ? `${p.year}` : `${p.quarter} ${p.year}`;
}

export function periodKey(p: TimePeriod): string {
  return p.type === 'annual' ? `annual-${p.year}` : `${p.quarter!.toLowerCase()}-${p.year}`;
}

// ─── Tenant ───────────────────────────────────────────────────────────────────

export interface TenantBranding {
  logoUrl?: string;
  mission?: string;
  primaryColor?: string;
}

export interface ITenant {
  _id: string;
  name: string;
  slug: string;
  ownerId: string;
  branding: TenantBranding;
  guidePage?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface IUser {
  _id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  teamMemberships: { teamId: string; role: TeamRole }[];
  createdAt: string;
  updatedAt: string;
}

// ─── Org ──────────────────────────────────────────────────────────────────────

export interface IOrg {
  _id: string;
  name: string;
  slug: string;
  teams: string[];
  iconUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Team ─────────────────────────────────────────────────────────────────────

export interface ITeam {
  _id: string;
  name: string;
  slug: string;
  orgId: string;
  parentTeamId?: string;
  subTeams: string[];
  members: { userId: string; role: TeamRole }[];
  iconUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Key Result ───────────────────────────────────────────────────────────────

export type MetricType = 'number' | 'percent' | 'currency' | 'average' | 'ratio' | 'milestone';

export interface IKeyResult {
  _id: string;
  objectiveId: string;
  title: string;
  owners: OwnerRef[];
  metricType?: MetricType;
  metric?: string;
  startValue?: number;
  targetValue?: number;
  currentValue?: number;
  confidence?: ConfidenceLevel;
  comments?: string;
  score?: number; // 0.0 – 1.0
  status: OKRStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Objective ────────────────────────────────────────────────────────────────

export interface ScoreSnapshot {
  date: string;
  score: number;
}

export interface IObjective {
  _id: string;
  okrPageId: string;
  title: string;
  owners: OwnerRef[];
  priority?: number; // 1 = highest
  comments?: string;
  score?: number; // computed from KRs (or manual override)
  scoreHistory: ScoreSnapshot[];
  keyResults: IKeyResult[];
  parentObjectiveId?: string; // maps to annual / company OKR
  sortOrder: number;
  status: OKRStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── OKR Page ─────────────────────────────────────────────────────────────────

export interface IOKRPage {
  _id: string;
  teamId: string;
  period: TimePeriod;
  status: OKRStatus;
  objectives: IObjective[];
  parentOKRPageId?: string; // quarterly → annual, team → org/company
  createdAt: string;
  updatedAt: string;
}

// ─── OKR Sidebar Summary ──────────────────────────────────────────────────────

/** Minimal OKR page data used to build the sidebar navigation tree */
export interface TeamOKRYear {
  year: number;
  annualPageId: string | null;
  quarters: Quarter[]; // which quarters have pages
}

export interface TeamOKRSummary {
  teamId: string;
  years: TeamOKRYear[]; // sorted descending
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthPayload {
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  teamMemberships: { teamId: string; role: TeamRole }[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: Omit<IUser, 'createdAt' | 'updatedAt'>;
}

// ─── API response wrapper ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────

/** Returns a CSS colour class based on a 0–1 score */
export function scoreColorClass(score: number | undefined): string {
  if (score === undefined || score === null) return 'text-gray-400';
  if (score >= 0.7) return 'text-green-600';
  if (score >= 0.4) return 'text-yellow-500';
  return 'text-red-500';
}

export function scoreBgClass(score: number | undefined): string {
  if (score === undefined || score === null) return 'bg-gray-100 text-gray-400';
  if (score >= 0.7) return 'bg-green-100 text-green-700';
  if (score >= 0.4) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-600';
}

/** 5-tier score colour for presentation view */
export function presentationScoreBg(score: number | undefined): string {
  if (score === undefined || score === null) return 'bg-gray-200 text-gray-500';
  if (score >= 0.8) return 'bg-green-700 text-white';
  if (score >= 0.7) return 'bg-green-300 text-green-900';
  if (score >= 0.5) return 'bg-amber-400 text-amber-900';
  if (score >= 0.3) return 'bg-red-300 text-red-900';
  return 'bg-red-700 text-white';
}

export function confidenceColorClass(c: ConfidenceLevel | undefined): string {
  if (!c) return 'text-gray-400';
  if (c === 'high') return 'text-green-600';
  if (c === 'medium') return 'text-yellow-500';
  return 'text-red-500';
}

export function confidenceBgClass(c: ConfidenceLevel | undefined): string {
  if (!c) return 'bg-gray-100 text-gray-400';
  if (c === 'high') return 'bg-green-100 text-green-700';
  if (c === 'medium') return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-600';
}

/** Compute objective score as weighted average of KR scores */
export function computeObjectiveScore(keyResults: Pick<IKeyResult, 'score'>[]): number | undefined {
  const scored = keyResults.filter((kr) => kr.score !== undefined && kr.score !== null);
  if (scored.length === 0) return undefined;
  const avg = scored.reduce((sum, kr) => sum + (kr.score as number), 0) / scored.length;
  return Math.round(avg * 100) / 100;
}

/** Compute OKR page score as average of objective scores */
export function computePageScore(objectives: Pick<IObjective, 'score'>[]): number | undefined {
  const scored = objectives.filter((o) => o.score !== undefined && o.score !== null);
  if (scored.length === 0) return undefined;
  const avg = scored.reduce((sum, o) => sum + (o.score as number), 0) / scored.length;
  return Math.round(avg * 100) / 100;
}
