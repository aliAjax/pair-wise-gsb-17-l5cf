// 应用状态：钻孔、地层、有效记录、挂起记录、修订、汇总版本。
// useReducer + localStorage 持久化，刷新后挂起记录、汇总与修订历史原样保留。

import { useMemo, useReducer } from "react";
import {
  Borehole,
  canLock,
  classifyRecord,
  RecordInput,
  Revision,
  SampleRecord,
  Stratum,
  strataOverlap,
  summarize,
  SummaryVersion,
  SUSPEND_REASON_TEXT,
  SuspendedRecord,
} from "./domain";
import { seedState } from "./seed";

export interface AppState {
  boreholes: Borehole[];
  strata: Stratum[];
  records: SampleRecord[];
  suspended: SuspendedRecord[];
  revisions: Revision[];
  versions: SummaryVersion[];
}

export type Role = "录入员" | "负责人";

export type Action =
  | { type: "addBorehole"; code: string }
  | {
      type: "addStratum";
      boreholeId: string;
      name: string;
      topDepth: number;
      bottomDepth: number;
    }
  | { type: "submitResult"; input: RecordInput; operator: string; now: string }
  | {
      type: "submitRevision";
      input: RecordInput & { stratumId: string; reason: string };
      operator: string;
      now: string;
    }
  | {
      type: "resolveSuspended";
      id: string;
      input: RecordInput;
      operator: string;
      now: string;
    }
  | { type: "discardSuspended"; id: string }
  | { type: "lockStratum"; stratumId: string; operator: string; now: string }
  | { type: "applyRevision"; id: string; operator: string; now: string }
  | { type: "shelveRevision"; id: string }
  | { type: "resetAll" };

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 录入结果：校验通过且地层未锁定 → 进记录；否则挂起。返回动作结果提示。 */
function acceptRecord(
  state: AppState,
  input: RecordInput,
  operator: string,
  now: string,
): { state: AppState; message: string } {
  const verdict = classifyRecord(input, state.strata);
  if (!verdict.ok) {
    const suspended: SuspendedRecord = {
      id: uid(),
      boreholeId: input.boreholeId,
      sampleNo: input.sampleNo,
      depth: input.depth,
      waterContent: input.waterContent,
      density: input.density,
      liquidLimit: input.liquidLimit,
      plasticLimit: input.plasticLimit,
      frictionAngle: input.frictionAngle,
      cohesion: input.cohesion,
      reasons: verdict.reasons,
      createdAt: now,
      createdBy: operator,
    };
    return {
      state: { ...state, suspended: [...state.suspended, suspended] },
      message: `已挂起：${verdict.reasons
        .map((r) => SUSPEND_REASON_TEXT[r])
        .join("；")}`,
    };
  }

  const locked = state.versions.some(
    (v) => v.stratumId === verdict.stratum.id,
  );
  if (locked) {
    // 锁定地层不直接收新结果，必须由修订流程进入
    return {
      state,
      message: `LOCKED:${verdict.stratum.id}`,
    };
  }

  const record: SampleRecord = {
    id: uid(),
    boreholeId: input.boreholeId,
    stratumId: verdict.stratum.id,
    sampleNo: input.sampleNo,
    depth: input.depth,
    waterContent: input.waterContent,
    density: input.density,
    liquidLimit: input.liquidLimit,
    plasticLimit: input.plasticLimit,
    frictionAngle: input.frictionAngle,
    cohesion: input.cohesion,
    createdAt: now,
    createdBy: operator,
  };
  return {
    state: { ...state, records: [...state.records, record] },
    message: `已落入 ${verdict.stratum.name}`,
  };
}

export interface DispatchResult {
  state: AppState;
  message: string;
}

export function reduce(state: AppState, action: Action): DispatchResult {
  switch (action.type) {
    case "addBorehole": {
      const code = action.code.trim();
      if (!code) return { state, message: "孔号不能为空" };
      if (state.boreholes.some((b) => b.code === code)) {
        return { state, message: `钻孔 ${code} 已存在` };
      }
      return {
        state: {
          ...state,
          boreholes: [...state.boreholes, { id: uid(), code }],
        },
        message: `已新建钻孔 ${code}`,
      };
    }

    case "addStratum": {
      const name = action.name.trim();
      if (!name) return { state, message: "地层名称不能为空" };
      if (!(action.topDepth < action.bottomDepth)) {
        return { state, message: "层顶埋深必须小于层底埋深" };
      }
      if (
        strataOverlap(
          state.strata,
          action.boreholeId,
          action.topDepth,
          action.bottomDepth,
        )
      ) {
        return { state, message: "与该孔既有地层区间重叠，未保存" };
      }
      const stratum: Stratum = {
        id: uid(),
        boreholeId: action.boreholeId,
        name,
        topDepth: action.topDepth,
        bottomDepth: action.bottomDepth,
      };
      return {
        state: { ...state, strata: [...state.strata, stratum] },
        message: `已添加地层 ${name}`,
      };
    }

    case "submitResult":
      return acceptRecord(state, action.input, action.operator, action.now);

    case "submitRevision": {
      const reason = action.input.reason.trim();
      if (!reason) return { state, message: "修订必须填写原因" };
      const verdict = classifyRecord(action.input, state.strata);
      if (!verdict.ok) {
        return { state, message: "修订数据本身未通过校验，请先修正指标" };
      }
      if (verdict.stratum.id !== action.input.stratumId) {
        return { state, message: "修订归属地层与目标地层不一致" };
      }
      const revision: Revision = {
        id: uid(),
        boreholeId: action.input.boreholeId,
        stratumId: action.input.stratumId,
        sampleNo: action.input.sampleNo,
        depth: action.input.depth,
        waterContent: action.input.waterContent,
        density: action.input.density,
        liquidLimit: action.input.liquidLimit,
        plasticLimit: action.input.plasticLimit,
        frictionAngle: action.input.frictionAngle,
        cohesion: action.input.cohesion,
        reason,
        status: "pending",
        createdAt: action.now,
        createdBy: action.operator,
      };
      return {
        state: { ...state, revisions: [...state.revisions, revision] },
        message: `已另建修订（不覆盖锁定值），待负责人处理`,
      };
    }

    case "resolveSuspended": {
      const target = state.suspended.find((s) => s.id === action.id);
      if (!target) return { state, message: "挂起记录不存在" };
      // 修正后若命中已锁定地层，不能静默丢弃：保留挂起并提示走修订流程
      const verdict = classifyRecord(action.input, state.strata);
      if (
        verdict.ok &&
        state.versions.some((v) => v.stratumId === verdict.stratum.id)
      ) {
        return {
          state,
          message: `修正后命中已锁定的 ${verdict.stratum.name}，记录保留挂起；请到「结果录入」对该层另建修订`,
        };
      }
      const without: AppState = {
        ...state,
        suspended: state.suspended.filter((s) => s.id !== action.id),
      };
      return acceptRecord(without, action.input, action.operator, action.now);
    }

    case "discardSuspended": {
      return {
        state: {
          ...state,
          suspended: state.suspended.filter((s) => s.id !== action.id),
        },
        message: "已删除该挂起记录",
      };
    }

    case "lockStratum": {
      const stratum = state.strata.find((s) => s.id === action.stratumId);
      if (!stratum) return { state, message: "地层不存在" };
      if (state.versions.some((v) => v.stratumId === action.stratumId)) {
        return { state, message: "该地层已锁定，新结果请走修订流程" };
      }
      const summary = summarize(
        state.records.filter((r) => r.stratumId === action.stratumId),
      );
      if (!canLock(summary)) {
        return { state, message: "指标未凑齐，负责人暂不能编报锁定" };
      }
      const version: SummaryVersion = {
        id: uid(),
        stratumId: action.stratumId,
        version: 1,
        summary,
        note: "首次编报锁定",
        createdAt: action.now,
        createdBy: action.operator,
      };
      return {
        state: { ...state, versions: [...state.versions, version] },
        message: `${stratum.name} 已编入报告并锁定（v1）`,
      };
    }

    case "applyRevision": {
      const revision = state.revisions.find((r) => r.id === action.id);
      if (!revision || revision.status !== "pending") {
        return { state, message: "修订不存在或已处理" };
      }
      const record: SampleRecord = {
        id: uid(),
        boreholeId: revision.boreholeId,
        stratumId: revision.stratumId,
        sampleNo: revision.sampleNo,
        depth: revision.depth,
        waterContent: revision.waterContent,
        density: revision.density,
        liquidLimit: revision.liquidLimit,
        plasticLimit: revision.plasticLimit,
        frictionAngle: revision.frictionAngle,
        cohesion: revision.cohesion,
        createdAt: action.now,
        createdBy: action.operator,
        fromRevisionId: revision.id,
      };
      const records = [...state.records, record];
      const summary = summarize(
        records.filter((r) => r.stratumId === revision.stratumId),
      );
      const nextVersionNo =
        Math.max(
          0,
          ...state.versions
            .filter((v) => v.stratumId === revision.stratumId)
            .map((v) => v.version),
        ) + 1;
      const version: SummaryVersion = {
        id: uid(),
        stratumId: revision.stratumId,
        version: nextVersionNo,
        summary,
        note: `采纳修订：${revision.reason}`,
        createdAt: action.now,
        createdBy: action.operator,
      };
      return {
        state: {
          ...state,
          records,
          versions: [...state.versions, version],
          revisions: state.revisions.map((r) =>
            r.id === action.id ? { ...r, status: "applied" } : r,
          ),
        },
        message: `修订已采纳，生成汇总 v${nextVersionNo}（原版本保留）`,
      };
    }

    case "shelveRevision": {
      return {
        state: {
          ...state,
          revisions: state.revisions.map((r) =>
            r.id === action.id ? { ...r, status: "shelved" } : r,
          ),
        },
        message: "修订已搁置，保留在修订历史中",
      };
    }

    case "resetAll":
      return { state: seedState(), message: "已恢复示例数据" };

    default:
      return { state, message: "" };
  }
}

// ---------------------------------------------------------------------------
// 持久化与 Hook
// ---------------------------------------------------------------------------

const STORAGE_KEY = "hxwl03-lab-results-v1";

function loadInitial(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (Array.isArray(parsed.boreholes) && Array.isArray(parsed.strata)) {
        return parsed;
      }
    }
  } catch {
    // 本地数据损坏时回退到种子数据
  }
  return seedState();
}

function persist(state: AppState): AppState {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时静默失败，页面内状态仍可用
  }
  return state;
}

export interface Store {
  state: AppState;
  lastMessage: string;
  dispatch: (action: Action) => void;
}

export function useStore(): Store {
  const [inner, innerDispatch] = useReducer(
    (
      prev: { state: AppState; lastMessage: string },
      action: Action,
    ): { state: AppState; lastMessage: string } => {
      const result = reduce(prev.state, action);
      return { state: persist(result.state), lastMessage: result.message };
    },
    undefined,
    () => ({ state: loadInitial(), lastMessage: "" }),
  );

  return useMemo(
    () => ({
      state: inner.state,
      lastMessage: inner.lastMessage,
      dispatch: innerDispatch,
    }),
    [inner],
  );
}

export function stratumOf(state: AppState, id: string): Stratum | undefined {
  return state.strata.find((s) => s.id === id);
}

export function boreholeOf(state: AppState, id: string): Borehole | undefined {
  return state.boreholes.find((b) => b.id === id);
}

export function holeCode(state: AppState, boreholeId: string): string {
  return boreholeOf(state, boreholeId)?.code ?? "未知孔";
}

export function isLocked(state: AppState, stratumId: string): boolean {
  return state.versions.some((v) => v.stratumId === stratumId);
}

export function currentSummary(state: AppState, stratumId: string) {
  return summarize(state.records.filter((r) => r.stratumId === stratumId));
}
