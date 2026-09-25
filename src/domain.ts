// 领域模型与纯业务逻辑：土样试验记录的校验、落地层、地层汇总。
// 全部写成纯函数，不依赖 React / 浏览器，便于单元测试。

/** 土样试验指标（留空表示该试验项目未做，不参与平均） */
export interface SampleMetrics {
  waterContent?: number; // 含水量 w，%
  density?: number; // 密度 ρ，g/cm³
  liquidLimit?: number; // 液限 wL，%
  plasticLimit?: number; // 塑限 wP，%
  frictionAngle?: number; // 内摩擦角 φ，°
  cohesion?: number; // 黏聚力 c，kPa
}

export const METRIC_FIELDS = [
  { key: "waterContent", label: "含水量 w", unit: "%" },
  { key: "density", label: "密度 ρ", unit: "g/cm³" },
  { key: "liquidLimit", label: "液限 wL", unit: "%" },
  { key: "plasticLimit", label: "塑限 wP", unit: "%" },
  { key: "frictionAngle", label: "内摩擦角 φ", unit: "°" },
  { key: "cohesion", label: "黏聚力 c", unit: "kPa" },
] as const;

export type MetricKey = (typeof METRIC_FIELDS)[number]["key"];

export interface Borehole {
  id: string;
  code: string; // 孔号，如 ZK1
}

export interface Stratum {
  id: string;
  boreholeId: string;
  name: string; // 地层名称，如 ②粉质黏土
  topDepth: number; // 层顶埋深 m
  bottomDepth: number; // 层底埋深 m
}

export interface SampleRecord extends SampleMetrics {
  id: string;
  boreholeId: string;
  stratumId: string;
  sampleNo: string; // 土样编号
  depth: number; // 取样深度 m
  createdAt: string;
  createdBy: string;
  fromRevisionId?: string; // 由哪条修订采纳而来
}

/** 挂起原因 */
export type SuspendReason = "LL_LE_PL" | "ON_BOUNDARY" | "NO_STRATUM";

export const SUSPEND_REASON_TEXT: Record<SuspendReason, string> = {
  LL_LE_PL: "液限不高于塑限（wL ≤ wP），数据存疑",
  ON_BOUNDARY: "取样深度正好压在地层分界线上，归属不明",
  NO_STRATUM: "取样深度未命中该孔任何地层区间",
};

export interface SuspendedRecord extends SampleMetrics {
  id: string;
  boreholeId: string;
  sampleNo: string;
  depth: number;
  reasons: SuspendReason[];
  createdAt: string;
  createdBy: string;
}

export type RevisionStatus = "pending" | "applied" | "shelved";

export const REVISION_STATUS_TEXT: Record<RevisionStatus, string> = {
  pending: "待处理",
  applied: "已采纳",
  shelved: "已搁置",
};

/** 锁定后到达的新结果：只能以修订形式另建，必须带原因 */
export interface Revision extends SampleMetrics {
  id: string;
  boreholeId: string;
  stratumId: string;
  sampleNo: string;
  depth: number;
  reason: string; // 修订原因，必填
  status: RevisionStatus;
  createdAt: string;
  createdBy: string;
}

/** 地层指标汇总结果 */
export interface StratumSummary {
  sampleCount: number;
  averages: Partial<Record<MetricKey, number>>;
  plasticityIndex?: number; // 塑性指数 IP = wL - wP
  liquidityIndex?: number; // 液性指数 IL = (w - wP) / (wL - wP)
  complete: boolean; // 六项指标是否凑齐（每项至少一个有效值）
}

/** 锁定/采纳修订时生成的汇总版本快照，历史全部保留 */
export interface SummaryVersion {
  id: string;
  stratumId: string;
  version: number;
  summary: StratumSummary;
  note: string; // “首次编报锁定” / “采纳修订：…”
  createdAt: string;
  createdBy: string;
}

// ---------------------------------------------------------------------------
// 校验与落地层
// ---------------------------------------------------------------------------

export interface RecordInput extends SampleMetrics {
  boreholeId: string;
  sampleNo: string;
  depth: number;
}

export type ClassifyResult =
  | { ok: true; stratum: Stratum }
  | { ok: false; reasons: SuspendReason[] };

const EPS = 1e-9;

/**
 * 校验一条试验结果并确定归属地层。
 * 规则：液限 ≤ 塑限，或深度压在地层分界线上 → 挂起；
 * 深度未命中任何地层区间（分层未覆盖）同样无处落地，一并挂起。
 */
export function classifyRecord(
  input: RecordInput,
  strata: Stratum[],
): ClassifyResult {
  const reasons: SuspendReason[] = [];

  if (
    input.liquidLimit !== undefined &&
    input.plasticLimit !== undefined &&
    input.liquidLimit <= input.plasticLimit
  ) {
    reasons.push("LL_LE_PL");
  }

  const holeStrata = strata
    .filter((s) => s.boreholeId === input.boreholeId)
    .sort((a, b) => a.topDepth - b.topDepth);

  const onBoundary = holeStrata.some(
    (s) =>
      Math.abs(input.depth - s.topDepth) < EPS ||
      Math.abs(input.depth - s.bottomDepth) < EPS,
  );
  if (onBoundary) {
    reasons.push("ON_BOUNDARY");
  }

  const hit = holeStrata.find(
    (s) => input.depth > s.topDepth + EPS && input.depth < s.bottomDepth - EPS,
  );

  if (!hit && !onBoundary) {
    reasons.push("NO_STRATUM");
  }

  if (reasons.length > 0) {
    return { ok: false, reasons };
  }
  return { ok: true, stratum: hit! };
}

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------

function mean(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** 把同一地层的有效记录汇总成各指标平均值、塑性指数与液性指数 */
export function summarize(records: SampleMetrics[]): StratumSummary {
  const averages: Partial<Record<MetricKey, number>> = {};
  for (const field of METRIC_FIELDS) {
    const values = records
      .map((r) => r[field.key])
      .filter((v): v is number => v !== undefined);
    const avg = mean(values);
    if (avg !== undefined) {
      averages[field.key] = avg;
    }
  }

  const w = averages.waterContent;
  const wL = averages.liquidLimit;
  const wP = averages.plasticLimit;

  const plasticityIndex =
    wL !== undefined && wP !== undefined ? wL - wP : undefined;
  const liquidityIndex =
    w !== undefined && plasticityIndex !== undefined && plasticityIndex > EPS
      ? (w - wP!) / plasticityIndex
      : undefined;

  const complete = METRIC_FIELDS.every((f) => averages[f.key] !== undefined);

  return {
    sampleCount: records.length,
    averages,
    plasticityIndex,
    liquidityIndex,
    complete,
  };
}

/** 液性指数状态分级（黏性土） */
export function liquidityState(il: number): string {
  if (il <= 0) return "坚硬";
  if (il <= 0.25) return "硬塑";
  if (il <= 0.75) return "可塑";
  if (il <= 1) return "软塑";
  return "流塑";
}

/** 指标是否凑齐：凑齐后负责人才允许编报锁定 */
export function canLock(summary: StratumSummary): boolean {
  return summary.complete && summary.sampleCount > 0;
}

/** 检查新地层是否与同孔既有地层重叠 */
export function strataOverlap(
  strata: Stratum[],
  boreholeId: string,
  topDepth: number,
  bottomDepth: number,
): boolean {
  return strata.some(
    (s) =>
      s.boreholeId === boreholeId &&
      topDepth < s.bottomDepth - EPS &&
      bottomDepth > s.topDepth + EPS,
  );
}

export function fmt(value: number | undefined, digits = 2): string {
  return value === undefined ? "—" : value.toFixed(digits);
}
