import { useState } from "react";
import { BOREHOLES, holeOf, stratumOf } from "../lib/domain";
import type { SampleRecord } from "../lib/types";
import type { RecordDraft } from "../lib/store";

function initialDraft(editing: SampleRecord | null): RecordDraft {
  if (!editing) {
    return {
      sampleNo: "",
      holeId: BOREHOLES[0].id,
      depth: 0,
      water: 0,
      density: 0,
      liquidLimit: 0,
      plasticLimit: 0,
      friction: 0,
      cohesion: 0,
    };
  }
  return {
    sampleNo: editing.sampleNo,
    holeId: editing.holeId,
    depth: editing.depth,
    water: editing.water,
    density: editing.density,
    liquidLimit: editing.liquidLimit,
    plasticLimit: editing.plasticLimit,
    friction: editing.friction,
    cohesion: editing.cohesion,
  };
}

const NUM_FIELDS: {
  key: keyof Omit<RecordDraft, "sampleNo" | "holeId">;
  label: string;
  unit: string;
  step: number;
}[] = [
  { key: "depth", label: "取样深度", unit: "m", step: 0.1 },
  { key: "water", label: "含水量 w", unit: "%", step: 0.1 },
  { key: "density", label: "密度 ρ", unit: "g/cm³", step: 0.01 },
  { key: "liquidLimit", label: "液限 wL", unit: "%", step: 0.1 },
  { key: "plasticLimit", label: "塑限 wP", unit: "%", step: 0.1 },
  { key: "friction", label: "内摩擦角 φ", unit: "°", step: 0.1 },
  { key: "cohesion", label: "黏聚力 c", unit: "kPa", step: 0.1 },
];

interface Props {
  existingNos: string[];
  editing: SampleRecord | null;
  onSubmit: (draft: RecordDraft) => SampleRecord;
  onCancelEdit: () => void;
}

/** 父组件以 key={editing?.id ?? "new"} 挂载，切换/取消编辑即重置本表单 */
export function EntryForm({ existingNos, editing, onSubmit, onCancelEdit }: Props) {
  const [draft, setDraft] = useState<RecordDraft>(() => initialDraft(editing));
  const [err, setErr] = useState("");
  const [lastResult, setLastResult] = useState<{
    holeName: string;
    record: SampleRecord;
  } | null>(null);

  const update = (patch: Partial<RecordDraft>) => {
    setErr("");
    setDraft((d) => ({ ...d, ...patch }));
  };

  const submit = () => {
    setErr("");
    if (!draft.sampleNo.trim()) {
      setErr("土样编号必填");
      return;
    }
    const duplicated = existingNos
      .filter((no) => no !== editing?.sampleNo)
      .some((no) => no === draft.sampleNo.trim());
    if (duplicated) {
      setErr(`土样编号 ${draft.sampleNo.trim()} 已存在，禁止重复录入`);
      return;
    }
    const record = onSubmit({ ...draft, sampleNo: draft.sampleNo.trim() });
    setLastResult({ holeName: holeOf(record.holeId).name, record });
    if (!editing) setDraft(initialDraft(null));
  };

  const editingStratumHint = editing
    ? (() => {
        try {
          const { hole, stratum } = stratumOf(
            editing.stratumId ?? "__none__"
          );
          return `${hole.name} ${stratum.code}${stratum.name}`;
        } catch {
          return undefined;
        }
      })()
    : undefined;

  return (
    <div className="entry-form">
      {editing && (
        <div className="editing-banner">
          正在处理挂起记录：<strong>{editing.sampleNo}</strong>（{holeOf(editing.holeId).name} · 原深度{" "}
          {editing.depth}m{editingStratumHint ? ` · 曾尝试落入 ${editingStratumHint}` : ""}）。
          修改后重新校验，挂起原因记录不会被删除。
        </div>
      )}

      <div className="form-grid">
        <label className="span2">
          <span>土样编号 *</span>
          <input
            value={draft.sampleNo}
            placeholder="如 ZK18-T07"
            onChange={(e) => update({ sampleNo: e.target.value })}
            readOnly={!!editing}
          />
        </label>
        <label>
          <span>钻孔 *</span>
          <select
            value={draft.holeId}
            onChange={(e) => update({ holeId: e.target.value })}
            disabled={!!editing}
          >
            {BOREHOLES.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}（孔深 {h.totalDepth}m）
              </option>
            ))}
          </select>
        </label>
        {NUM_FIELDS.map((f) => (
          <label key={f.key}>
            <span>
              {f.label} <em className="unit-inline">{f.unit}</em>
            </span>
            <input
              type="number"
              step={f.step}
              value={draft[f.key]}
              onChange={(e) =>
                update({ [f.key]: Number(e.target.value) } as Partial<RecordDraft>)
              }
            />
          </label>
        ))}
      </div>

      <div className="form-actions">
        {err && <p className="inline-err">✕ {err}</p>}
        {editing ? (
          <>
            <button className="primary-action" onClick={submit}>
              重新校验并落层
            </button>
            <button onClick={onCancelEdit}>取消（挂起原样保留）</button>
          </>
        ) : (
          <button className="primary-action" onClick={submit}>
            提交试验结果
          </button>
        )}
      </div>

      {lastResult && (
        <ResultBanner
          key={lastResult.record.id + lastResult.record.status + lastResult.record.createdAt}
          holeName={lastResult.holeName}
          record={lastResult.record}
        />
      )}
    </div>
  );
}

function ResultBanner({
  holeName,
  record,
}: {
  holeName: string;
  record: SampleRecord;
}) {
  if (record.status === "accepted") {
    return (
      <div className="banner banner-ok">
        ✓ {holeName} · 土样 {record.sampleNo}（深度 {record.depth}m）校验通过，已落入对应地层。
      </div>
    );
  }
  return (
    <div className="banner banner-suspend">
      <strong>
        ⚠ {holeName} · 记录「{record.sampleNo}」（深度 {record.depth}m）已挂起
      </strong>
      <ul>
        {record.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <span className="banner-foot">挂起记录原样保留，可在下方挂起列表修正后重新校验。</span>
    </div>
  );
}
