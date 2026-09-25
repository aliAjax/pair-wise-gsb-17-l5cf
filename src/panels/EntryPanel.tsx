// 结果录入：填土样编号、深度与六项指标，实时预览落点；
// 命中已锁定地层时转为“另建修订”，必须填修订原因。

import { FormEvent, useMemo, useState } from "react";
import {
  classifyRecord,
  METRIC_FIELDS,
  MetricKey,
  RecordInput,
  SUSPEND_REASON_TEXT,
} from "../domain";
import { AppState, Dispatch, holeCode, isLocked } from "./panelCommon";
import { Badge, nowText, parseNum } from "../ui";

type MetricInputs = Record<MetricKey, string>;

const EMPTY_METRICS: MetricInputs = {
  waterContent: "",
  density: "",
  liquidLimit: "",
  plasticLimit: "",
  frictionAngle: "",
  cohesion: "",
};

export default function EntryPanel({
  state,
  dispatch,
  operator,
}: {
  state: AppState;
  dispatch: Dispatch;
  operator: string;
}) {
  const [boreholeId, setBoreholeId] = useState(state.boreholes[0]?.id ?? "");
  const [sampleNo, setSampleNo] = useState("");
  const [depth, setDepth] = useState("");
  const [metrics, setMetrics] = useState<MetricInputs>(EMPTY_METRICS);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const depthNum = parseNum(depth);

  // 实时预览：这条记录会落到哪层，或因何挂起
  const preview = useMemo(() => {
    if (!boreholeId || depthNum === undefined || Number.isNaN(depthNum)) {
      return null;
    }
    const input: RecordInput = {
      boreholeId,
      sampleNo: sampleNo || "（未填）",
      depth: depthNum,
    };
    return classifyRecord(input, state.strata);
  }, [boreholeId, depthNum, sampleNo, state.strata]);

  const lockedHit =
    preview?.ok && isLocked(state, preview.stratum.id) ? preview.stratum : null;

  function setMetric(key: MetricKey, value: string) {
    setMetrics((m) => ({ ...m, [key]: value }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!boreholeId) return setError("请选择钻孔");
    if (!sampleNo.trim()) return setError("请填写土样编号");
    if (depthNum === undefined || Number.isNaN(depthNum) || depthNum < 0) {
      return setError("请填写有效的取样深度");
    }
    const parsed: RecordInput = {
      boreholeId,
      sampleNo: sampleNo.trim(),
      depth: depthNum,
    };
    for (const f of METRIC_FIELDS) {
      const v = parseNum(metrics[f.key]);
      if (v !== undefined && (Number.isNaN(v) || v < 0)) {
        return setError(`${f.label} 需为非负数值，未做该试验可留空`);
      }
      parsed[f.key] = v;
    }

    if (lockedHit) {
      if (!reason.trim()) {
        return setError("目标地层已锁定：新结果只能另建修订，必须填写修订原因");
      }
      dispatch({
        type: "submitRevision",
        input: { ...parsed, stratumId: lockedHit.id, reason },
        operator,
        now: nowText(),
      });
    } else {
      dispatch({ type: "submitResult", input: parsed, operator, now: nowText() });
    }
    setSampleNo("");
    setDepth("");
    setMetrics(EMPTY_METRICS);
    setReason("");
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>试验结果回来 → 按孔和深度落地层</p>
          <h2>结果录入</h2>
        </div>
      </div>

      <form className="entry-form" onSubmit={submit}>
        <div className="field-grid">
          <label>
            <span>钻孔 *</span>
            <select
              value={boreholeId}
              onChange={(e) => setBoreholeId(e.target.value)}
            >
              {state.boreholes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>土样编号 *</span>
            <input
              value={sampleNo}
              onChange={(e) => setSampleNo(e.target.value)}
              placeholder="如 ZK1-T10"
            />
          </label>
          <label>
            <span>取样深度 (m) *</span>
            <input
              value={depth}
              onChange={(e) => setDepth(e.target.value)}
              placeholder="如 3.20"
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
                onChange={(e) => setMetric(f.key, e.target.value)}
                placeholder="未做可留空"
                inputMode="decimal"
              />
            </label>
          ))}
        </div>

        {preview && !preview.ok && (
          <div className="notice notice-warn">
            提交后将挂起：
            {preview.reasons.map((r) => SUSPEND_REASON_TEXT[r]).join("；")}
          </div>
        )}
        {preview?.ok && !lockedHit && (
          <div className="notice notice-ok">
            将落入 {holeCode(state, preview.stratum.boreholeId)} ·{" "}
            {preview.stratum.name}（{preview.stratum.topDepth}–
            {preview.stratum.bottomDepth} m）
          </div>
        )}
        {lockedHit && (
          <div className="notice notice-danger">
            {lockedHit.name} 已编入报告并锁定，本次提交不会覆盖原值，将另建修订。
            <label className="reason-field">
              <span>修订原因 *</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="如：复测结果补报（试验报告编号…）"
              />
            </label>
          </div>
        )}
        {error && <div className="notice notice-danger">{error}</div>}

        <div className="form-actions">
          <button type="submit" className="primary-action">
            {lockedHit ? "另建修订（不覆盖原值）" : "提交试验结果"}
          </button>
        </div>
      </form>
    </section>
  );
}
