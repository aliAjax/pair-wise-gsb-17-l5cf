// 挂起记录：点明哪孔、哪条记录、什么原因；可修正后重新提交或删除。

import { FormEvent, useState } from "react";
import {
  METRIC_FIELDS,
  MetricKey,
  RecordInput,
  SUSPEND_REASON_TEXT,
  SuspendedRecord,
} from "../domain";
import { AppState, Dispatch, holeCode } from "./panelCommon";
import { Badge, MetricsLine, nowText, parseNum } from "../ui";

function FixForm({
  record,
  state,
  dispatch,
  operator,
  onDone,
}: {
  record: SuspendedRecord;
  state: AppState;
  dispatch: Dispatch;
  operator: string;
  onDone: () => void;
}) {
  const [sampleNo, setSampleNo] = useState(record.sampleNo);
  const [depth, setDepth] = useState(String(record.depth));
  const [metrics, setMetrics] = useState<Record<MetricKey, string>>({
    waterContent: record.waterContent?.toString() ?? "",
    density: record.density?.toString() ?? "",
    liquidLimit: record.liquidLimit?.toString() ?? "",
    plasticLimit: record.plasticLimit?.toString() ?? "",
    frictionAngle: record.frictionAngle?.toString() ?? "",
    cohesion: record.cohesion?.toString() ?? "",
  });
  const [error, setError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const depthNum = parseNum(depth);
    if (!sampleNo.trim()) return setError("请填写土样编号");
    if (depthNum === undefined || Number.isNaN(depthNum) || depthNum < 0) {
      return setError("请填写有效的取样深度");
    }
    const input: RecordInput = {
      boreholeId: record.boreholeId,
      sampleNo: sampleNo.trim(),
      depth: depthNum,
    };
    for (const f of METRIC_FIELDS) {
      const v = parseNum(metrics[f.key]);
      if (v !== undefined && (Number.isNaN(v) || v < 0)) {
        return setError(`${f.label} 需为非负数值`);
      }
      input[f.key] = v;
    }
    dispatch({
      type: "resolveSuspended",
      id: record.id,
      input,
      operator,
      now: nowText(),
    });
    onDone();
  }

  return (
    <form className="fix-form" onSubmit={submit}>
      <div className="field-grid">
        <label>
          <span>土样编号</span>
          <input value={sampleNo} onChange={(e) => setSampleNo(e.target.value)} />
        </label>
        <label>
          <span>取样深度 (m)</span>
          <input
            value={depth}
            onChange={(e) => setDepth(e.target.value)}
            inputMode="decimal"
          />
        </label>
        {METRIC_FIELDS.map((f) => (
          <label key={f.key}>
            <span>
              {f.label}（{f.unit}）
            </span>
            <input
              value={metrics[f.key]}
              onChange={(e) =>
                setMetrics((m) => ({ ...m, [f.key]: e.target.value }))
              }
              inputMode="decimal"
            />
          </label>
        ))}
      </div>
      {error && <div className="notice notice-danger">{error}</div>}
      <div className="form-actions">
        <button type="submit" className="primary-action">
          修正后重新提交
        </button>
        <button type="button" onClick={onDone}>
          取消
        </button>
      </div>
      <p className="empty-hint">
        重新提交后仍不合格的，会作为新的挂起记录保留，可继续处理。
      </p>
    </form>
  );
}

export default function SuspendedPanel({
  state,
  dispatch,
  operator,
}: {
  state: AppState;
  dispatch: Dispatch;
  operator: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>哪孔 · 哪条记录 · 什么原因，一目了然</p>
          <h2>挂起记录（{state.suspended.length}）</h2>
        </div>
      </div>

      {state.suspended.length === 0 && (
        <p className="empty-hint">当前没有挂起的记录。</p>
      )}

      <div className="record-list">
        {state.suspended.map((s) => (
          <article key={s.id} className="record-card suspended-card">
            <div className="record-index">挂</div>
            <div className="record-body">
              <h3>
                {holeCode(state, s.boreholeId)} · 土样 {s.sampleNo} · 深度{" "}
                {s.depth.toFixed(2)} m
              </h3>
              <div className="reason-row">
                {s.reasons.map((r) => (
                  <Badge key={r} tone="danger">
                    {SUSPEND_REASON_TEXT[r]}
                  </Badge>
                ))}
              </div>
              <MetricsLine metrics={s} />
              <p className="meta">
                提交人 {s.createdBy} · {s.createdAt}
              </p>
              {editingId === s.id ? (
                <FixForm
                  record={s}
                  state={state}
                  dispatch={dispatch}
                  operator={operator}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <div className="form-actions">
                  <button onClick={() => setEditingId(s.id)}>修正重提</button>
                  <button
                    className="danger-action"
                    onClick={() => {
                      if (
                        window.confirm(
                          `确认删除 ${holeCode(state, s.boreholeId)} 的挂起记录 ${s.sampleNo}？`,
                        )
                      ) {
                        dispatch({ type: "discardSuspended", id: s.id });
                      }
                    }}
                  >
                    删除
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
