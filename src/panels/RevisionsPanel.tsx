// 修订处理：锁定后到达的新结果以修订形式另建（必带原因）；
// 负责人可采纳（生成新汇总版本，原版本保留）或搁置；历史全部可查。

import { REVISION_STATUS_TEXT } from "../domain";
import { Role } from "../store";
import { AppState, Dispatch, holeCode, stratumOf } from "./panelCommon";
import { Badge, MetricsLine, nowText } from "../ui";

export default function RevisionsPanel({
  state,
  dispatch,
  role,
  operator,
}: {
  state: AppState;
  dispatch: Dispatch;
  role: Role;
  operator: string;
}) {
  const pending = state.revisions.filter((r) => r.status === "pending");
  const history = state.revisions.filter((r) => r.status !== "pending");

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>锁定地层的新结果只能另建修订，不覆盖原值</p>
          <h2>修订处理（待处理 {pending.length}）</h2>
        </div>
      </div>

      {pending.length === 0 && (
        <p className="empty-hint">没有待处理的修订。</p>
      )}

      <div className="record-list">
        {pending.map((rev) => (
          <article key={rev.id} className="record-card revision-card">
            <div className="record-index">修</div>
            <div className="record-body">
              <h3>
                {holeCode(state, rev.boreholeId)} ·{" "}
                {stratumOf(state, rev.stratumId)?.name ?? "未知地层"} · 土样{" "}
                {rev.sampleNo} · 深度 {rev.depth.toFixed(2)} m
              </h3>
              <p className="reason-text">修订原因：{rev.reason}</p>
              <MetricsLine metrics={rev} />
              <p className="meta">
                提交人 {rev.createdBy} · {rev.createdAt}
              </p>
              <div className="form-actions">
                <button
                  className="primary-action"
                  disabled={role !== "负责人"}
                  title={role !== "负责人" ? "只有负责人能处理修订" : ""}
                  onClick={() =>
                    dispatch({
                      type: "applyRevision",
                      id: rev.id,
                      operator,
                      now: nowText(),
                    })
                  }
                >
                  采纳并生成新汇总版本
                </button>
                <button
                  disabled={role !== "负责人"}
                  title={role !== "负责人" ? "只有负责人能处理修订" : ""}
                  onClick={() => dispatch({ type: "shelveRevision", id: rev.id })}
                >
                  搁置
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {history.length > 0 && (
        <>
          <h3 className="history-title">修订历史（{history.length}）</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>状态</th>
                <th>钻孔</th>
                <th>地层</th>
                <th>土样编号</th>
                <th>深度 (m)</th>
                <th>修订原因</th>
                <th>提交人</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {history.map((rev) => (
                <tr key={rev.id}>
                  <td>
                    <Badge tone={rev.status === "applied" ? "ok" : "muted"}>
                      {REVISION_STATUS_TEXT[rev.status]}
                    </Badge>
                  </td>
                  <td>{holeCode(state, rev.boreholeId)}</td>
                  <td>{stratumOf(state, rev.stratumId)?.name ?? "—"}</td>
                  <td>{rev.sampleNo}</td>
                  <td>{rev.depth.toFixed(2)}</td>
                  <td>{rev.reason}</td>
                  <td>{rev.createdBy}</td>
                  <td>{rev.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
