import type {
  Averages,
  Borehole,
  SampleRecord,
  Stratum,
} from "./types";

/** 钻孔与分层（固定分层档案：试验结果按孔 + 深度落层） */
export const BOREHOLES: Borehole[] = [
  {
    id: "zk18",
    name: "ZK-18",
    totalDepth: 22.6,
    strata: [
      { id: "zk18-1", code: "①", name: "杂填土", top: 0, bottom: 1.8 },
      { id: "zk18-2", code: "②", name: "粉质黏土", top: 1.8, bottom: 8.5 },
      { id: "zk18-3", code: "③", name: "粉砂", top: 8.5, bottom: 15.2 },
      { id: "zk18-4", code: "④", name: "强风化泥岩", top: 15.2, bottom: 22.6 },
    ],
  },
  {
    id: "zk21",
    name: "ZK-21",
    totalDepth: 31.2,
    strata: [
      { id: "zk21-1", code: "①", name: "杂填土", top: 0, bottom: 2.2 },
      { id: "zk21-2", code: "②", name: "粉质黏土", top: 2.2, bottom: 10.4 },
      { id: "zk21-3", code: "③", name: "卵石", top: 10.4, bottom: 24.0 },
      { id: "zk21-4", code: "④", name: "中风化花岗岩", top: 24.0, bottom: 31.2 },
    ],
  },
];

/** 深度恰好落在某条地层分界线上（该孔内部分界面，即除孔口 0 与孔底外的层面） */
function onBoundary(hole: Borehole, depth: number): boolean {
  return hole.strata.some(
    (s) =>
      s.bottom > 1e-9 &&
      s.bottom < hole.totalDepth - 1e-9 &&
      Math.abs(depth - s.bottom) < 1e-9
  );
}

/**
 * 落层 + 挂起校验。
 * 挂起条件：
 *  1) 液限不高于塑限（wL ≤ wP）；
 *  2) 深度压在地层分界线上（落层归属有歧义）；
 *  3) 深度不在该孔任何地层内。
 * 页面需点明：哪孔、哪条记录（土样编号）、什么原因。
 */
export function validateRecord(
  holeId: string,
  depth: number,
  liquidLimit: number,
  plasticLimit: number
): { status: "accepted" | "suspended"; reasons: string[]; stratumId?: string } {
  const hole = BOREHOLES.find((b) => b.id === holeId);
  const reasons: string[] = [];
  if (!hole) {
    return { status: "suspended", reasons: [`钻孔不存在：${holeId}`] };
  }

  if (liquidLimit <= plasticLimit) {
    reasons.push(
      `液限 ${liquidLimit}% 不高于塑限 ${plasticLimit}%（wL 必须大于 wP）`
    );
  }
  if (depth < 0 || depth > hole.totalDepth + 1e-9) {
    reasons.push(`深度 ${depth}m 超出 ${hole.name} 孔深 ${hole.totalDepth}m`);
  } else if (onBoundary(hole, depth)) {
    reasons.push(`深度 ${depth}m 压在地层分界线上，无法判定归属`);
  }

  const stratum =
    reasons.length === 0
      ? hole.strata.find(
          (s) => depth >= s.top - 1e-9 && depth <= s.bottom + 1e-9
        )
      : undefined;

  if (reasons.length === 0 && !stratum) {
    reasons.push(`深度 ${depth}m 未落入任何地层`);
  }

  return {
    status: reasons.length > 0 ? "suspended" : "accepted",
    reasons,
    stratumId: stratum?.id,
  };
}

/** 液性指数 IL = (w - wP) / (wL - wP)；塑性指数 IP = wL - wP */
export function liquidityIndex(
  water: number,
  liquidLimit: number,
  plasticLimit: number
): number {
  const ip = liquidLimit - plasticLimit;
  if (ip <= 0) return Number.NaN;
  return (water - plasticLimit) / ip;
}

export function ilState(il: number): { label: string; className: string } {
  if (Number.isNaN(il)) return { label: "无法计算", className: "badge-danger" };
  if (il < 0) return { label: "坚硬", className: "badge-ok" };
  if (il <= 0.25) return { label: "硬塑", className: "badge-ok" };
  if (il <= 0.75) return { label: "可塑", className: "badge-watch" };
  if (il <= 1) return { label: "软塑", className: "badge-watch" };
  return { label: "流塑", className: "badge-danger" };
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** 同一地层汇总：各指标平均值 + 液性指数（由平均含水量/界限含水量计算） */
export function aggregate(records: SampleRecord[]): Averages | null {
  if (records.length === 0) return null;
  const water = avg(records.map((r) => r.water));
  const density = avg(records.map((r) => r.density));
  const liquidLimit = avg(records.map((r) => r.liquidLimit));
  const plasticLimit = avg(records.map((r) => r.plasticLimit));
  const friction = avg(records.map((r) => r.friction));
  const cohesion = avg(records.map((r) => r.cohesion));
  return {
    water,
    density,
    liquidLimit,
    plasticLimit,
    friction,
    cohesion,
    il: liquidityIndex(water, liquidLimit, plasticLimit),
  };
}

export function holeOf(holeId: string): Borehole {
  return BOREHOLES.find((b) => b.id === holeId)!;
}

export function stratumOf(stratumId: string): { hole: Borehole; stratum: Stratum } {
  for (const hole of BOREHOLES) {
    const stratum = hole.strata.find((s) => s.id === stratumId);
    if (stratum) return { hole, stratum };
  }
  throw new Error("未知地层：" + stratumId);
}

export const METRICS: {
  key: keyof Pick<
    Averages,
    "water" | "density" | "liquidLimit" | "plasticLimit" | "friction" | "cohesion"
  >;
  label: string;
  unit: string;
}[] = [
  { key: "water", label: "含水量 w", unit: "%" },
  { key: "density", label: "密度 ρ", unit: "g/cm³" },
  { key: "liquidLimit", label: "液限 wL", unit: "%" },
  { key: "plasticLimit", label: "塑限 wP", unit: "%" },
  { key: "friction", label: "内摩擦角 φ", unit: "°" },
  { key: "cohesion", label: "黏聚力 c", unit: "kPa" },
];

/** 指标是否凑齐：每个指标至少 1 条有效土样、且液性指数可计算 */
export function completeness(records: SampleRecord[]): {
  ready: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (records.length === 0) {
    missing.push("该地层尚无有效土样");
    return { ready: false, missing };
  }
  for (const m of METRICS) {
    if (!records.some((r) => Number.isFinite(r[m.key]))) {
      missing.push(m.label);
    }
  }
  const a = aggregate(records);
  if (!a || Number.isNaN(a.il)) missing.push("液性指数 IL（wL 须大于 wP）");
  return { ready: missing.length === 0, missing };
}

export function fmt(n: number, digits = 2): string {
  if (Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

/** 内置示例数据（两条故意挂起：①②分界 1.8m、wL=wP=17.0） */
export const SEED_RECORDS: Omit<SampleRecord, "id" | "status" | "reasons" | "stratumId">[] = [
  // ZK-18
  { sampleNo: "ZK18-T01", holeId: "zk18", depth: 1.2, water: 19.4, density: 1.86, liquidLimit: 31.2, plasticLimit: 18.6, friction: 12.5, cohesion: 28.0, createdAt: Date.now() - 86400e3 * 5 },
  { sampleNo: "ZK18-T02", holeId: "zk18", depth: 4.0, water: 25.8, density: 1.92, liquidLimit: 36.5, plasticLimit: 21.4, friction: 14.0, cohesion: 32.0, createdAt: Date.now() - 86400e3 * 4 },
  { sampleNo: "ZK18-T03", holeId: "zk18", depth: 6.5, water: 27.1, density: 1.90, liquidLimit: 37.8, plasticLimit: 22.0, friction: 13.5, cohesion: 30.0, createdAt: Date.now() - 86400e3 * 3 },
  { sampleNo: "ZK18-T04", holeId: "zk18", depth: 10.8, water: 18.2, density: 1.98, liquidLimit: 26.0, plasticLimit: 15.0, friction: 28.0, cohesion: 6.0, createdAt: Date.now() - 86400e3 * 2 },
  { sampleNo: "ZK18-T05", holeId: "zk18", depth: 18.0, water: 12.6, density: 2.10, liquidLimit: 30.0, plasticLimit: 18.0, friction: 35.0, cohesion: 12.0, createdAt: Date.now() - 86400e3 * 1 },
  { sampleNo: "ZK18-T06", holeId: "zk18", depth: 1.8, water: 20.5, density: 1.88, liquidLimit: 32.0, plasticLimit: 19.0, friction: 12.0, cohesion: 26.0, createdAt: Date.now() - 3600e3 * 20 },
  // ZK-21
  { sampleNo: "ZK21-T01", holeId: "zk21", depth: 5.5, water: 26.4, density: 1.91, liquidLimit: 38.2, plasticLimit: 22.5, friction: 13.0, cohesion: 31.0, createdAt: Date.now() - 86400e3 * 3 },
  { sampleNo: "ZK21-T02", holeId: "zk21", depth: 8.8, water: 24.9, density: 1.93, liquidLimit: 37.0, plasticLimit: 21.8, friction: 14.5, cohesion: 33.0, createdAt: Date.now() - 86400e3 * 2 },
  { sampleNo: "ZK21-T03", holeId: "zk21", depth: 16.0, water: 14.5, density: 2.15, liquidLimit: 22.0, plasticLimit: 12.0, friction: 38.0, cohesion: 4.0, createdAt: Date.now() - 86400e3 * 1 },
  // 同时踩中两条挂起规则：压在 ②/③ 分界线 10.4m，且液限 = 塑限
  { sampleNo: "ZK21-T04", holeId: "zk21", depth: 10.4, water: 16.8, density: 2.05, liquidLimit: 17.0, plasticLimit: 17.0, friction: 30.0, cohesion: 10.0, createdAt: Date.now() - 3600e3 * 6 },
];

export function buildInitialRecords(): SampleRecord[] {
  return SEED_RECORDS.map((r, i) => {
    const v = validateRecord(
      r.holeId,
      r.depth,
      r.liquidLimit,
      r.plasticLimit
    );
    return {
      ...r,
      id: `seed-${i + 1}`,
      status: v.status,
      reasons: v.reasons,
      stratumId: v.stratumId,
    };
  });
}
