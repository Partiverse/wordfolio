// 上游接入判定纯逻辑（E5 接入骨架）：发布物带了哪些上游富集数据 → 对应 UI 槽位是否渲染。
// 数据探测在 db/repository.ts（hasCefrData / hasExampleData）；本文件无 RN / SQLite 依赖，供 vitest 覆盖。
// 语义：v0.1-m1 无 CEFR 标注、无例句，两个判定均 false——UI 与无骨架时完全一致；
// 上游 v0.2 起两类数据就位后槽位自动放开，UI 不需要再改条件。

/** 词库筛选条是否渲染 CEFR chips：仅当发布物确有 CEFR 标注。 */
export function shouldShowCefrFilter(hasCefr: boolean): boolean {
  return hasCefr;
}

/**
 * 学习屏练习族（练习/听音/拼写）chips 区是否渲染「例句挖空」入口：
 * 需要例句数据（挖空的材料）且 CEFR 标注可用（按难度定位挖空词）。
 * 两者都来自上游富集，当前发布物均无 → 恒 false（入口自动隐藏）。
 */
export function shouldShowBlankExercise(hasExample: boolean, hasCefr: boolean): boolean {
  return hasExample && hasCefr;
}
