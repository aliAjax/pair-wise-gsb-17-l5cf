// 地层汇总：同一地层指标平均值、塑性指数、液性指数；
// 指标凑齐后负责人可编入报告并锁定；锁定快照与历史版本全部保留。

import {
  canLock,
  fmt,
  liquidityState,
  METRIC_FIELDS,
  StratumSummary,
  summarize,
} from "../domain";
import { Role } from "../store";
import { AppState, Dispatch, isLocked } from "./panelCommon";
import { Badge, nowText } from "../ui";

function SummaryTable({ summary }: { summary: StratumSummary }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>样本数</th>
          {METRIC_FIELDS.map((f) => (
            <th key={f.key}>
              {f.label}
              <small>（{f.unit}）</small>
            </th>
          ))}
          <th>
            塑性指数 I<sub>P</sub>
          </th>
          <th>
            液性指数 I<sub>L</sub>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{summary.sampleCount}</td>
          {METRIC_FIELDS.map((f) => (
            <td key={f.key}>{fmt(summary.averages[f.key])}</td>
          ))}
          <td>{fmt(summary.plasticityIndex)}</td>
          <td>
            {summary.liquidityIndex === undefined ? (
              "—"
            ) : (
              <>
                {fmt(summary.liquidityIndex)}{" "}
                <Badge tone="info">{liquidityState(summary.liquidityIndex)}</Badge>
              </>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export default function SummaryPanel({
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
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>同一地层汇总平均值与液性指数，凑齐后负责人编报锁定</p>
          <h2>地层汇总与锁定</h2>
        </div>
      </div>

      {state.boreholes.map((hole) => {
        const layers = state.strata
          .filter((s) => s.boreholeId === hole.id)
          .sort((a, b) => a.topDepth - b.topDepth);
        return (
          <div key={hole.id} className="hole-block">
            <h3 className="hole-title">{hole.code}</h3>
            {layers.length === 0 && (
              <p className="empty-hint">该孔尚未划分地层。</p>
            )}
            {layers.map((layer) => (
              <StratumCard
                key={layer.id}
                state={state}
                stratumId={layer.id}
                role={role}
                operator={operator}
                dispatch={dispatch}
              />
            ))}
          </div>
        );
      })}
    </section>
  );
}

function StratumCard({
  state,
  stratumId,
  role,
  operator,
  dispatch,
}: {
  state: AppState;
  stratumId: string;
  role: Role;
  operator: string;
  dispatch: Dispatch;
}) {
  const layer = state.strata.find((s) => s.id === stratumId)!;
  const records = state.records.filter((r) => r.stratumId === stratumId);
  const versions = state.versions
    .filter((v) => v.stratumId === stratumId)
    .sort((a, b) => b.version - a.version);
  const locked = isLocked(state, stratumId);

  // 当前实时汇总（锁定后仍展示，便于与锁定快照对照）
  const live = summarize(records);
  const missing = METRIC_FIELDS.filter(
    (f) => live.averages[f.key] === undefined,
  ).map((f) => f.label);

  return (
    <article className="stratum-card">
      <header className="stratum-head">
        <div>
          <h4>
            {layer.name}{" "}
            <small>
              {fmt(layer.topDepth)}–{fmt(layer.bottomDepth)} m
            </small>
          </h4>
        </div>
        <div className="stratum-flags">
          {locked ? (
            <Badge tone="ok">已锁定 v{versions[0]?.version}</Badge>
          ) : canLock(live) ? (
            <Badge tone="info">指标已凑齐，待编报</Badge>
          ) : (
            <Badge tone="warn">指标未凑齐</Badge>
          )}
          {!locked && (
            <button
              className="primary-action"
              disabled={!canLock(live) || role !== "负责人"}
              title={
                role !== "负责人"
                  ? "只有负责人能编报锁定"
                  : !canLock(live)
                    ? "指标未凑齐，暂不能锁定"
                    : "编入报告并锁定"
              }
              onClick={() =>
                dispatch({
                  type: "lockStratum",
                  stratumId,
                  operator,
                  now: nowText(),
                })
              }
            >
              编入报告并锁定
            </button>
          )}
        </div>
      </header>

      {records.length === 0 ? (
        <p className="empty-hint">暂无有效试验记录。</p>
      ) : (
        <>
          <SummaryTable summary={live} />
          {!canLock(live) && (
            <p className="missing-hint">
              尚缺指标：{missing.join("、") || "有效记录"}（凑齐后负责人才能锁定）
            </p>
          )}
        </>
      )}

      {records.length > 0 && (
        <details className="record-detail">
          <summary>查看 {records.length} 条原始记录</summary>
          <table className="data-table">
            <thead>
              <tr>
                <th>土样编号</th>
                <th>深度 (m)</th>
                {METRIC_FIELDS.map((f) => (
                  <th key={f.key}>{f.label}</th>
                ))}
                <th>来源</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.sampleNo}</td>
                  <td>{fmt(r.depth)}</td>
                  {METRIC_FIELDS.map((f) => (
                    <td key={f.key}>{fmt(r[f.key])}</td>
                  ))}
                  <td>{r.fromRevisionId ? "修订采纳" : "直接录入"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {versions.length > 0 && (
        <details className="record-detail" open={versions.length > 1}>
          <summary>锁定与汇总版本历史（{versions.length}）</summary>
          <table className="data-table">
            <thead>
              <tr>
                <th>版本</th>
                <th>说明</th>
                <th>样本数</th>
                <th>
                  液性指数 I<sub>L</sub>
                </th>
                <th>操作人</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id}>
                  <td>v{v.version}</td>
                  <td>{v.note}</td>
                  <td>{v.summary.sampleCount}</td>
                  <td>{fmt(v.summary.liquidityIndex)}</td>
                  <td>{v.createdBy}</td>
                  <td>{v.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </article>
  );
}
