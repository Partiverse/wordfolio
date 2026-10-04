// 学习模式记忆纯逻辑：四种模式取值的解析与校验（无 RN / SQLite 依赖，供 vitest 覆盖）。
// 持久化由学习屏经 db/study.ts 的 settings 表完成（key='studyMode'，值为模式字符串本身）。

export const STUDY_MODES = ['flip', 'choice', 'listen', 'spell'] as const;

export type StudyMode = (typeof STUDY_MODES)[number];

/** 恢复上次模式：settings 读出的任意值 → 合法模式；缺失/无效（含大小写不符）回退 'flip'（卡片）。 */
export function parseStudyMode(value: string | null | undefined): StudyMode {
  if (value && (STUDY_MODES as readonly string[]).includes(value)) {
    return value as StudyMode;
  }
  return 'flip';
}
