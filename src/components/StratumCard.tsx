import { useMemo, useState } from "react";
import type {
  Averages,
  Borehole,
  LockState,
  SampleRecord,
  Stratum,
} from "../lib/types";
import { aggregate, completeness } from "../lib/domain";
import { MetricTable, PendingSamples, StratumVersions } from "./Metrics";

interface Props {
  hole: Borehole;
  stratum: Stratum;
  records: SampleRecord[]; // 落到该地层的有效记录
  pending: SampleRecord[];
  lock: LockState | undefined;
  isManager: boolean;
  onLock: (sampleIds: string[], avg: Averages) => void;
  onRevise: (
    reason: string,
    sampleIds: string[],
    avg: Averages
  ) => void;
}

export function StratumCard({
  hole,
  stratum,
  records,
  pending,
  lock,
  isManager,
  onLock,
  onRevise,
}: Props) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  const locked = (lock?.versions.length ?? 0) > 0;
  const latest = lock?.versions[lock.versions.length - 1];
  const pendingAvg = useMemo(() => aggregate(records), [records]);
  const check = useMemo(() => completeness(records), [records]);

  const handleLock = () => {
    if (!pendingAvg || !check.ready) return;
    onLock(records.map((r) => r.id), pendingAvg);
  };

  const handleRevise = () => {
    setErr("");
    if (!reason.trim()) {
      setErr("修订必须填写原因");
      return;
    }
    if (!pendingAvg || !check.ready) return;
    onRevise(reason.trim(), records.map((r) => r.id), pendingAvg);
    setReason("");
  };

  return (
    <article className={`stratum-card ${locked ? "locked" : "unlocked"}`}>
      <header className="stratum-head">
        <div>
          <h3>
            <span className="stratum-code">{stratum.code}</span>
            {stratum.name}
            <span className="stratum-range">
              {hole.name} · {stratum.top}～{stratum.bottom}m
            </span>
          </h3>
        </div>
        {locked ? (
          <span className="badge badge-locked">
            🔒 已编入报告 v{latest!.version}
          </span>
        ) : (
          <span className="badge badge-draft">未锁定</span>
        )}
      </header>

      <div className="stratum-body">
        <div className="stratum-metrics">
          {locked && latest ? (
            <>
              <p className="table-caption">
                报告采用值（v{latest.version} 锁定快照，原值不可覆盖）
              </p>
              <MetricTable avg={latest.avg} />
            </>
          ) : pendingAvg ? (
            <>
              <p className="table-caption">当前有效土样汇总（{records.length} 件）</p>
              <MetricTable avg={pendingAvg} />
            </>
          ) : (
            <p className="empty-note">该地层尚无有效土样，无法汇总。</p>
          )}

          {locked && pending.length > 0 && pendingAvg && (
            <>
              <PendingSamples samples={pending} />
              <p className="table-caption">
                若并入新结果的预计汇总（{records.length} 件）
              </p>
              <MetricTable avg={pendingAvg} baseline={latest!.avg} />
            </>
          )}
        </div>

        <div className="stratum-side">
          {!locked && (
            <>
              <div className={`readiness ${check.ready ? "ready" : "notready"}`}>
                <strong>{check.ready ? "✓ 指标已凑齐" : "指标未凑齐"}</strong>
                {!check.ready && (
                  <ul>
                    {check.missing.map((m) => (
                      <li key={m}>缺：{m}</li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                className="primary-action"
                disabled={!isManager || !check.ready}
                title={
                  !isManager
                    ? "仅项目负责人可编入报告并锁定"
                    : !check.ready
                    ? "指标凑齐后才能锁定"
                    : "负责人编入报告并锁定"
                }
                onClick={handleLock}
              >
                {isManager ? "编入报告并锁定" : "仅负责人可锁定"}
              </button>
            </>
          )}

          {locked && (
            <div className="revise-box">
              <label className="reason-label">
                <span>修订原因（必填）</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="如：补送 T07 含水率复测，原值偏高"
                  rows={3}
                  disabled={!isManager || pending.length === 0}
                />
              </label>
              <button
                className="primary-action revise-btn"
                disabled={!isManager || pending.length === 0 || !check.ready}
                title={
                  !isManager
                    ? "仅项目负责人可发起修订"
                    : pending.length === 0
                    ? "暂无新结果，无需修订"
                    : "另建修订版本，原值保留"
                }
                onClick={handleRevise}
              >
                {pending.length > 0
                  ? `另建修订 v${latest!.version + 1}（不覆盖原值）`
                  : "无待修订结果"}
              </button>
              {err && <p className="inline-err">{err}</p>}
              <p className="lock-note">
                新结果不得覆盖 v{latest!.version} 原值，只能另建带原因修订。
              </p>
            </div>
          )}
        </div>
      </div>

      {lock && <StratumVersions versions={lock.versions} />}
    </article>
  );
}
