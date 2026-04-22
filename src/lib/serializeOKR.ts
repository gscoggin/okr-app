import type { IOKRPage, IObjective, IKeyResult, MetricType } from '@/types';

type RawKR = {
  _id: { toString(): string };
  objectiveId: { toString(): string };
  title: string;
  owners?: object[];
  metricType?: string;
  metric?: string;
  startValue?: number;
  targetValue?: number;
  currentValue?: number;
  confidence?: string;
  comments?: string;
  score?: number;
  status?: string;
  sortOrder?: number;
  createdAt: Date;
  updatedAt: Date;
};

type RawObjective = {
  _id: { toString(): string };
  okrPageId: { toString(): string };
  title: string;
  owners?: object[];
  priority?: number;
  comments?: string;
  score?: number;
  scoreHistory?: { date: Date; score: number }[];
  parentObjectiveId?: { toString(): string };
  sortOrder?: number;
  status?: string;
  createdAt: Date;
  updatedAt: Date;
};

type RawPage = {
  _id: { toString(): string };
  teamId: { toString(): string };
  period: IOKRPage['period'];
  status?: string;
  parentOKRPageId?: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
};

export function serializeKR(kr: RawKR): IKeyResult {
  return {
    _id: kr._id.toString(),
    objectiveId: kr.objectiveId.toString(),
    title: kr.title,
    owners: (kr.owners ?? []) as IKeyResult['owners'],
    metricType: kr.metricType as MetricType | undefined,
    metric: kr.metric,
    startValue: kr.startValue,
    targetValue: kr.targetValue,
    currentValue: kr.currentValue,
    confidence: kr.confidence as IKeyResult['confidence'],
    comments: kr.comments,
    score: kr.score,
    status: kr.status as IKeyResult['status'],
    sortOrder: kr.sortOrder ?? 0,
    createdAt: kr.createdAt.toISOString(),
    updatedAt: kr.updatedAt.toISOString(),
  };
}

export function serializeObjective(
  o: RawObjective,
  keyResults: IKeyResult[]
): IObjective {
  return {
    _id: o._id.toString(),
    okrPageId: o.okrPageId.toString(),
    title: o.title,
    owners: (o.owners ?? []) as IObjective['owners'],
    priority: o.priority as IObjective['priority'],
    comments: o.comments,
    score: o.score,
    scoreHistory: (o.scoreHistory ?? []).map((s) => ({
      date: s.date.toISOString(),
      score: s.score,
    })),
    parentObjectiveId: o.parentObjectiveId?.toString(),
    sortOrder: o.sortOrder ?? 0,
    status: (o.status ?? 'draft') as IObjective['status'],
    keyResults,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

export function serializePage(
  pageDoc: RawPage,
  objectives: IObjective[]
): IOKRPage {
  return {
    _id: pageDoc._id.toString(),
    teamId: pageDoc.teamId.toString(),
    period: pageDoc.period,
    status: pageDoc.status as IOKRPage['status'],
    objectives,
    parentOKRPageId: pageDoc.parentOKRPageId?.toString(),
    createdAt: pageDoc.createdAt.toISOString(),
    updatedAt: pageDoc.updatedAt.toISOString(),
  };
}

/** Fully serializes a page doc + its raw objectives + raw KRs into a nested IOKRPage. */
export function serializeOKRPageWithNested(
  pageDoc: RawPage,
  rawObjectives: RawObjective[],
  rawKRs: RawKR[]
): IOKRPage {
  const krsByObjective: Record<string, IKeyResult[]> = {};
  for (const kr of rawKRs) {
    const key = kr.objectiveId.toString();
    if (!krsByObjective[key]) krsByObjective[key] = [];
    krsByObjective[key].push(serializeKR(kr));
  }

  const serializedObjectives = rawObjectives.map((o) =>
    serializeObjective(o, krsByObjective[o._id.toString()] ?? [])
  );

  return serializePage(pageDoc, serializedObjectives);
}
