// 共享展示组件与格式化工具

import { ReactNode } from "react";
import { fmt, METRIC_FIELDS, SampleMetrics } from "./domain";

export function nowText(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function Badge({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "danger" | "muted" | "info";
  children: ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/** 一条记录/修订的六项指标小表 */
export function MetricsLine({ metrics }: { metrics: SampleMetrics }) {
  return (
    <div className="metrics-line">
      {METRIC_FIELDS.map((f) => (
        <span key={f.key} className="metric-chip">
          <em>{f.label}</em>
          <b>
            {fmt(metrics[f.key])}
            {metrics[f.key] !== undefined ? ` ${f.unit}` : ""}
          </b>
        </span>
      ))}
    </div>
  );
}

/** 解析数值输入：空串 → undefined；非法 → NaN（由调用方拦截） */
export function parseNum(raw: string): number | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  return Number(t);
}
