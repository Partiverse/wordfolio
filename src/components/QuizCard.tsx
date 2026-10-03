import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { buildChoice, type ChoiceQuestion, type QuizSense } from '@/study/quiz-core';
import { useTheme } from '@/theme/tokens';

// 练习卡（义项四选一）：给词头+词性，选正确的中文释义。
// 答对自动以 Good 计分，答错展示正确项并以 Again 计分（由父层 grade 回调落地）。
export function QuizCard({
  sense,
  pool,
  onAnswer,
  busy,
}: {
  sense: QuizSense;
  pool: readonly QuizSense[];
  onAnswer: (correct: boolean) => void;
  busy: boolean;
}) {
  const t = useTheme();
  const styles = makeStyles(t);

  const question = useMemo<ChoiceQuestion>(() => buildChoice(sense, pool, 4), [sense, pool]);
  // 选择态随卡片换而重置：父层用 key={sense.stableId} 重挂载本组件
  const [picked, setPicked] = useState<string | null>(null);

  const answered = picked !== null;

  const pick = (stableId: string) => {
    if (answered || busy) return;
    setPicked(stableId);
    // 计分延时给出结果反馈窗口：对=600ms，错=1.4s（看清正确答案）
    const correct = stableId === sense.stableId;
    setTimeout(() => onAnswer(correct), correct ? 600 : 1400);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.pos}>{sense.pos}</Text>
        <Text style={styles.mode}>选择正确释义</Text>
      </View>
      <Text style={styles.headword}>{sense.headword}</Text>

      <View style={styles.options}>
        {question.options.map((opt) => {
          const isCorrect = opt.stableId === sense.stableId;
          const isPicked = opt.stableId === picked;
          const state: 'idle' | 'right' | 'wrong' | 'reveal' = answered
            ? isCorrect
              ? 'right'
              : isPicked
                ? 'wrong'
                : 'reveal'
            : 'idle';
          return (
            <Pressable
              key={opt.stableId}
              onPress={() => pick(opt.stableId)}
              disabled={answered || busy}
              style={[styles.option, state === 'right' && styles.optionRight, state === 'wrong' && styles.optionWrong, state === 'reveal' && styles.optionReveal]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.optionText,
                  state === 'right' && styles.optionTextRight,
                  state === 'wrong' && styles.optionTextWrong,
                ]}
              >
                {opt.text}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {answered ? (
        <Text style={[styles.verdict, picked === sense.stableId ? styles.verdictOk : styles.verdictNo]}>
          {picked === sense.stableId ? '答对了' : '答错了——正确释义已高亮'}
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: {
      backgroundColor: t.bgSurface,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderSubtle,
      padding: 20,
      gap: 14,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    pos: {
      color: t.textSecondary,
      backgroundColor: t.bgSurfaceElevated,
      fontSize: 11,
      fontWeight: '700',
      borderRadius: 5,
      overflow: 'hidden',
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    mode: { color: t.textMuted, fontSize: 12 },
    headword: { color: t.textPrimary, fontSize: 34, fontWeight: '800' },
    options: { gap: 8 },
    option: {
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderStrong,
      backgroundColor: t.bgCanvas,
    },
    optionRight: { backgroundColor: t.accentSuccess, borderColor: t.accentSuccess },
    optionWrong: { backgroundColor: t.destructive, borderColor: t.destructive },
    optionReveal: { opacity: 0.55 },
    optionText: { color: t.textPrimary, fontSize: 15, lineHeight: 21 },
    optionTextRight: { color: '#ffffff', fontWeight: '700' },
    optionTextWrong: { color: '#ffffff', fontWeight: '700' },
    verdict: { fontSize: 13, fontWeight: '600' },
    verdictOk: { color: t.accentSuccess },
    verdictNo: { color: t.destructive },
  });
}
