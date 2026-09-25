import { describe, expect, it } from "vitest";
import {
  canLock,
  classifyRecord,
  liquidityState,
  Stratum,
  strataOverlap,
  summarize,
} from "./domain";
import { AppState, reduce } from "./store";
import { seedState } from "./seed";

const strata: Stratum[] = [
  { id: "s1", boreholeId: "bh1", name: "①填土", topDepth: 0, bottomDepth: 2 },
  { id: "s2", boreholeId: "bh1", name: "②黏土", topDepth: 2, bottomDepth: 6 },
];

describe("classifyRecord 挂起规则", () => {
  it("深度落在地层内部 → 命中", () => {
    const r = classifyRecord(
      { boreholeId: "bh1", sampleNo: "T1", depth: 3.5 },
      strata,
    );
    expect(r).toEqual({ ok: true, stratum: strata[1] });
  });

  it("液限等于塑限 → 挂起", () => {
    const r = classifyRecord(
      { boreholeId: "bh1", sampleNo: "T1", depth: 3.5, liquidLimit: 25, plasticLimit: 25 },
      strata,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons).toContain("LL_LE_PL");
  });

  it("液限低于塑限 → 挂起", () => {
    const r = classifyRecord(
      { boreholeId: "bh1", sampleNo: "T1", depth: 3.5, liquidLimit: 23, plasticLimit: 26 },
      strata,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons).toContain("LL_LE_PL");
  });

  it("深度压在地层分界线上 → 挂起", () => {
    for (const depth of [0, 2, 6]) {
      const r = classifyRecord(
        { boreholeId: "bh1", sampleNo: "T1", depth },
        strata,
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reasons).toContain("ON_BOUNDARY");
    }
  });

  it("深度未命中任何地层 → 挂起", () => {
    const r = classifyRecord(
      { boreholeId: "bh1", sampleNo: "T1", depth: 9 },
      strata,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons).toContain("NO_STRATUM");
  });

  it("压线且液塑限异常 → 两个原因都记录", () => {
    const r = classifyRecord(
      { boreholeId: "bh1", sampleNo: "T1", depth: 2, liquidLimit: 20, plasticLimit: 22 },
      strata,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reasons).toContain("ON_BOUNDARY");
      expect(r.reasons).toContain("LL_LE_PL");
    }
  });

  it("液塑限缺项时不做液塑限校验", () => {
    const r = classifyRecord(
      { boreholeId: "bh1", sampleNo: "T1", depth: 3, liquidLimit: 30 },
      strata,
    );
    expect(r.ok).toBe(true);
  });
});

describe("summarize 地层汇总", () => {
  it("计算各指标平均值、塑性指数与液性指数", () => {
    const s = summarize([
      { waterContent: 28, density: 1.9, liquidLimit: 34, plasticLimit: 21, frictionAngle: 14, cohesion: 28 },
      { waterContent: 30, density: 1.92, liquidLimit: 36, plasticLimit: 23, frictionAngle: 16, cohesion: 30 },
    ]);
    expect(s.sampleCount).toBe(2);
    expect(s.averages.waterContent).toBeCloseTo(29);
    expect(s.averages.density).toBeCloseTo(1.91);
    expect(s.plasticityIndex).toBeCloseTo(13); // 35 - 22
    expect(s.liquidityIndex).toBeCloseTo((29 - 22) / 13);
    expect(s.complete).toBe(true);
  });

  it("缺项指标不参与平均，未凑齐时 complete=false", () => {
    const s = summarize([
      { waterContent: 22, density: 1.98, frictionAngle: 30 },
      { waterContent: 23, density: 1.97, frictionAngle: 31 },
    ]);
    expect(s.averages.liquidLimit).toBeUndefined();
    expect(s.liquidityIndex).toBeUndefined();
    expect(s.complete).toBe(false);
    expect(canLock(s)).toBe(false);
  });

  it("液性指数分级", () => {
    expect(liquidityState(-0.1)).toBe("坚硬");
    expect(liquidityState(0.2)).toBe("硬塑");
    expect(liquidityState(0.5)).toBe("可塑");
    expect(liquidityState(0.8)).toBe("软塑");
    expect(liquidityState(1.2)).toBe("流塑");
  });
});

describe("strataOverlap", () => {
  it("区间重叠检测", () => {
    expect(strataOverlap(strata, "bh1", 1, 3)).toBe(true);
    expect(strataOverlap(strata, "bh1", 6, 8)).toBe(false);
    expect(strataOverlap(strata, "bh1", 2, 6)).toBe(true); // 与②完全重合
    expect(strataOverlap(strata, "bh2", 1, 3)).toBe(false); // 不同孔互不影响
  });
});

// ---------------------------------------------------------------------------
// 流程级：录入 → 锁定 → 修订 → 采纳
// ---------------------------------------------------------------------------

function freshState(): AppState {
  return seedState();
}

const NOW = "2026-09-25 09:00";

describe("业务流程", () => {
  it("正常结果落入对应地层", () => {
    const s0 = freshState();
    const { state, message } = reduce(s0, {
      type: "submitResult",
      input: { boreholeId: "bh-zk2", sampleNo: "ZK2-T9", depth: 3.2, waterContent: 28 },
      operator: "录入员",
      now: NOW,
    });
    expect(message).toContain("②粉质黏土");
    const rec = state.records.find((r) => r.sampleNo === "ZK2-T9");
    expect(rec?.stratumId).toBe("st-zk2-2");
  });

  it("液限≤塑限 → 挂起并保留原因", () => {
    const s0 = freshState();
    const { state } = reduce(s0, {
      type: "submitResult",
      input: { boreholeId: "bh-zk2", sampleNo: "ZK2-T8", depth: 3.2, liquidLimit: 24, plasticLimit: 26 },
      operator: "录入员",
      now: NOW,
    });
    const sp = state.suspended.find((s) => s.sampleNo === "ZK2-T8");
    expect(sp?.reasons).toContain("LL_LE_PL");
    expect(state.records.some((r) => r.sampleNo === "ZK2-T8")).toBe(false);
  });

  it("指标未凑齐的地层不能锁定", () => {
    const s0 = freshState();
    const { state, message } = reduce(s0, {
      type: "lockStratum",
      stratumId: "st-zk1-3", // 粉砂，缺液塑限
      operator: "负责人·王工",
      now: NOW,
    });
    expect(message).toContain("未凑齐");
    expect(state.versions.some((v) => v.stratumId === "st-zk1-3")).toBe(false);
  });

  it("指标凑齐后负责人可锁定，生成 v1 快照", () => {
    const s0 = freshState();
    const { state, message } = reduce(s0, {
      type: "lockStratum",
      stratumId: "st-zk2-2",
      operator: "负责人·王工",
      now: NOW,
    });
    expect(message).toContain("锁定");
    const v = state.versions.find((v) => v.stratumId === "st-zk2-2");
    expect(v?.version).toBe(1);
    expect(v?.summary.complete).toBe(true);
  });

  it("已锁定地层拒绝直接录入，提示走修订", () => {
    const s0 = freshState(); // st-zk1-2 已锁定
    const { state, message } = reduce(s0, {
      type: "submitResult",
      input: { boreholeId: "bh-zk1", sampleNo: "ZK1-T20", depth: 3.0, waterContent: 29 },
      operator: "录入员",
      now: NOW,
    });
    expect(message).toBe("LOCKED:st-zk1-2");
    expect(state.records.some((r) => r.sampleNo === "ZK1-T20")).toBe(false);
  });

  it("锁定后另建修订必须带原因，且不覆盖原汇总", () => {
    const s0 = freshState();
    const noReason = reduce(s0, {
      type: "submitRevision",
      input: { boreholeId: "bh-zk1", stratumId: "st-zk1-2", sampleNo: "ZK1-T20", depth: 3.0, reason: "  " },
      operator: "录入员",
      now: NOW,
    });
    expect(noReason.message).toContain("原因");

    const { state } = reduce(s0, {
      type: "submitRevision",
      input: { boreholeId: "bh-zk1", stratumId: "st-zk1-2", sampleNo: "ZK1-T20", depth: 3.0, waterContent: 31, reason: "补报" },
      operator: "录入员",
      now: NOW,
    });
    const rev = state.revisions.find((r) => r.sampleNo === "ZK1-T20");
    expect(rev?.status).toBe("pending");
    // 原锁定快照不变
    const v1 = state.versions.find((v) => v.stratumId === "st-zk1-2");
    expect(v1?.summary.sampleCount).toBe(3);
  });

  it("采纳修订生成新版本，原版本保留", () => {
    const s0 = freshState();
    const { state, message } = reduce(s0, {
      type: "applyRevision",
      id: "rv-zk1-t4",
      operator: "负责人·王工",
      now: NOW,
    });
    expect(message).toContain("v2");
    const versions = state.versions.filter((v) => v.stratumId === "st-zk1-2");
    expect(versions.map((v) => v.version).sort()).toEqual([1, 2]);
    expect(versions.find((v) => v.version === 2)?.summary.sampleCount).toBe(4);
    expect(state.revisions.find((r) => r.id === "rv-zk1-t4")?.status).toBe("applied");
  });

  it("搁置修订保留在历史中", () => {
    const s0 = freshState();
    const { state } = reduce(s0, { type: "shelveRevision", id: "rv-zk1-t4" });
    expect(state.revisions.find((r) => r.id === "rv-zk1-t4")?.status).toBe("shelved");
  });

  it("挂起记录修正后重新提交可正常落地", () => {
    const s0 = freshState();
    const { state } = reduce(s0, {
      type: "resolveSuspended",
      id: "sp-zk2-t5",
      input: { boreholeId: "bh-zk2", sampleNo: "ZK2-T5", depth: 3.4, liquidLimit: 33.5, plasticLimit: 20.1 },
      operator: "录入员",
      now: NOW,
    });
    expect(state.suspended.some((s) => s.id === "sp-zk2-t5")).toBe(false);
    expect(state.records.some((r) => r.sampleNo === "ZK2-T5")).toBe(true);
  });

  it("挂起记录修正后仍不合格 → 重新挂起且只保留一条", () => {
    const s0 = freshState();
    const { state } = reduce(s0, {
      type: "resolveSuspended",
      id: "sp-zk1-t9",
      input: { boreholeId: "bh-zk1", sampleNo: "ZK1-T9", depth: 6.0 }, // 仍压线
      operator: "录入员",
      now: NOW,
    });
    const list = state.suspended.filter((s) => s.sampleNo === "ZK1-T9");
    expect(list).toHaveLength(1);
    expect(list[0].reasons).toContain("ON_BOUNDARY");
  });

  it("挂起记录修正后命中已锁定地层 → 保留挂起不丢失", () => {
    const s0 = freshState(); // st-zk1-2 已锁定
    const { state, message } = reduce(s0, {
      type: "resolveSuspended",
      id: "sp-zk1-t9",
      input: { boreholeId: "bh-zk1", sampleNo: "ZK1-T9", depth: 3.0 }, // 落入已锁定的②层
      operator: "录入员",
      now: NOW,
    });
    expect(message).toContain("已锁定");
    expect(state.suspended.some((s) => s.id === "sp-zk1-t9")).toBe(true);
    expect(state.records.some((r) => r.sampleNo === "ZK1-T9")).toBe(false);
  });
});
