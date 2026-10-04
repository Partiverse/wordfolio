// 四选一出题纯逻辑（无 RN / SQLite 依赖，供 vitest 覆盖）。
// 题型：给词头+词性，从 4 个中文释义里选正确的义项。

export interface QuizSense {
  stableId: string;
  headword: string;
  pos: string;
  labelZh: string | null;
  definitionZh: string;
}

export interface QuizOption {
  stableId: string;
  text: string;
}

export interface ChoiceQuestion {
  prompt: QuizSense;
  options: QuizOption[];
}

/** 义项的展示文案：优先中文标签，缺省用释义。 */
export function senseOptionText(sense: Pick<QuizSense, 'labelZh' | 'definitionZh'>): string {
  return sense.labelZh ?? sense.definitionZh;
}

/**
 * 从干扰池抽 n-1 个干扰项组成四选一。
 * 不变量（单测覆盖）：不含正确项、不重复、干扰项与正确项不同词头、
 * 干扰项文本互不相同、选项总数 = min(n, 可用数)。
 */
export function buildChoice(correct: QuizSense, pool: readonly QuizSense[], n = 4): ChoiceQuestion {
  const correctText = senseOptionText(correct);
  const options: QuizOption[] = [{ stableId: correct.stableId, text: correctText }];
  const usedTexts = new Set([correctText]);

  for (const candidate of pool) {
    if (options.length >= n) break;
    if (candidate.stableId === correct.stableId) continue;
    if (candidate.headword === correct.headword) continue;
    const text = senseOptionText(candidate);
    if (usedTexts.has(text)) continue; // 同文选项无意义（无法判定对错）
    usedTexts.add(text);
    options.push({ stableId: candidate.stableId, text });
  }
  return { prompt: correct, options: shuffle(options) };
}

/** Fisher–Yates，不改原数组。 */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 拼写归一（拼写听写判分用）：
 * 小写化 → 去首尾空白 → 合并连续空格 → 去掉撇号/连字符/句点
 * （让 "Mother-In-Law" / "mother in law." / "mothers" 这类常见输入都算对）
 */
export function normalizeSpelling(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[‘’']/g, '')
    .replace(/[-.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 拼写听写判分：空输入算未作答（交给 UI 决定是否阻止提交）。 */
export function isSpellingCorrect(input: string, target: string): boolean {
  const a = normalizeSpelling(input);
  if (a.length === 0) return false;
  return a === normalizeSpelling(target);
}
