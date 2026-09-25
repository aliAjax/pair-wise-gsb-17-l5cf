// 钻孔与地层管理：建孔、划分地层区间，供结果录入时按深度落地。

import { FormEvent, useState } from "react";
import { AppState, Dispatch } from "./panelCommon";
import { fmt, Stratum } from "../domain";
import { parseNum } from "../ui";

function AddStratumForm({
  boreholeId,
  dispatch,
}: {
  boreholeId: string;
  dispatch: Dispatch;
}) {
  const [name, setName] = useState("");
  const [top, setTop] = useState("");
  const [bottom, setBottom] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const topDepth = parseNum(top);
    const bottomDepth = parseNum(bottom);
    if (topDepth === undefined || bottomDepth === undefined) return;
    if (Number.isNaN(topDepth) || Number.isNaN(bottomDepth)) return;
    dispatch({
      type: "addStratum",
      boreholeId,
      name,
      topDepth,
      bottomDepth,
    });
    setName("");
    setTop("");
    setBottom("");
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="地层名称，如 ②粉质黏土"
      />
      <input
        value={top}
        onChange={(e) => setTop(e.target.value)}
        placeholder="层顶埋深 m"
        inputMode="decimal"
      />
      <input
        value={bottom}
        onChange={(e) => setBottom(e.target.value)}
        placeholder="层底埋深 m"
        inputMode="decimal"
      />
      <button type="submit">添加地层</button>
    </form>
  );
}

export default function BoreholesPanel({
  state,
  dispatch,
}: {
  state: AppState;
  dispatch: Dispatch;
}) {
  const [code, setCode] = useState("");

  function addHole(e: FormEvent) {
    e.preventDefault();
    dispatch({ type: "addBorehole", code });
    setCode("");
  }

  const strataOf = (holeId: string): Stratum[] =>
    state.strata
      .filter((s) => s.boreholeId === holeId)
      .sort((a, b) => a.topDepth - b.topDepth);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>基础资料</p>
          <h2>钻孔与地层划分</h2>
        </div>
        <form className="inline-form" onSubmit={addHole}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="新钻孔号，如 ZK3"
          />
          <button type="submit" className="primary-action">
            新建钻孔
          </button>
        </form>
      </div>

      <div className="hole-grid">
        {state.boreholes.map((hole) => {
          const layers = strataOf(hole.id);
          const recordCount = state.records.filter(
            (r) => r.boreholeId === hole.id,
          ).length;
          return (
            <article key={hole.id} className="hole-card">
              <header>
                <h3>{hole.code}</h3>
                <span>
                  {layers.length} 个地层 · {recordCount} 条有效记录
                </span>
              </header>
              {layers.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>地层</th>
                      <th>层顶埋深 (m)</th>
                      <th>层底埋深 (m)</th>
                      <th>层厚 (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {layers.map((s) => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td>{fmt(s.topDepth)}</td>
                        <td>{fmt(s.bottomDepth)}</td>
                        <td>{fmt(s.bottomDepth - s.topDepth)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="empty-hint">尚未划分地层，请先添加地层区间。</p>
              )}
              <AddStratumForm boreholeId={hole.id} dispatch={dispatch} />
            </article>
          );
        })}
        {state.boreholes.length === 0 && (
          <p className="empty-hint">
            还没有钻孔。先新建钻孔并划分地层，试验结果才能按深度落地。
          </p>
        )}
      </div>
    </section>
  );
}
