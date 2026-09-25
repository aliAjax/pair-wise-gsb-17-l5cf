import type { LockState, SampleRecord } from "../lib/types";
import { fmt, stratumOf } from "../lib/domain";

interface Props {
  records: SampleRecord[]; // 有效记录
  locks: Record<string, LockState>;
}

/** 有效土样台账：标明落在哪个孔哪层、当前是否已被锁定版本覆盖 */
export function RecordsTable({ records, locks }: Props) {
  const sorted = [...records].sort((a, b) =>
    a.holeId === b.holeId
      ? a.depth - b.depth
      : a.holeId.localeCompare(b.holeId)
  );

  return (
    <section className="panel records-panel">
      <div className="section-heading">
        <div>
          <p>有效土样台账</p>
          <h2>已落层记录：{records.length} 条</h2>
        </div>
        <span className="hint">挂起记录见上方专区；锁定后入库的新结果标为“待修订”</span>
      </div>

      <div className="table-scroll">
        <table className="records-table">
          <thead>
            <tr>
              <th>钻孔</th>
              <th>土样编号</th>
              <th>深度(m)</th>
              <th>归属地层</th>
              <th>w(%)</th>
              <th>ρ(g/cm³)</th>
              <th>wL(%)</th>
              <th>wP(%)</th>
              <th>φ(°)</th>
              <th>c(kPa)</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const { hole, stratum } = stratumOf(r.stratumId!);
              const lock = locks[r.stratumId!];
              const locked = lock && lock.versions.length > 0;
              const inLatest =
                !!locked &&
                lock.versions[lock.versions.length - 1].sampleIds.includes(r.id);
              return (
                <tr key={r.id}>
                  <td>{hole.name}</td>
                  <td className="mono">{r.sampleNo}</td>
                  <td>{fmt(r.depth, 1)}</td>
                  <td>
                    {stratum.code}
                    {stratum.name}
                  </td>
                  <td>{fmt(r.water, 1)}</td>
                  <td>{fmt(r.density)}</td>
                  <td>{fmt(r.liquidLimit, 1)}</td>
                  <td>{fmt(r.plasticLimit, 1)}</td>
                  <td>{fmt(r.friction, 1)}</td>
                  <td>{fmt(r.cohesion, 1)}</td>
                  <td>
                    {!locked ? (
                      <span className="badge badge-draft">待锁定</span>
                    ) : inLatest ? (
                      <span className="badge badge-locked">
                        🔒 v{lock.versions.length}
                      </span>
                    ) : (
                      <span className="badge badge-pending-rev">待修订</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
