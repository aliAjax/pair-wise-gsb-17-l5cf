// 面板共享类型：避免每个面板重复从 store 引入

import { Action, AppState } from "../store";

export type Dispatch = (action: Action) => void;
export type { AppState };
export { boreholeOf, holeCode, isLocked, stratumOf } from "../store";
