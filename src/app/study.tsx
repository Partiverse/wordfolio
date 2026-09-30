import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { Grade } from 'ts-fsrs';

import {
  bulkUpsertReviewCards,
  getDailyGoal,
  getReviewCards,
  setDailyCompleted,
  upsertReviewCard,
} from '@/db/study';
import { getSeedSenseIds, getStudySenses, type StudySense } from '@/db/repository';
import { spreadByHeadword } from '@/study/queue';
import {
  buildTodayQueue,
  GRADE_LABELS,
  GRADES,
  gradeCard,
  isDue,
  newCard,
  queueProgress,
  type StoredCard,
} from '@/study/fsrs-core';
import { speakEn, speakZh } from '@/utils/speech';
import { useTheme } from '@/theme/tokens';

const DEFAULT_TARGET = 20;
const SEED_BATCH = 20; // 词库耗尽后每次补充的新卡数量

function todayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export default function StudyScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const router = useRouter();

  const [cards, setCards] = useState<StoredCard[] | null>(null);
  const [queue, setQueue] = useState<StoredCard[]>([]);
  const [senses, setSenses] = useState<Map<string, StudySense>>(new Map());
  const [revealed, setRevealed] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 加载：读取学习库卡片 → 不足目标则补新卡 → 组队列 → 取义项内容
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const now = new Date();
        const day = todayKey(now);
        const goal = await getDailyGoal(day);
        const stored = await getReviewCards();
        const dueCount = stored.filter((c) => isDue(c, now)).length;
        if (!alive) return;
        setTarget(goal.target);
        setCompleted(goal.completed);

        let all = stored;
        if (dueCount < goal.target) {
          // 补新卡：按词频取尚未建卡的义项
          const existing = new Set(stored.map((c) => c.stableId));
          const candidates = (await getSeedSenseIds(goal.target * 4)).filter((id) => !existing.has(id));
          const need = goal.target - dueCount;
          const fresh = candidates.slice(0, Math.max(need, SEED_BATCH)).map((id) => newCard(id, now));
          if (fresh.length) {
            await bulkUpsertReviewCards(fresh);
            all = [...stored, ...fresh];
          }
        }
        const todayQueue = buildTodayQueue(all, goal.target, now);
        const content = await getStudySenses(todayQueue.map((c) => c.stableId));
        if (!alive) return;
        // 同词不同义项打散：避免连排同一词头
        const spread = spreadByHeadword(todayQueue, (c) => content.get(c.stableId)?.headword ?? c.stableId);
        setCards(all);
        setQueue(spread);
        setSenses(content);
      } catch (e) {
        if (alive) setError(String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const current = queue[0];
  const sense = current ? senses.get(current.stableId) : undefined;
  const progress = useMemo(() => queueProgress(completed, target), [completed, target]);

  const rate = useCallback(
    async (grade: Grade) => {
      if (!current || busy) return;
      setBusy(true);
      try {
        const now = new Date();
        const next = gradeCard(current, grade, now);
        await upsertReviewCard(next);
        const nextCompleted = completed + 1;
        await setDailyCompleted(todayKey(now), nextCompleted, target);
        setCards((prev) => (prev ?? []).map((c) => (c.stableId === next.stableId ? next : c)));
        setQueue((prev) => prev.slice(1));
        setCompleted(nextCompleted);
        setRevealed(false);
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    },
    [current, busy, completed, target],
  );

  if (error && !cards) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.error}>{error}</Text>
      </SafeAreaView>
    );
  }

  if (cards === null) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const finished = queue.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>← 返回</Text>
        </Pressable>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={styles.progressText}>
          今日 {completed}/{target}（剩余 {queue.length}）
        </Text>
      </View>

      {finished ? (
        <View style={styles.centerBox}>
          <Text style={styles.doneTitle}>今日任务完成 🎉</Text>
          <Text style={styles.doneSub}>
            已复习 {completed} 个义项。明天再来，FSRS 会按记忆曲线安排。
          </Text>
        </View>
      ) : !sense ? (
        <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.cardArea}>
          <Pressable style={styles.card} onPress={() => setRevealed(true)}>
            <View style={styles.cardTop}>
              <Text style={styles.pos}>{sense.pos}</Text>
              <Text style={styles.reps}>已复习 {current.reps} 次</Text>
            </View>

            <Pressable onPress={() => speakEn(sense.headword)} hitSlop={8}>
              <Text style={styles.headword}>{sense.headword}</Text>
            </Pressable>

            {revealed ? (
              <View style={styles.reveal}>
                {sense.labelZh ? <Text style={styles.labelZh}>{sense.labelZh}</Text> : null}
                <Pressable onPress={() => speakEn(sense.definitionEn)} hitSlop={6}>
                  <Text style={styles.defEn}>{sense.definitionEn}</Text>
                </Pressable>
                <Pressable onPress={() => speakZh(sense.definitionZh)} hitSlop={6}>
                  <Text style={styles.defZh}>{sense.definitionZh}</Text>
                </Pressable>
                {sense.exampleEn ? (
                  <View style={styles.example}>
                    <Pressable onPress={() => speakEn(sense.exampleEn ?? '')} hitSlop={6}>
                      <Text style={styles.exEn}>{sense.exampleEn}</Text>
                    </Pressable>
                    {sense.exampleZh ? (
                      <Pressable onPress={() => speakZh(sense.exampleZh ?? '')} hitSlop={6}>
                        <Text style={styles.exZh}>{sense.exampleZh}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : (
              <Text style={styles.tapHint}>轻点卡片显示释义</Text>
            )}
          </Pressable>
        </ScrollView>
      )}

      {!finished && sense ? (
        <View style={styles.gradeRow}>
          {revealed ? (
            GRADES.map((g) => (
              <Pressable
                key={g}
                style={[styles.gradeBtn, g === 3 && styles.gradeBtnPrimary]}
                onPress={() => rate(g)}
                disabled={busy}
              >
                <Text style={[styles.gradeText, g === 3 && styles.gradeTextPrimary]}>
                  {GRADE_LABELS[g]}
                </Text>
              </Pressable>
            ))
          ) : (
            <Pressable style={[styles.gradeBtn, styles.gradeBtnPrimary, styles.revealBtn]} onPress={() => setRevealed(true)}>
              <Text style={[styles.gradeText, styles.gradeTextPrimary]}>显示释义</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background, paddingHorizontal: 16 },
    header: { paddingTop: 8, gap: 8 },
    back: { color: t.accentPrimary, fontSize: 15, fontWeight: '600', paddingVertical: 4 },
    progressTrack: {
      height: 6,
      borderRadius: 999,
      backgroundColor: t.muted,
      overflow: 'hidden',
      marginTop: 4,
    },
    progressFill: { height: 6, backgroundColor: t.accentSuccess },
    progressText: { color: t.mutedForeground, fontSize: 12 },
    cardArea: { paddingTop: 16, paddingBottom: 8 },
    card: {
      backgroundColor: t.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      padding: 20,
      gap: 12,
      minHeight: 220,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    pos: {
      color: t.primaryForeground,
      backgroundColor: t.primary,
      fontSize: 11,
      fontWeight: '700',
      borderRadius: 6,
      overflow: 'hidden',
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    reps: { color: t.textMuted, fontSize: 12 },
    headword: { color: t.foreground, fontSize: 34, fontWeight: '800' },
    tapHint: { color: t.textMuted, fontSize: 13, marginTop: 8 },
    reveal: { gap: 10, marginTop: 6 },
    labelZh: { color: t.foreground, fontSize: 20, fontWeight: '700' },
    defEn: { color: t.textSecondary, fontSize: 14, lineHeight: 20 },
    defZh: { color: t.foreground, fontSize: 16, lineHeight: 22 },
    example: { borderLeftWidth: 2, borderColor: t.borderStrong, paddingLeft: 10, gap: 2 },
    exEn: { color: t.textSecondary, fontSize: 13, lineHeight: 19 },
    exZh: { color: t.textMuted, fontSize: 12, lineHeight: 18 },
    gradeRow: { flexDirection: 'row', gap: 8, paddingBottom: 16, paddingTop: 8 },
    gradeBtn: {
      flex: 1,
      backgroundColor: t.card,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      paddingVertical: 14,
      alignItems: 'center',
    },
    gradeBtnPrimary: { backgroundColor: t.primary, borderColor: t.primary },
    revealBtn: { flex: 1 },
    gradeText: { color: t.foreground, fontWeight: '700', fontSize: 15 },
    gradeTextPrimary: { color: t.primaryForeground },
    centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 60 },
    doneTitle: { color: t.foreground, fontSize: 20, fontWeight: '800' },
    doneSub: { color: t.mutedForeground, fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
    error: { color: t.destructive, fontSize: 14, marginTop: 24 },
  });
}
