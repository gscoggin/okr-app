import { computeTrackingTo } from '@/lib/trackingTo';
import type { TimePeriod } from '@/types';

// Helper to build a TimePeriod and freeze "now" via Jest fake timers
function annual(year: number): TimePeriod {
  return { type: 'annual', year };
}
function quarterly(year: number, quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'): TimePeriod {
  return { type: 'quarterly', year, quarter };
}

afterEach(() => jest.useRealTimers());

function setNow(date: Date) {
  jest.useFakeTimers();
  jest.setSystemTime(date);
}

// ── undefined score ───────────────────────────────────────────────────────────

it('returns undefined when score is undefined', () => {
  expect(computeTrackingTo(undefined, annual(2025))).toBeUndefined();
});

// ── period not yet started ────────────────────────────────────────────────────

it('returns undefined when the annual period has not started yet', () => {
  setNow(new Date('2024-12-31T12:00:00Z'));
  expect(computeTrackingTo(0.3, annual(2025))).toBeUndefined();
});

it('returns undefined when the quarterly period has not started yet', () => {
  setNow(new Date('2025-03-31T23:59:00Z')); // last moment before Q2
  expect(computeTrackingTo(0.5, quarterly(2025, 'Q2'))).toBeUndefined();
});

// ── period already over ───────────────────────────────────────────────────────

it('returns the clamped score when annual period is over', () => {
  setNow(new Date('2026-01-15T00:00:00Z'));
  expect(computeTrackingTo(0.8, annual(2025))).toBe(0.8);
});

it('clamps score to 1 when period is over and score > 1 is somehow provided', () => {
  setNow(new Date('2026-06-01T00:00:00Z'));
  expect(computeTrackingTo(1.5, annual(2025))).toBe(1);
});

it('returns score when quarterly period is over', () => {
  setNow(new Date('2025-04-15T00:00:00Z')); // after Q1
  expect(computeTrackingTo(0.6, quarterly(2025, 'Q1'))).toBe(0.6);
});

// ── mid-period projection ─────────────────────────────────────────────────────

it('projects score at exact midpoint of annual period', () => {
  // Midpoint of 2025 = July 2, 2025 (day 183 of 365)
  setNow(new Date('2025-07-02T12:00:00Z'));
  const result = computeTrackingTo(0.4, annual(2025));
  // At ~50% elapsed with 0.4 score → projection ≈ 0.8
  expect(result).toBeGreaterThan(0.75);
  expect(result).toBeLessThanOrEqual(1);
});

it('projects correctly at Q1 midpoint', () => {
  // Q1 is Jan–Mar. Midpoint ≈ Feb 15
  setNow(new Date('2025-02-15T00:00:00Z'));
  const result = computeTrackingTo(0.3, quarterly(2025, 'Q1'));
  // ~50% elapsed → projection ≈ 0.6
  expect(result).toBeGreaterThan(0.5);
  expect(result).toBeLessThanOrEqual(1);
});

// ── projection clamps at 1 ────────────────────────────────────────────────────

it('projection is clamped to 1 even if current pace exceeds 100%', () => {
  // 10% into the year with score already at 0.9 → raw projection = 9.0
  setNow(new Date('2025-02-03T00:00:00Z')); // roughly 10% through 2025 (day ~34)
  const result = computeTrackingTo(0.9, annual(2025));
  expect(result).toBe(1);
});

// ── score of zero ─────────────────────────────────────────────────────────────

it('returns 0 when score is 0 mid-period (no progress)', () => {
  setNow(new Date('2025-06-01T00:00:00Z'));
  expect(computeTrackingTo(0, annual(2025))).toBe(0);
});
