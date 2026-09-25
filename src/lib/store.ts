import { useCallback, useEffect, useState } from "react";
import type {
  Averages,
  LockState,
  PersistShape,
  SampleRecord,
} from "./types";
import { buildInitialRecords, validateRecord } from "./domain";

const STORAGE_KEY = "hxwl-03-geotech-v1";

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `r-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export interface RecordDraft {
  sampleNo: string;
  holeId: string;
  depth: number;
  water: number;
  density: number;
  liquidLimit: number;
  plasticLimit: number;
  friction: number;
  cohesion: number;
}

function load(): PersistShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistShape;
      if (Array.isArray(parsed.records) && parsed.locks) return parsed;
    }
  } catch {
    /* 数据损坏则回落到示例数据 */
  }
  return { records: buildInitialRecords(), locks: {} };
}

/**
 * 工作流状态：
 * - records：全部土样记录（含挂起），原样保留
 * - locks：每个地层的锁定版本链（v1 编入报告，v2+ 带原因修订），不覆盖原值
 */
export function useGeotechStore() {
  const [state, setState] = useState<PersistShape>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addRecord = useCallback(
    (draft: RecordDraft) => {
      const v = validateRecord(
        draft.holeId,
        draft.depth,
        draft.liquidLimit,
        draft.plasticLimit
      );
      const record: SampleRecord = {
        id: uid(),
        ...draft,
        status: v.status,
        reasons: v.reasons,
        stratumId: v.stratumId,
        createdAt: Date.now(),
      };
      setState((s) => ({ ...s, records: [...s.records, record] }));
      return record;
    },
    []
  );

  /** 挂起记录处理：修正后重新校验落层；记录本身保留，只更新结果 */
  const reviseSuspended = useCallback(
    (id: string, draft: RecordDraft) => {
      let record: SampleRecord | undefined;
      setState((s) => {
        const v = validateRecord(
          draft.holeId,
          draft.depth,
          draft.liquidLimit,
          draft.plasticLimit
        );
        record = {
          ...s.records.find((r) => r.id === id)!,
          ...draft,
          status: v.status,
          reasons: v.reasons,
          stratumId: v.stratumId,
        };
        return {
          ...s,
          records: s.records.map((r) => (r.id === id ? record! : r)),
        };
      });
      return record!;
    },
    []
  );

  /** 负责人锁定：指标凑齐才能编入报告；锁定即对当前汇总做快照 */
  const lockStratum = useCallback(
    (stratumId: string, sampleIds: string[], avg: Averages, operator: string) => {
      setState((s) => {
        const prev: LockState = s.locks[stratumId] ?? { versions: [] };
        const version: LockState = {
          versions: [
            ...prev.versions,
            {
              version: prev.versions.length + 1,
              reason:
                prev.versions.length === 0 ? "编入报告（首次锁定）" : "",
              operator,
              createdAt: Date.now(),
              sampleIds: [...sampleIds],
              avg,
            },
          ],
        };
        return { ...s, locks: { ...s.locks, [stratumId]: version } };
      });
    },
    []
  );

  /**
   * 锁定后新结果只能另建带原因修订：
   * 原值（旧版本快照）保留，新版本另行追加。
   */
  const reviseStratum = useCallback(
    (
      stratumId: string,
      reason: string,
      sampleIds: string[],
      avg: Averages,
      operator: string
    ) => {
      setState((s) => {
        const prev: LockState = s.locks[stratumId] ?? { versions: [] };
        if (prev.versions.length === 0) return s; // 未锁定不允许走修订流程
        return {
          ...s,
          locks: {
            ...s.locks,
            [stratumId]: {
              versions: [
                ...prev.versions,
                {
                  version: prev.versions.length + 1,
                  reason,
                  operator,
                  createdAt: Date.now(),
                  sampleIds: [...sampleIds],
                  avg,
                },
              ],
            },
          },
        };
      });
    },
    []
  );

  /** 锁定后又有新的有效结果进入该地层（尚未编入新版本） */
  const pendingSamples = useCallback(
    (stratumId: string): SampleRecord[] => {
      const lock = state.locks[stratumId];
      if (!lock) {
        return state.records.filter(
          (r) => r.status === "accepted" && r.stratumId === stratumId
        );
      }
      const snapshotted = new Set(
        lock.versions[lock.versions.length - 1].sampleIds
      );
      return state.records.filter(
        (r) =>
          r.status === "accepted" &&
          r.stratumId === stratumId &&
          !snapshotted.has(r.id)
      );
    },
    [state.records, state.locks]
  );

  const resetAll = useCallback(() => {
    setState({ records: buildInitialRecords(), locks: {} });
  }, []);

  return {
    records: state.records,
    locks: state.locks,
    addRecord,
    reviseSuspended,
    lockStratum,
    reviseStratum,
    pendingSamples,
    resetAll,
  };
}
