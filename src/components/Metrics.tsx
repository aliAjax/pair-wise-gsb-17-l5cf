import type { Averages, SampleRecord, StratumVersion } from "../lib/types";
import {
  METRICS,
  fmt,
  fmtTime,
  ilState,
} from "../lib/domain";

/** 汇总指标表（6 项均值 + 液性指数） */
export function MetricTable({
  avg,
  baseline,
}: {
  avg: Averages;
  baseline?: Averages;
}) {
  const delta = (a: number, b?: number) => {
    if (b === undefined || Number.isNaN(a) || Number.isNaN(b)) return null;
    const d = a - b;
    if (Math.abs(d) < 0.005) return <span className="delta flat">±0.00</span>;
    return (
      <span className={d > 0 ? "delta up" : "delta down"}>
        {d > 0 ? "▲" : "▼"} {fmt(Math.abs(d))}
      </span>
    );
  };
  const il = ilState(avg.il);

  return (
    <table className="metric-table">
      <thead>
        <tr>
          <th>指标</th>
          <th>数值</th>
          {baseline && <th>较上版</th>}
        </tr>
      </thead>
      <tbody>
        {METRICS.map((m) => (
          <tr key={m.key}>
            <td className="metric-name">{m.label}</td>
            <td>
              <strong>{fmt(avg[m.key])}</strong>
              <span className="unit">{m.unit}</span>
            </td>
            {baseline && <td>{delta(avg[m.key], baseline[m.key])}</td>}
          </tr>
        ))}
        <tr className="il-row">
          <td className="metric-name">液性指数 IL</td>
          <td>
            <strong>{fmt(avg.il)}</strong>
            <span className={`badge ${il.className}`}>{il.label}</span>
          </td>
          {baseline && <td>{delta(avg.il, baseline.il)}</td>}
        </tr>
      </tbody>
    </table>
  );
}

/** 修订历史：v1 首次编入报告，v2+ 带原因修订，原值原样保留 */
export function StratumVersions({ versions }: { versions: StratumVersion[] }) {
  if (versions.length === 0) return null;
  return (
    <div className="versions">
      <h5>版本与修订历史</h5>
      <ol className="version-timeline">
        {versions.map((v) => (
          <li key={v.version} className={v.version === 1 ? "v-first" : "v-rev"}>
            <div className="version-head">
              <span className="version-tag">v{v.version}</span>
              {v.version === 1 ? (
                <span className="version-action">编入报告并锁定</span>
              ) : (
                <span className="version-action">
                  带原因修订
                  <em className="version-reason">“{v.reason}”</em>
                </span>
              )}
            </div>
            <div className="version-meta">
              {v.operator} · {fmtTime(v.createdAt)} · 含 {v.sampleIds.length} 件土样
              {v.version > 1 && <span className="kept-note">（v{v.version - 1} 原值未覆盖，原样保留）</span>}
            </div>
            <details>
              <summary>查看 v{v.version} 锁定的指标值</summary>
              <MetricTable avg={v.avg} />
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PendingSamples({
  samples,
}: {
  samples: SampleRecord[];
}) {
  if (samples.length === 0) return null;
  return (
    <div className="pending-box">
      <h5>待处理的新结果（{samples.length} 件）</h5>
      <ul className="pending-list">
        {samples.map((s) => (
          <li key={s.id}>
            <strong>{s.sampleNo}</strong>
            <span>{s.depth}m</span>
            <span>
              w {fmt(s.water, 1)}% · ρ {fmt(s.density)} · φ {fmt(s.friction, 1)}° · c{" "}
              {fmt(s.cohesion, 1)}kPa
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
