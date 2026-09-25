// 示例数据：两个钻孔、分层、若干试验记录、一条已锁定地层、
// 一条待处理修订与两条挂起记录，打开页面即可演示完整流程。

import {
  SampleRecord,
  Stratum,
  summarize,
  SummaryVersion,
  SuspendedRecord,
  Revision,
  Borehole,
} from "./domain";
import { AppState } from "./store";

const boreholes: Borehole[] = [
  { id: "bh-zk1", code: "ZK1" },
  { id: "bh-zk2", code: "ZK2" },
];

const strata: Stratum[] = [
  { id: "st-zk1-1", boreholeId: "bh-zk1", name: "①杂填土", topDepth: 0, bottomDepth: 1.5 },
  { id: "st-zk1-2", boreholeId: "bh-zk1", name: "②粉质黏土", topDepth: 1.5, bottomDepth: 6.0 },
  { id: "st-zk1-3", boreholeId: "bh-zk1", name: "③粉砂", topDepth: 6.0, bottomDepth: 12.0 },
  { id: "st-zk2-1", boreholeId: "bh-zk2", name: "①杂填土", topDepth: 0, bottomDepth: 2.0 },
  { id: "st-zk2-2", boreholeId: "bh-zk2", name: "②粉质黏土", topDepth: 2.0, bottomDepth: 5.5 },
  { id: "st-zk2-3", boreholeId: "bh-zk2", name: "③粉砂", topDepth: 5.5, bottomDepth: 11.0 },
];

function rec(partial: Omit<SampleRecord, "createdAt" | "createdBy">): SampleRecord {
  return { createdAt: "2026-09-20 09:30", createdBy: "录入员·小李", ...partial };
}

const records: SampleRecord[] = [
  // ZK1 ②粉质黏土：3 条完整记录，已随首次编报锁定
  rec({ id: "rc-zk1-t1", boreholeId: "bh-zk1", stratumId: "st-zk1-2", sampleNo: "ZK1-T1", depth: 2.2, waterContent: 28.5, density: 1.92, liquidLimit: 34.2, plasticLimit: 21.0, frictionAngle: 14.5, cohesion: 28.0 }),
  rec({ id: "rc-zk1-t2", boreholeId: "bh-zk1", stratumId: "st-zk1-2", sampleNo: "ZK1-T2", depth: 3.6, waterContent: 30.1, density: 1.90, liquidLimit: 35.0, plasticLimit: 21.5, frictionAngle: 13.8, cohesion: 26.5 }),
  rec({ id: "rc-zk1-t3", boreholeId: "bh-zk1", stratumId: "st-zk1-2", sampleNo: "ZK1-T3", depth: 5.1, waterContent: 29.2, density: 1.91, liquidLimit: 34.6, plasticLimit: 21.2, frictionAngle: 14.1, cohesion: 27.2 }),
  // ZK1 ③粉砂：缺液塑限与黏聚力，指标未凑齐，演示不可锁定
  rec({ id: "rc-zk1-t5", boreholeId: "bh-zk1", stratumId: "st-zk1-3", sampleNo: "ZK1-T5", depth: 7.4, waterContent: 22.4, density: 1.98, frictionAngle: 30.5 }),
  rec({ id: "rc-zk1-t6", boreholeId: "bh-zk1", stratumId: "st-zk1-3", sampleNo: "ZK1-T6", depth: 9.8, waterContent: 23.1, density: 1.97, frictionAngle: 31.2 }),
  // ZK2 ②粉质黏土：2 条完整记录，指标凑齐，可演示负责人锁定
  rec({ id: "rc-zk2-t1", boreholeId: "bh-zk2", stratumId: "st-zk2-2", sampleNo: "ZK2-T1", depth: 3.0, waterContent: 27.8, density: 1.93, liquidLimit: 33.5, plasticLimit: 20.6, frictionAngle: 15.2, cohesion: 30.1 }),
  rec({ id: "rc-zk2-t2", boreholeId: "bh-zk2", stratumId: "st-zk2-2", sampleNo: "ZK2-T2", depth: 4.6, waterContent: 28.9, density: 1.92, liquidLimit: 34.1, plasticLimit: 20.9, frictionAngle: 14.6, cohesion: 29.0 }),
];

const suspended: SuspendedRecord[] = [
  {
    id: "sp-zk2-t5",
    boreholeId: "bh-zk2",
    sampleNo: "ZK2-T5",
    depth: 3.4,
    waterContent: 26.4,
    density: 1.94,
    liquidLimit: 23.5,
    plasticLimit: 25.1,
    frictionAngle: 15.0,
    cohesion: 29.5,
    reasons: ["LL_LE_PL"],
    createdAt: "2026-09-22 14:05",
    createdBy: "录入员·小李",
  },
  {
    id: "sp-zk1-t9",
    boreholeId: "bh-zk1",
    sampleNo: "ZK1-T9",
    depth: 6.0,
    waterContent: 24.0,
    density: 1.95,
    liquidLimit: 30.2,
    plasticLimit: 19.8,
    frictionAngle: 18.4,
    cohesion: 22.0,
    reasons: ["ON_BOUNDARY"],
    createdAt: "2026-09-23 10:41",
    createdBy: "录入员·小李",
  },
];

const revisions: Revision[] = [
  {
    id: "rv-zk1-t4",
    boreholeId: "bh-zk1",
    stratumId: "st-zk1-2",
    sampleNo: "ZK1-T4",
    depth: 4.4,
    waterContent: 29.8,
    density: 1.90,
    liquidLimit: 34.8,
    plasticLimit: 21.4,
    frictionAngle: 13.9,
    cohesion: 26.8,
    reason: "ZK1-T4 复测结果补报（试验报告 TY-2026-0412），原样第一次剪切试验失败重做",
    status: "pending",
    createdAt: "2026-09-24 16:20",
    createdBy: "录入员·小李",
  },
];

export function seedState(): AppState {
  const lockedRecords = records.filter((r) => r.stratumId === "st-zk1-2");
  const lockedVersion: SummaryVersion = {
    id: "sv-zk1-2-v1",
    stratumId: "st-zk1-2",
    version: 1,
    summary: summarize(lockedRecords),
    note: "首次编报锁定",
    createdAt: "2026-09-21 11:00",
    createdBy: "负责人·王工",
  };
  return {
    boreholes,
    strata,
    records,
    suspended,
    revisions,
    versions: [lockedVersion],
  };
}
