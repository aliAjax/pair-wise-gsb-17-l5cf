import { useMemo, useState } from "react";
import "./styles.css";
import { BOREHOLES } from "./lib/domain";
import type { Averages, Role, SampleRecord } from "./lib/types";
import { useGeotechStore } from "./lib/store";
import type { RecordDraft } from "./lib/store";
import { EntryForm } from "./components/EntryForm";
import { SuspendedList } from "./components/SuspendedList";
import { StratumCard } from "./components/StratumCard";
import { RecordsTable } from "./components/RecordsTable";

function App() {
  const {
    records,
    locks,
    addRecord,
    reviseSuspended,
    lockStratum,
    reviseStratum,
    pendingSamples,
    resetAll,
  } = useGeotechStore();

  const [role, setRole] = useState<Role>("manager");
  const [operator, setOperator] = useState("张工（项目负责人）");
  const [activeHole, setActiveHole] = useState(BOREHOLES[0].id);
  const [editingId, setEditingId] = useState<string | null>(null);

  const suspended = useMemo(
    () => records.filter((r) => r.status === "suspended"),
    [records]
  );
  const accepted = useMemo(
    () => records.filter((r) => r.status === "accepted"),
    [records]
  );
  const lockedCount = Object.values(locks).filter(
    (l) => l.versions.length > 0
  ).length;
  const pendingRevisions = BOREHOLES.flatMap((h) =>
    h.strata.map((s) => pendingSamples(s.id).length)
  ).reduce((a, b) => a + b, 0);

  const editing = records.find((r) => r.id === editingId) ?? null;

  const hole = BOREHOLES.find((b) => b.id === activeHole)!;
  const holeRecords = (stratumId: string) =>
    accepted.filter((r) => r.stratumId === stratumId);

  const stats = [
    { label: "管理钻孔", value: String(BOREHOLES.length), sub: "固定分层档案", cls: "status-ok" },
    { label: "有效土样", value: String(accepted.length), sub: "已按孔/深度落层", cls: "status-ok" },
    { label: "挂起记录", value: String(suspended.length), sub: suspended.length ? "需处理后重校" : "全部校验通过", cls: suspended.length ? "status-danger" : "status-ok" },
    { label: "已锁定地层", value: String(lockedCount), sub: pendingRevisions ? `${pendingRevisions} 件新结果待修订` : "无待办修订", cls: pendingRevisions ? "status-watch" : "status-ok" },
  ];

  const handleSubmit = (draft: RecordDraft): SampleRecord => {
    if (editing) {
      const updated = reviseSuspended(editing.id, draft);
      setEditingId(null);
      return updated;
    }
    return addRecord(draft);
  };

  const handleLock =
    (stratumId: string) =>
    (sampleIds: string[], avg: Averages) => {
      lockStratum(stratumId, sampleIds, avg, operator);
    };

  const handleRevise =
    (stratumId: string) =>
    (reason: string, sampleIds: string[], avg: Averages) => {
      reviseStratum(stratumId, reason, sampleIds, avg, operator);
    };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-03 · 试验成果归层工作流</p>
          <h1>岩土钻孔土样试验成果归层与报告锁定</h1>
          <p className="subtitle">
            试验结果按孔和深度落到对应地层；液限不高于塑限或深度压在分界线上先挂起并点明孔号与记录；
            同一地层汇总平均值与液性指数，指标凑齐后负责人编入报告并锁定，锁定后新结果只能另建带原因修订，不覆盖原值。
          </p>
        </div>
        <div className="stack-card">
          <span>当前角色（权限切换）</span>
          <div className="role-switch">
            <button
              className={role === "manager" ? "on manager" : ""}
              onClick={() => {
                setRole("manager");
                setOperator("张工（项目负责人）");
              }}
            >
              项目负责人
            </button>
            <button
              className={role === "recorder" ? "on recorder" : ""}
              onClick={() => {
                setRole("recorder");
                setOperator("李工（现场编录员）");
              }}
            >
              编录员
            </button>
          </div>
          <label className="operator-line">
            <span>操作人</span>
            <input value={operator} onChange={(e) => setOperator(e.target.value)} />
          </label>
          <p className="role-note">
            {role === "manager"
              ? "负责人可锁定地层、发起带原因修订。"
              : "编录员可录入/处理挂起记录，但不能锁定或修订报告。"}
          </p>
        </div>
      </section>

      <section className="metrics-grid">
        {stats.map((s) => (
          <article key={s.label} className="metric-card">
            <span>{s.label}</span>
            <strong>{s.value}</strong>
            <small className="metric-sub">{s.sub}</small>
            <i className={s.cls} />
          </article>
        ))}
      </section>

      <section className="panel entry-panel">
        <div className="section-heading">
          <div>
            <p>试验结果录入</p>
            <h2>{editing ? "处理挂起记录" : "新增土样试验记录"}</h2>
          </div>
          <span className="hint">
            8 项：编号、深度、含水量、密度、液限、塑限、内摩擦角、黏聚力
          </span>
        </div>
        <EntryForm
          key={editing?.id ?? "new"}
          existingNos={records.map((r) => r.sampleNo)}
          editing={editing}
          onSubmit={handleSubmit}
          onCancelEdit={() => setEditingId(null)}
        />
      </section>

      <SuspendedList
        records={suspended}
        editingId={editingId}
        onEdit={(r) => {
          setEditingId(r.id);
          setActiveHole(r.holeId);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onCancelEdit={() => setEditingId(null)}
      />

      <section className="workspace">
        <aside className="panel narrow">
          <h2>钻孔 / 地层</h2>
          <div className="hole-nav">
            {BOREHOLES.map((b) => (
              <button
                key={b.id}
                className={`hole-btn ${b.id === activeHole ? "active" : ""}`}
                onClick={() => setActiveHole(b.id)}
              >
                <strong>{b.name}</strong>
                <span>孔深 {b.totalDepth}m · {b.strata.length} 层</span>
                <span className="hole-dots">
                  {b.strata.map((s) => {
                    const n = holeRecords(s.id).length;
                    const locked = (locks[s.id]?.versions.length ?? 0) > 0;
                    return (
                      <i
                        key={s.id}
                        className={locked ? "dot locked" : n ? "dot filled" : "dot"}
                        title={`${s.code}${s.name}：${n} 件${locked ? " · 已锁定" : ""}`}
                      />
                    );
                  })}
                </span>
              </button>
            ))}
          </div>
          <h2>工作规则</h2>
          <ul className="rule-list">
            <li>wL ≤ wP：挂起（塑性指数无效，IL 无法计算）</li>
            <li>深度压在地层分界线：挂起（归属有歧义）</li>
            <li>每层 6 项指标凑齐且 IL 可算，负责人才能锁定</li>
            <li>锁定后新结果只能另建带原因修订，原值保留</li>
          </ul>
          <button className="reset-btn" onClick={resetAll}>
            恢复示例数据
          </button>
        </aside>

        <section className="strata-col">
          <div className="section-heading">
            <div>
              <p>{hole.name} 参数汇总</p>
              <h2>地层指标、锁定与修订</h2>
            </div>
          </div>
          {hole.strata.map((s) => (
            <StratumCard
              key={s.id}
              hole={hole}
              stratum={s}
              records={holeRecords(s.id)}
              pending={pendingSamples(s.id)}
              lock={locks[s.id]}
              isManager={role === "manager"}
              onLock={handleLock(s.id)}
              onRevise={handleRevise(s.id)}
            />
          ))}
        </section>
      </section>

      <RecordsTable records={accepted} locks={locks} />
    </main>
  );
}

export default App;
