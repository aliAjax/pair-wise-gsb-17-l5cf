import { useState } from "react";
import { Role, useStore } from "./store";
import BoreholesPanel from "./panels/BoreholesPanel";
import EntryPanel from "./panels/EntryPanel";
import SuspendedPanel from "./panels/SuspendedPanel";
import SummaryPanel from "./panels/SummaryPanel";
import RevisionsPanel from "./panels/RevisionsPanel";

const ROLES: Role[] = ["录入员", "负责人"];

const ROLE_NAME: Record<Role, string> = {
  录入员: "录入员·小李",
  负责人: "负责人·王工",
};

type TabKey = "boreholes" | "entry" | "suspended" | "summary" | "revisions";

function App() {
  const { state, lastMessage, dispatch } = useStore();
  const [role, setRole] = useState<Role>("录入员");
  const [tab, setTab] = useState<TabKey>("entry");

  const operator = ROLE_NAME[role];
  const pendingRevisions = state.revisions.filter(
    (r) => r.status === "pending",
  ).length;
  const lockedCount = new Set(state.versions.map((v) => v.stratumId)).size;

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: "boreholes", label: "钻孔与地层" },
    { key: "entry", label: "结果录入" },
    { key: "suspended", label: "挂起记录", badge: state.suspended.length },
    { key: "summary", label: "地层汇总与锁定" },
    { key: "revisions", label: "修订处理", badge: pendingRevisions },
  ];

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-03 · 岩土工程试验资料管理</p>
          <h1>土样试验结果落地层平台</h1>
          <p className="subtitle">
            试验结果按钻孔与取样深度自动落入对应地层；液限不高于塑限或深度压在地层分界线上的记录先挂起。
            同一地层指标汇总为平均值与液性指数，凑齐后由负责人编入报告并锁定；锁定后新结果只能另建带原因的修订，原值不被覆盖。
          </p>
        </div>
        <div className="stack-card">
          <span>当前角色</span>
          <div className="role-switch">
            {ROLES.map((r) => (
              <button
                key={r}
                className={r === role ? "primary-action" : ""}
                onClick={() => setRole(r)}
              >
                {ROLE_NAME[r]}
              </button>
            ))}
          </div>
          <span>
            录入员负责结果录入与挂起修正；负责人负责编报锁定与修订处理。
          </span>
        </div>
      </section>

      <section className="metrics-grid">
        <article className="metric-card">
          <span>钻孔 / 地层</span>
          <strong>
            {state.boreholes.length} / {state.strata.length}
          </strong>
          <i className="status-ok" />
        </article>
        <article className="metric-card">
          <span>有效试验记录</span>
          <strong>{state.records.length}</strong>
          <i className="status-ok" />
        </article>
        <article className="metric-card">
          <span>挂起待处理</span>
          <strong>{state.suspended.length}</strong>
          <i className={state.suspended.length ? "status-danger" : "status-ok"} />
        </article>
        <article className="metric-card">
          <span>已锁定地层 / 待处理修订</span>
          <strong>
            {lockedCount} / {pendingRevisions}
          </strong>
          <i className={pendingRevisions ? "status-watch" : "status-ok"} />
        </article>
      </section>

      <nav className="tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "tab active" : "tab"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <em className="tab-badge">{t.badge}</em>
            )}
          </button>
        ))}
      </nav>

      {lastMessage && !lastMessage.startsWith("LOCKED:") && (
        <div className="toast">{lastMessage}</div>
      )}

      {tab === "boreholes" && <BoreholesPanel state={state} dispatch={dispatch} />}
      {tab === "entry" && (
        <EntryPanel state={state} dispatch={dispatch} operator={operator} />
      )}
      {tab === "suspended" && (
        <SuspendedPanel state={state} dispatch={dispatch} operator={operator} />
      )}
      {tab === "summary" && (
        <SummaryPanel state={state} dispatch={dispatch} role={role} operator={operator} />
      )}
      {tab === "revisions" && (
        <RevisionsPanel state={state} dispatch={dispatch} role={role} operator={operator} />
      )}

      <footer className="footer-bar">
        <span>
          数据保存在浏览器本地（localStorage），挂起记录、参数汇总与修订历史刷新后原样保留。
        </span>
        <button onClick={() => dispatch({ type: "resetAll" })}>
          恢复示例数据
        </button>
      </footer>
    </main>
  );
}

export default App;
