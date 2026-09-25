// @vitest-environment jsdom
// 冒烟测试：整个 App 在种子数据下能挂载，五个面板都能渲染出关键内容。

import { describe, expect, it, beforeEach } from "vitest";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import App from "./App";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

function render() {
  act(() => {
    root.render(<App />);
  });
}

function clickTab(label: string) {
  const btn = Array.from(container.querySelectorAll(".tabs button")).find(
    (b) => b.textContent?.includes(label),
  ) as HTMLButtonElement;
  act(() => {
    btn.click();
  });
}

describe("App 冒烟", () => {
  it("默认打开结果录入页，展示钻孔选项", () => {
    render();
    expect(container.textContent).toContain("结果录入");
    expect(container.textContent).toContain("ZK1");
  });

  it("挂起记录页点明哪孔哪条记录什么原因", () => {
    render();
    clickTab("挂起记录");
    const text = container.textContent ?? "";
    expect(text).toContain("ZK2 · 土样 ZK2-T5");
    expect(text).toContain("液限不高于塑限");
    expect(text).toContain("ZK1 · 土样 ZK1-T9");
    expect(text).toContain("地层分界线");
  });

  it("地层汇总页展示平均值、液性指数与锁定状态", () => {
    render();
    clickTab("地层汇总");
    const text = container.textContent ?? "";
    expect(text).toContain("液性指数");
    expect(text).toContain("已锁定 v1");
    expect(text).toContain("指标未凑齐"); // ZK1 ③粉砂缺液塑限
    expect(text).toContain("可塑"); // ZK1 ②层 IL≈0.60
  });

  it("修订处理页展示待处理修订及原因", () => {
    render();
    clickTab("修订处理");
    const text = container.textContent ?? "";
    expect(text).toContain("ZK1-T4");
    expect(text).toContain("复测结果补报");
  });

  it("钻孔与地层页展示分层表", () => {
    render();
    clickTab("钻孔与地层");
    const text = container.textContent ?? "";
    expect(text).toContain("②粉质黏土");
    expect(text).toContain("层底埋深");
  });
});
