import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { Grade } from 'ts-fsrs';

import { VolumeIcon, WarnIcon } from '@/components/icons';
import { QuizCard } from '@/components/QuizCard';
import { TtsBanner } from '@/components/TtsHint';
import {
  bulkUpsertReviewCards,
  getDailyGoal,
  getReviewCards,
  logReview,
  setDailyCompleted,
  upsertReviewCard,
} from '@/db/study';
import { getDistractorSenses, getSeedSenseIds, getStudySenses, type StudySense } from '@/db/repository';
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
import { todayKey } from '@/study/stats-core';
import { speakEn, speakZh } from '@/utils/speech';
import { playWordAudio, prefetchWordAudio } from '@/utils/wordAudio';
import { useTheme } from '@/theme/tokens';

const DEFAULT_TARGET = 20;
const SEED_BATCH = 20;

export default function StudyScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const router = useRouter();

  const [queue, setQueue] = useState<StoredCard[]>([]);
  const [senses, setSenses] = useState<Map<string, StudySense>>(new Map());
  const [revealed, setRevealed] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'flip' | 'choice' | 'listen' | 'spell'>('flip');
  const [distractors, setDistractors] = useState<StudySense[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const now = new Date();
        const day = todayKey(now);
        const goal = await getDailyGoal(day);
        const stored = await getReviewCards();
        const dueCount = stored.filter((c) => isDue(c, now)).length;

        let all = stored;
        if (dueCount < goal.target) {
          const existing = new Set(stored.map((c) => c.stableId));
          const candidates = (await getSeedSenseIds(goal.target * 4)).filter((id) => !existing.has(id));
          const need = Math.max(goal.target - dueCount, SEED_BATCH);
          const fresh = candidates.slice(0, need).map((id) => newCard(id, now));
          if (fresh.length) {
            await bulkUpsertReviewCards(fresh);
            all = [...stored, ...fresh];
          }
        }
        const todayQueue = buildTodayQueue(all, goal.target, now);
        const content = await getStudySenses(todayQueue.map((c) => c.stableId));
        if (!alive) return;
        setTarget(goal.target);
        setCompleted(goal.completed);
        setQueue(spreadByHeadword(todayQueue, (c) => content.get(c.stableId)?.headword ?? c.stableId));
        setSenses(content);
        // 批量预取：把整队前 10 个词头的音频 URL 提前拉好（错过的卡片点开即响）
        for (const c of todayQueue.slice(0, 10)) {
          const w = content.get(c.stableId)?.headword;
          if (w) prefetchWordAudio(w);
        }
      } catch (e) {
        if (alive) setError(String(e));
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const current = queue[0];
  const sense = current ? senses.get(current.stableId) : undefined;
  const progress = useMemo(() => queueProgress(completed, target), [completed, target]);

  // 当前卡亮出即预取真人发音（URL 缓存），点喇叭时几乎零等待
  const headword = sense?.headword;
  useEffect(() => {
    if (headword) prefetchWordAudio(headword);
  }, [headword]);

  // 练习/听音模式：为当前卡取同词性干扰项
  const currentPos = sense?.pos ?? null;
  const currentStableId = current?.stableId ?? null;
  const quizMode = mode !== 'flip';
  useEffect(() => {
    if (!quizMode || !currentPos || !currentStableId) return;
    let alive = true;
    getDistractorSenses(currentPos, currentStableId, 9)
      .then((rows) => alive && setDistractors(rows))
      .catch(() => alive && setDistractors([]));
    return () => {
      alive = false;
    };
  }, [quizMode, currentPos, currentStableId]);

  const rate = useCallback(
    async (grade: Grade) => {
      if (!current || busy) return;
      setBusy(true);
      try {
        const now = new Date();
        const next = gradeCard(current, grade, now);
        await upsertReviewCard(next);
        await logReview(current.stableId, grade, next.due);
        const nextCompleted = completed + 1;
        await setDailyCompleted(todayKey(now), nextCompleted, target);
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

  const answerQuiz = useCallback(
    (correct: boolean) => {
      void rate(correct ? 3 : 1);
    },
    [rate],
  );

  if (!ready) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const finished = queue.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.modeRow}>
            <Text style={styles.h1}>学习</Text>
            <Pressable
              style={[styles.modeChip, mode === 'flip' && styles.modeChipActive]}
              onPress={() => setMode('flip')}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'flip' }}
            >
              <Text style={[styles.modeChipText, mode === 'flip' && styles.modeChipTextActive]}>卡片</Text>
            </Pressable>
            <Pressable
              style={[styles.modeChip, mode === 'choice' && styles.modeChipActive]}
              onPress={() => setMode('choice')}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'choice' }}
            >
              <Text style={[styles.modeChipText, mode === 'choice' && styles.modeChipTextActive]}>练习</Text>
            </Pressable>
            <Pressable
              style={[styles.modeChip, mode === 'listen' && styles.modeChipActive]}
              onPress={() => setMode('listen')}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'listen' }}
            >
              <Text style={[styles.modeChipText, mode === 'listen' && styles.modeChipTextActive]}>听音</Text>
            </Pressable>
            <Pressable
              style={[styles.modeChip, mode === 'spell' && styles.modeChipActive]}
              onPress={() => setMode('spell')}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'spell' }}
            >
              <Text style={[styles.modeChipText, mode === 'spell' && styles.modeChipTextActive]}>拼写</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => router.push('/wrong')}
            style={styles.wrongBtn}
            accessibilityRole="button"
            accessibilityLabel="打开错题本"
          >
            <WarnIcon color={t.textSecondary} size={15} />
            <Text style={styles.wrongBtnText}>错题本</Text>
          </Pressable>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={styles.progressText}>
          今日 {completed}/{target} · 剩 {queue.length}
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {finished ? (
        completed > 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.doneTitle}>今天完成了</Text>
            <Text style={styles.doneSub}>已复习 {completed} 个义项。明天再来，记忆曲线会安排下次出现时间。</Text>
          </View>
        ) : (
          <View style={styles.centerBox}>
            <Text style={styles.doneTitle}>今天没有到期的任务</Text>
            <Text style={styles.doneSub}>已学的词还没到下次复习时间。可以去「词库」逛逛，或明天再来。</Text>
          </View>
        )
      ) : !sense ? (
        <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} />
      ) : quizMode ? (
        <ScrollView contentContainerStyle={styles.cardArea}>
          <QuizCard
            key={sense.stableId}
            sense={sense}
            pool={distractors}
            onAnswer={answerQuiz}
            busy={busy}
            variant={mode === 'spell' ? 'spell' : mode === 'listen' ? 'listen' : 'meaning'}
          />
          <TtsBanner />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.cardArea}>
          <Pressable style={styles.card} onPress={() => setRevealed(true)} accessibilityRole="button">
            <View style={styles.cardTop}>
              <Text style={styles.pos}>{sense.pos}</Text>
              <Text style={styles.reps}>复习 {current.reps} 次</Text>
            </View>

            <Pressable
              onPress={() => void playWordAudio(sense.headword)}
              style={styles.headRow}
              hitSlop={8}
              accessibilityLabel="播放词头发音"
            >
              <Text style={styles.headword}>{sense.headword}</Text>
              <VolumeIcon color={t.textMuted} size={20} />
            </Pressable>

            {revealed ? (
              <View style={styles.reveal}>
                {sense.labelZh ? <Text style={styles.labelZh}>{sense.labelZh}</Text> : null}
                <Pressable
                  onPress={() => speakEn(sense.definitionEn)}
                  style={styles.lineRow}
                  hitSlop={6}
                  accessibilityLabel="朗读英文释义"
                >
                  <Text style={styles.defEn}>{sense.definitionEn}</Text>
                  <VolumeIcon color={t.textMuted} size={14} />
                </Pressable>
                <Pressable
                  onPress={() => speakZh(sense.definitionZh)}
                  style={styles.lineRow}
                  hitSlop={6}
                  accessibilityLabel="朗读中文释义"
                >
                  <Text style={styles.defZh}>{sense.definitionZh}</Text>
                  <VolumeIcon color={t.textMuted} size={14} />
                </Pressable>
                {sense.exampleEn ? (
                  <View style={styles.example}>
                    <Pressable
                      onPress={() => speakEn(sense.exampleEn ?? '')}
                      style={styles.lineRow}
                      hitSlop={6}
                    >
                      <Text style={styles.exEn}>{sense.exampleEn}</Text>
                      <VolumeIcon color={t.textMuted} size={14} />
                    </Pressable>
                    {sense.exampleZh ? (
                      <Pressable
                        onPress={() => speakZh(sense.exampleZh ?? '')}
                        style={styles.lineRow}
                        hitSlop={6}
                      >
                        <Text style={styles.exZh}>{sense.exampleZh}</Text>
                        <VolumeIcon color={t.textMuted} size={14} />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : (
              <Text style={styles.tapHint}>轻点卡片显示释义</Text>
            )}
          </Pressable>

          <TtsBanner />
        </ScrollView>
      )}

      {!finished && sense && mode === 'flip' ? (
        <View style={styles.gradeRow}>
          {revealed
            ? GRADES.map((g) => (
                <Pressable
                  key={g}
                  style={[styles.gradeBtn, g === 3 && styles.gradeBtnPrimary]}
                  onPress={() => rate(g)}
                  disabled={busy}
                  accessibilityRole="button"
                >
                  <Text style={[styles.gradeText, g === 3 && styles.gradeTextPrimary]}>
                    {GRADE_LABELS[g]}
                  </Text>
                </Pressable>
              ))
            : null}
        </View>
      ) : null}

      {!finished && sense && mode === 'flip' && !revealed ? (
        <Pressable style={[styles.revealBtn]} onPress={() => setRevealed(true)} accessibilityRole="button">
          <Text style={styles.revealBtnText}>显示释义</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bgCanvas, paddingHorizontal: 16, paddingBottom: 12 },
    header: { paddingTop: 8, gap: 8, paddingBottom: 4 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    wrongBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      backgroundColor: t.bgSurface,
    },
    wrongBtnText: { color: t.textSecondary, fontSize: 13, fontWeight: '600' },
    modeRow: { flexDirection: 'row', alignItems: 'center' },
    modeChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      backgroundColor: t.bgSurface,
      marginLeft: 6,
    },
    modeChipActive: { backgroundColor: t.bgSurfaceElevated, borderColor: t.borderStrong },
    modeChipText: { color: t.textMuted, fontSize: 12, fontWeight: '700' },
    modeChipTextActive: { color: t.textPrimary },
    h1: { fontSize: 26, fontWeight: '800', color: t.textPrimary },
    progressTrack: {
      height: 6,
      borderRadius: 999,
      backgroundColor: t.bgSurfaceElevated,
      overflow: 'hidden',
    },
    progressFill: { height: 6, backgroundColor: t.accentSuccess },
    progressText: { color: t.textMuted, fontSize: 12 },
    cardArea: { paddingTop: 12, gap: 12 },
    card: {
      backgroundColor: t.bgSurface,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderSubtle,
      padding: 20,
      gap: 12,
      minHeight: 240,
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
    reps: { color: t.textMuted, fontSize: 12 },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headword: { color: t.textPrimary, fontSize: 34, fontWeight: '800' },
    tapHint: { color: t.textMuted, fontSize: 13, marginTop: 8 },
    reveal: { gap: 10, marginTop: 6 },
    labelZh: { color: t.textPrimary, fontSize: 20, fontWeight: '700' },
    lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    defEn: { color: t.textSecondary, fontSize: 14, lineHeight: 20, flex: 1 },
    defZh: { color: t.textPrimary, fontSize: 16, lineHeight: 22, flex: 1 },
    example: { borderLeftWidth: 2, borderColor: t.borderStrong, paddingLeft: 10, gap: 4, marginTop: 2 },
    exEn: { color: t.textSecondary, fontSize: 13, lineHeight: 19, flex: 1 },
    exZh: { color: t.textMuted, fontSize: 12, lineHeight: 18, flex: 1 },
    gradeRow: { flexDirection: 'row', gap: 8, paddingTop: 12 },
    gradeBtn: {
      flex: 1,
      minHeight: 48,
      backgroundColor: t.bgSurface,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gradeBtnPrimary: { backgroundColor: t.primary, borderColor: t.primary },
    gradeText: { color: t.textPrimary, fontWeight: '700', fontSize: 15 },
    gradeTextPrimary: { color: t.primaryForeground },
    revealBtn: {
      marginTop: 12,
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: t.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    revealBtnText: { color: t.primaryForeground, fontWeight: '700', fontSize: 15 },
    centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 60 },
    doneTitle: { color: t.textPrimary, fontSize: 20, fontWeight: '800' },
    doneSub: { color: t.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
    error: { color: t.destructive, fontSize: 12, paddingVertical: 4 },
  });
}
