export type Role = "manager" | "recorder";

/** 地层 */
export interface Stratum {
  id: string;
  code: string; // ①②③…
  name: string;
  top: number; // m
  bottom: number; // m
}

/** 钻孔 */
export interface Borehole {
  id: string;
  name: string; // ZK-18
  totalDepth: number;
  strata: Stratum[];
}

/** 土样试验记录（8 项：编号、深度 + 6 个试验指标） */
export interface SampleRecord {
  id: string;
  sampleNo: string;
  holeId: string;
  depth: number; // m
  water: number; // 含水量 w，%
  density: number; // 密度 ρ，g/cm³
  liquidLimit: number; // 液限 wL，%
  plasticLimit: number; // 塑限 wP，%
  friction: number; // 内摩擦角 φ，°
  cohesion: number; // 黏聚力 c，kPa
  status: "accepted" | "suspended";
  reasons: string[];
  stratumId?: string;
  createdAt: number;
}

/** 某一地层、某一批土样的汇总指标 */
export interface Averages {
  water: number;
  density: number;
  liquidLimit: number;
  plasticLimit: number;
  friction: number;
  cohesion: number;
  il: number; // 液性指数 IL
}

/** 锁定版本：v1 为首次编入报告，v2+ 为带原因修订 */
export interface StratumVersion {
  version: number;
  reason: string;
  operator: string;
  createdAt: number;
  sampleIds: string[];
  avg: Averages;
}

/** 每个地层的锁定/修订状态 */
export interface LockState {
  versions: StratumVersion[];
}

export interface PersistShape {
  records: SampleRecord[];
  locks: Record<string, LockState>;
}
