import type { SampleRecord } from "../lib/types";
import { fmt, fmtTime, holeOf } from "../lib/domain";

interface Props {
  records: SampleRecord[];
  editingId?: string | null;
  onEdit: (record: SampleRecord) => void;
  onCancelEdit: () => void;
}

/** 挂起区：点明哪孔哪条记录出错、什么原因，挂起记录原样保留可接着处理 */
export function SuspendedList({ records, editingId, onEdit, onCancelEdit }: Props) {
  return (
    <section className="panel suspend-panel">
      <div className="section-heading">
        <div>
          <p>挂起记录（不参与汇总）</p>
          <h2>待处理：{records.length} 条</h2>
        </div>
        <span className="hint">液限 ≤ 塑限，或深度压在分界线上时自动挂起</span>
      </div>

      {records.length === 0 ? (
        <p className="empty-note">当前没有挂起记录。</p>
      ) : (
        <div className="suspend-list">
          {records.map((r) => {
            const hole = holeOf(r.holeId);
            const editing = editingId === r.id;
            return (
              <article
                key={r.id}
                className={`suspend-card ${editing ? "editing" : ""}`}
              >
                <div className="suspend-top">
                  <span className="hole-tag">{hole.name}</span>
                  <strong className="sample-tag">{r.sampleNo}</strong>
                  <span className="depth-tag">深度 {r.depth}m</span>
                  <span className="time-tag">{fmtTime(r.createdAt)}</span>
                </div>
                <ul className="reason-list">
                  {r.reasons.map((reason) => (
                    <li key={reason}>✕ {reason}</li>
                  ))}
                </ul>
                <div className="suspend-values">
                  已填：w {fmt(r.water, 1)}% · ρ {fmt(r.density)} · wL{" "}
                  {fmt(r.liquidLimit, 1)}% · wP {fmt(r.plasticLimit, 1)}% · φ{" "}
                  {fmt(r.friction, 1)}° · c {fmt(r.cohesion, 1)}kPa
                </div>
                <div className="suspend-actions">
                  {editing ? (
                    <button onClick={onCancelEdit}>正在上方表单中处理…</button>
                  ) : (
                    <button className="primary-action" onClick={() => onEdit(r)}>
                      修正后重新校验
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
