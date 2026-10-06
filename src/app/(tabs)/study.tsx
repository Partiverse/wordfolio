import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { State, type Grade } from 'ts-fsrs';

import { VolumeIcon, WarnIcon } from '@/components/icons';
import { PlayToast } from '@/components/PlayToast';
import { QuizCard } from '@/components/QuizCard';
import { TtsBanner } from '@/components/TtsHint';
import {
  bulkUpsertReviewCards,
  getDailyGoal,
  getFavoriteEntryIds,
  getReviewCards,
  getSetting,
  logReview,
  setDailyCompleted,
  setSetting,
  upsertReviewCard,
} from '@/db/study';
import {
  getCefrScopeStableIds,
  getDistractorSenses,
  getExamScopeStableIds,
  getSeedCandidates,
  getSeedCandidatesForEntries,
  getStableIdsForEntries,
  getStudySenses,
  hasCefrData,
  hasExampleData,
  type StudySense,
} from '@/db/repository';
import {
  NEW_CARD_ORDER_KEY,
  orderNewCards,
  parseNewCardOrder,
  type NewCardCandidate,
} from '@/study/order-core';
import { filterPracticeScope, pickPracticeRound, retryWrong, spreadByHeadword } from '@/study/queue';
import { parseStudyMode, type StudyMode } from '@/study/mode-core';
import {
  PRACTICE_CEFR_KEY,
  PRACTICE_CEFR_LEVELS,
  PRACTICE_SCOPE_KEY,
  PRACTICE_SCOPE_LABELS,
  PRACTICE_SCOPES,
  parsePracticeCefr,
  parsePracticeScope,
  type PracticeCefr,
  type PracticeScope,
} from '@/study/scope-core';
import { shouldShowBlankExercise } from '@/study/upstream-core';
import {
  buildTodayQueue,
  gradeCard,
  newCard,
  queueProgress,
  type StoredCard,
} from '@/study/fsrs-core';
import {
  gradesForMode,
  parseRatingMode,
  PRIMARY_GRADE,
  RATING_LABELS,
  RATING_MODE_KEY,
  type RatingMode,
} from '@/study/rating-core';
import { todayKey } from '@/study/stats-core';
import { speakEn, speakZh } from '@/utils/speech';
import { playWordAudio, prefetchWordAudio } from '@/utils/wordAudio';
import { useTheme } from '@/theme/tokens';

const DEFAULT_TARGET = 20;
const DEFAULT_NEW_TARGET = 5; // 与 src/db/study.ts 的 DEFAULT_NEW_TARGET 一致（首日无记录时）
const SEED_BATCH = 20;
// 自由练习每轮题量（原组件内常量，I1 起范围重建 effect 也引用，上移模块级）
const PRACTICE_ROUND = 10;
// 学习模式记忆（settings 表 key='studyMode'，E3）：切模式即写入，聚焦重建时恢复
const STUDY_MODE_KEY = 'studyMode';
// 评分模式（settings 表 key='ratingMode'，F1）：默认三档自评；统计页开「专家模式」后翻卡四键
// 键序与 FSRS 映射见 src/study/rating-core.ts（认识→Good、简单→Easy、模糊→Hard、忘记→Again）

// I1 练习范围：四段选择（segChip 风格同源 history.tsx），档位文案与解析在 scope-core
const PRACTICE_SCOPE_OPTIONS = PRACTICE_SCOPES.map((value) => ({
  value,
  label: PRACTICE_SCOPE_LABELS[value],
}));

export default function StudyScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const router = useRouter();

  const [queue, setQueue] = useState<StoredCard[]>([]);
  const [senses, setSenses] = useState<Map<string, StudySense>>(new Map());
  const [revealed, setRevealed] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [target, setTarget] = useState(DEFAULT_TARGET);
  // F5 双目标：新学进度独立于复习进度（daily_goal.new_completed / new_target）
  const [newCompleted, setNewCompleted] = useState(0);
  const [newTarget, setNewTarget] = useState(DEFAULT_NEW_TARGET);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<StudyMode>('flip');
  const [ratingMode, setRatingMode] = useState<RatingMode>('simple');
  const [distractors, setDistractors] = useState<StudySense[]>([]);
  // 自由练习（练习/听音/拼写）：独立于卡片正式队列，只记 review_log 不动 FSRS 排期
  const [practiceQueue, setPracticeQueue] = useState<StoredCard[]>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  // I2 轮内错题重试：本轮已答错卡的 stableId 集合（兼「本轮答错 x」计数，同卡重试后再错不重复
  // 累计）；每卡每轮最多重试一次，重建轮 / 「再来一轮」时清空
  const [practiceRetried, setPracticeRetried] = useState<ReadonlySet<string>>(new Set());
  // I1 练习范围偏好（settings key='practiceScope' / 'practiceCefr'）：范围把抽题池从
  // 「已学卡全集」缩到「范围 ∩ 已学卡」；scopePool=过滤后池大小（null=重建中/未定）
  const [scope, setScope] = useState<PracticeScope>('all');
  const [cefrLevel, setCefrLevel] = useState<PracticeCefr>('A1');
  const [scopePool, setScopePool] = useState<number | null>(null);
  // 已学卡全集（review_card 全量 + 本次聚焦补的新卡）：范围重建 effect 的唯一输入，
  // 切范围不必重跑整个聚焦流程
  const [learnedCards, setLearnedCards] = useState<StoredCard[]>([]);
  // 聚焦代次：每次聚焦 +1 强制重建练习池（收藏可能在他处增删），无需比较 scope 是否变化
  const [scopeEpoch, setScopeEpoch] = useState(0);
  // I1 乐观写 G3 竞态守卫（同 stats.tsx prefWriteSeqRef/prefWritePendingRef）：scope 与 cefr
  // 两键共用一组序号，聚焦读发起时记序号，期间发生过切换/在途写未落库则不覆盖本地状态
  const scopeWriteSeqRef = useRef(0);
  const scopeWritePendingRef = useRef(false);

  // E5 上游接入骨架：探测发布物是否带例句 / CEFR 数据（v0.2 起才有），失败按无数据处理
  const [upstream, setUpstream] = useState({ hasExample: false, hasCefr: false });
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [hasExample, hasCefr] = await Promise.all([hasExampleData(), hasCefrData()]);
        if (alive) setUpstream({ hasExample, hasCefr });
      } catch {
        // 探测失败 → 槽位保持隐藏，不阻断学习屏
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  // 「例句挖空」chip 预留判定位：上游例句 + CEFR 数据到位才渲染，当前恒 false（自动隐藏）
  const showBlankExercise = shouldShowBlankExercise(upstream.hasExample, upstream.hasCefr);

  // 每次聚焦都重建：统计页改目标/别处学了词，切回来立即生效
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const now = new Date();
          const day = todayKey(now);
          // 恢复上次使用的学习模式（无效值回退「卡片」）；失败不阻断队列重建
          const savedMode = parseStudyMode(await getSetting(STUDY_MODE_KEY).catch(() => null));
          setMode(savedMode);
          // 恢复评分模式偏好（统计页开关 / 备份导入都会改库），无效值回退三档自评
          const savedRating = parseRatingMode(await getSetting(RATING_MODE_KEY).catch(() => null));
          setRatingMode(savedRating);
          // 恢复新卡补卡顺序偏好（H2，统计页三段选择 / 备份导入都会改库），无效值回退词频序
          const savedOrder = parseNewCardOrder(await getSetting(NEW_CARD_ORDER_KEY).catch(() => null));
          // 恢复练习范围偏好（I1，本屏切换 / 备份导入都会改库）：两键各自兜底互不连累；
          // 守卫见 scopeWriteSeqRef 注释——聚焦读发起时记序号，期间发生过本地切换则放弃覆盖
          const scopeReadSeq = scopeWriteSeqRef.current;
          const savedScope = parsePracticeScope(
            await getSetting(PRACTICE_SCOPE_KEY).catch(() => null),
          );
          const savedCefr = parsePracticeCefr(await getSetting(PRACTICE_CEFR_KEY).catch(() => null));
          const goal = await getDailyGoal(day);
          const stored = await getReviewCards();
          // F5 双目标分口径：复习缺口无法人为补（只能等排期到期），
          // 只有新学缺口（存量新卡 < newTarget）按「新卡顺序」偏好补新卡
          const newCount = stored.filter((c) => c.state === State.New).length;

          let all = stored;
          if (newCount < goal.newTarget) {
            // 复习缺口无法人为补（只能等排期到期），只有新学缺口按「新卡顺序」偏好补新卡（H2）：
            // freq=词频（默认）/ random=每次聚焦重建随机一次 / favoriteFirst=收藏词条义项优先
            const existing = new Set(stored.map((c) => c.stableId));
            const need = Math.max(goal.newTarget - newCount, SEED_BATCH);
            // 候选池按 need 的 4 倍取：池与 need 等大时 random 洗牌对「选哪些卡」不起作用（复核 R2）。
            // favoriteFirst 把收藏词条的义项显式并入候选池（复核 R1：收藏低频词不在词频窗口内，
            // 只靠词频 LIMIT 永远取不到），收藏段在前、词频段去重补齐。
            let seedRows: NewCardCandidate[];
            let favoriteIds = new Set<number>();
            if (savedOrder === 'favoriteFirst') {
              favoriteIds = new Set(await getFavoriteEntryIds().catch(() => []));
              const favRows =
                favoriteIds.size > 0 ? await getSeedCandidatesForEntries([...favoriteIds], need * 4) : [];
              const seen = new Set(favRows.map((r) => r.stableId));
              const freqRows = await getSeedCandidates(need * 4);
              seedRows = [...favRows, ...freqRows.filter((r) => !seen.has(r.stableId))];
            } else {
              seedRows = await getSeedCandidates(need * 4);
            }
            const ordered = orderNewCards(
              seedRows.filter((c) => !existing.has(c.stableId)),
              savedOrder,
              favoriteIds,
            );
            const fresh = ordered.slice(0, need).map((c) => newCard(c.stableId, now));
            if (fresh.length) {
              await bulkUpsertReviewCards(fresh);
              all = [...stored, ...fresh];
            }
          }
          const todayQueue = buildTodayQueue(all, goal.target, goal.newTarget, now);
          const content = await getStudySenses(todayQueue.map((c) => c.stableId));
          if (!alive) return;
          setTarget(goal.target);
          setCompleted(goal.completed);
          setNewTarget(goal.newTarget);
          setNewCompleted(goal.newCompleted);
          setQueue(spreadByHeadword(todayQueue, (c) => content.get(c.stableId)?.headword ?? c.stableId));
          setSenses(content);
          // 自由练习抽题池由下方 scope 重建 effect 统一计算（I1：范围 ∩ 已学卡）；
          // 这里只恢复范围偏好（G3 守卫：在途写/期间切换不回退本地状态）、刷新已学卡全集并推进聚焦代次
          if (scopeWriteSeqRef.current === scopeReadSeq && !scopeWritePendingRef.current) {
            setScope(savedScope);
            setCefrLevel(savedCefr);
          }
          setLearnedCards(all);
          setScopeEpoch((e) => e + 1);
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
    }, []),
  );

  const current = queue[0];
  const sense = current ? senses.get(current.stableId) : undefined;
  // 进度条按两目标合计口径（复习 + 新学各自的 done/total 相加）
  const progress = useMemo(
    () => queueProgress(completed + newCompleted, target + newTarget),
    [completed, target, newCompleted, newTarget],
  );

  // 自由练习（练习/听音/拼写）：独立于卡片正式队列
  const practiceCurrent = practiceQueue[practiceIndex] ?? null;
  const practiceSense = practiceCurrent ? senses.get(practiceCurrent.stableId) : undefined;

  // 当前卡亮出即预取真人发音（URL 缓存），点喇叭时几乎零等待
  const headword = sense?.headword;
  useEffect(() => {
    if (headword) prefetchWordAudio(headword);
  }, [headword]);

  // 练习/听音/拼写模式：为当前练习卡取同词性干扰项
  const currentPos = practiceSense?.pos ?? null;
  const currentStableId = practiceCurrent?.stableId ?? null;
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

  // I1：按当前范围重建自由练习抽题池（聚焦代次 / 范围 / CEFR 档位 / 已学卡任一变化都重算）。
  // 范围集合来自发布物（收藏经 learning.db entry_id 关联再查发布物义项），与已学卡求交在 JS 侧做
  // （filterPracticeScope，两边都是有界小集合）；抽中卡片同步补拉义项内容——范围池常含今日队列之外的卡，
  // 不补拉会渲染成空白。落库失败按空池处理，不阻断学习屏其他区域。
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    void (async () => {
      try {
        let scopeSet: ReadonlySet<string> | null = null;
        if (scope === 'favorites') {
          const favoriteIds = await getFavoriteEntryIds();
          scopeSet = new Set(await getStableIdsForEntries(favoriteIds));
        } else if (scope === 'exam') {
          scopeSet = new Set(await getExamScopeStableIds());
        } else if (scope === 'cefr') {
          scopeSet = new Set(await getCefrScopeStableIds(cefrLevel));
        }
        const pool = filterPracticeScope(learnedCards, scopeSet);
        const round = pickPracticeRound(pool, PRACTICE_ROUND);
        const practiceContent = await getStudySenses(round.map((c) => c.stableId));
        if (!alive) return;
        if (practiceContent.size > 0) {
          setSenses((prev) => new Map([...prev, ...practiceContent]));
        }
        setPracticeQueue(round);
        setPracticeIndex(0);
        setPracticeRetried(new Set());
        setScopePool(pool.length);
      } catch {
        if (alive) {
          setPracticeQueue([]);
          setPracticeRetried(new Set());
          setScopePool(0);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [ready, learnedCards, scope, cefrLevel, scopeEpoch]);

  // 切模式即记忆：写入 settings，下次聚焦恢复；落库失败静默（本次会话内仍生效）
  const changeMode = useCallback((next: StudyMode) => {
    setMode(next);
    void setSetting(STUDY_MODE_KEY, next).catch(() => {});
  }, []);

  // 切范围 / 切 CEFR 档即写入 settings（I1），当前会话立即生效（重建 effect 依赖 scope/cefrLevel），
  // 下次聚焦恢复；乐观写走 G3 竞态守卫（scopeWriteSeqRef，两键共用一组序号，同 stats.tsx）；
  // 落库失败静默，下次聚焦读会以 DB 真值重新对齐。切档先置空池大小，hint/空态按「重建中」处理。
  const changePracticeScope = useCallback((next: PracticeScope) => {
    const writeSeq = ++scopeWriteSeqRef.current;
    scopeWritePendingRef.current = true;
    setScope(next);
    setScopePool(null);
    setSetting(PRACTICE_SCOPE_KEY, next)
      .catch(() => {})
      .finally(() => {
        if (scopeWriteSeqRef.current === writeSeq) scopeWritePendingRef.current = false;
      });
  }, []);

  const changePracticeCefr = useCallback((next: PracticeCefr) => {
    const writeSeq = ++scopeWriteSeqRef.current;
    scopeWritePendingRef.current = true;
    setCefrLevel(next);
    setScopePool(null);
    setSetting(PRACTICE_CEFR_KEY, next)
      .catch(() => {})
      .finally(() => {
        if (scopeWriteSeqRef.current === writeSeq) scopeWritePendingRef.current = false;
      });
  }, []);

  const rate = useCallback(
    async (grade: Grade) => {
      if (!current || busy) return;
      setBusy(true);
      try {
        const now = new Date();
        const next = gradeCard(current, grade, now);
        await upsertReviewCard(next);
        await logReview(current.stableId, grade, next.due);
        // F5 分列入账：评分前是 New 卡记 new_completed，否则记 completed（review_log 照旧追加）
        const isNew = current.state === State.New;
        const nextCompleted = isNew ? completed : completed + 1;
        const nextNewCompleted = isNew ? newCompleted + 1 : newCompleted;
        await setDailyCompleted(todayKey(now), nextCompleted, target, nextNewCompleted, newTarget);
        setQueue((prev) => prev.slice(1));
        setCompleted(nextCompleted);
        setNewCompleted(nextNewCompleted);
        setRevealed(false);
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    },
    [current, busy, completed, target, newCompleted, newTarget],
  );

  // 练习/听音/拼写：只记 review_log（kind='practice'），不动 FSRS 排期与今日进度——
  // 四种方式相互独立：卡片答完/没答都不影响自由练习，反之亦然
  const answerPractice = useCallback(
    (correct: boolean) => {
      if (!practiceCurrent || busy) return;
      setBusy(true);
      try {
        const now = new Date();
        void logReview(practiceCurrent.stableId, correct ? 3 : 1, now.toISOString(), 'practice');
        if (correct) {
          setPracticeIndex((i) => i + 1);
        } else {
          // I2 轮内错题重试：首错尾插到队尾（moved）——当前卡移走后下一张自动落位到原
          // index，游标保持不 +1；二错不重排 / 队尾卡无可重排 / 卡不在队内（防御）都
          // moved=false，按跳过 +1 收尾。重试作答同样只走上面的 review_log(kind='practice')
          const res = retryWrong(practiceQueue, practiceCurrent.stableId, practiceRetried);
          setPracticeQueue(res.queue);
          setPracticeRetried(res.retried);
          setPracticeIndex((i) => (res.moved ? i : i + 1));
        }
      } finally {
        setBusy(false);
      }
    },
    [practiceCurrent, busy, practiceQueue, practiceRetried],
  );

  if (!ready) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const flipFinished = queue.length === 0;
  // 自由练习本轮完成（10 题答完）：可无限再来一轮
  const practiceFinished = practiceIndex >= practiceQueue.length && practiceQueue.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.modeRow}>
            <Text style={styles.h1}>学习</Text>
            <Pressable
              style={[styles.modeChip, mode === 'flip' && styles.modeChipActive]}
              onPress={() => changeMode('flip')}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'flip' }}
            >
              <Text style={[styles.modeChipText, mode === 'flip' && styles.modeChipTextActive]}>卡片</Text>
            </Pressable>
            <Pressable
              style={[styles.modeChip, mode === 'choice' && styles.modeChipActive]}
              onPress={() => changeMode('choice')}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'choice' }}
            >
              <Text style={[styles.modeChipText, mode === 'choice' && styles.modeChipTextActive]}>练习</Text>
            </Pressable>
            <Pressable
              style={[styles.modeChip, mode === 'listen' && styles.modeChipActive]}
              onPress={() => changeMode('listen')}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'listen' }}
            >
              <Text style={[styles.modeChipText, mode === 'listen' && styles.modeChipTextActive]}>听音</Text>
            </Pressable>
            <Pressable
              style={[styles.modeChip, mode === 'spell' && styles.modeChipActive]}
              onPress={() => changeMode('spell')}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'spell' }}
            >
              <Text style={[styles.modeChipText, mode === 'spell' && styles.modeChipTextActive]}>拼写</Text>
            </Pressable>
            {showBlankExercise ? (
              // M2-T08 实装位：上游例句数据到位后接入「例句挖空」模式切换与 QuizCard 挖空题型；
              // 当前发布物无例句，此分支恒不渲染（chips 区与现状一致）
              <Pressable style={styles.modeChip} accessibilityRole="button" accessibilityLabel="例句挖空">
                <Text style={styles.modeChipText}>挖空</Text>
              </Pressable>
            ) : null}
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
        {quizMode ? (
          // I1 练习范围选择：仅练习/听音/拼写模式显示（卡片模式不显示）；选 CEFR 追加五档小 chip
          <View style={styles.scopeRow}>
            <View style={styles.segRow} accessibilityRole="tablist">
              {PRACTICE_SCOPE_OPTIONS.map((opt) => {
                const active = opt.value === scope;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => changePracticeScope(opt.value)}
                    style={[styles.segChip, active && styles.segChipActive]}
                    accessibilityRole="tab"
                    accessibilityLabel={`练习范围：${opt.label}`}
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.segChipText, active && styles.segChipTextActive]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {scope === 'cefr' ? (
              <View style={styles.segRow}>
                {PRACTICE_CEFR_LEVELS.map((lv) => {
                  const active = lv === cefrLevel;
                  return (
                    <Pressable
                      key={lv}
                      onPress={() => changePracticeCefr(lv)}
                      style={[styles.cefrChip, active && styles.segChipActive]}
                      accessibilityRole="tab"
                      accessibilityLabel={`CEFR 档位：${lv}`}
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.cefrChipText, active && styles.segChipTextActive]}>{lv}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {quizMode
            ? `本轮 ${practiceIndex}/${practiceQueue.length || PRACTICE_ROUND} · 自由练习`
            : `今日 复习 ${completed}/${target} · 新学 ${newCompleted}/${newTarget} · 剩 ${queue.length}`}
        </Text>
        {quizMode && scope !== 'all' && scopePool !== null && scopePool < PRACTICE_ROUND ? (
          // 范围内候选不足一轮时明示池大小（数据足够时不显示，scope='all' 恒不显示）
          <Text style={styles.scopeHint}>该范围共 {scopePool} 张</Text>
        ) : null}
        {quizMode && practiceRetried.size > 0 ? (
          // I2 轮内错题统计：有重试才显示；x=本轮已答错卡数（同卡重试后再错不重复累计）
          <Text style={styles.scopeHint}>本轮答错 {practiceRetried.size}</Text>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {quizMode ? (
        practiceQueue.length === 0 ? (
          // 池空（含首建未完成）：重建中给 spinner，已定空池给空态（scope=all 且 0 已学卡也走这里，
          // 顺带修掉原实现下新用户切练习模式无限 spinner 的暗坑）
          scopePool === null ? (
            <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.centerBox}>
              <Text style={styles.doneTitle}>该范围还没有可练的卡</Text>
              <Text style={styles.doneSub}>
                {scope === 'all'
                  ? '自由练习只从已学卡抽题。先在「卡片」模式学几个词，再回来练。'
                  : `「${PRACTICE_SCOPE_LABELS[scope]}${scope === 'cefr' ? `·${cefrLevel}` : ''}」范围内共 0 张已学卡，切回「全部」或先去学几个词。`}
              </Text>
            </View>
          )
        ) : practiceFinished ? (
          <View style={styles.centerBox}>
            <Text style={styles.doneTitle}>本轮练习完成</Text>
            <Text style={styles.doneSub}>
              已练 {practiceQueue.length} 个义项（自由练习不计入今日进度、不影响排期）。
            </Text>
            <Pressable
              style={styles.revealBtn}
              onPress={() => {
                setPracticeIndex(0);
                setPracticeRetried(new Set()); // I2：「本轮答错 x」按轮清零
              }}
              accessibilityRole="button"
            >
              <Text style={styles.revealBtnText}>再来一轮</Text>
            </Pressable>
          </View>
        ) : practiceSense ? (
          <ScrollView contentContainerStyle={styles.cardArea}>
            <QuizCard
              key={practiceSense.stableId}
              sense={practiceSense}
              pool={distractors}
              onAnswer={answerPractice}
              busy={busy}
              variant={mode === 'spell' ? 'spell' : mode === 'listen' ? 'listen' : 'meaning'}
            />
            <TtsBanner />
          </ScrollView>
        ) : (
          <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} />
        )
      ) : flipFinished ? (
        completed + newCompleted > 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.doneTitle}>今天完成了</Text>
            <Text style={styles.doneSub}>
              已复习 {completed} 个、新学 {newCompleted} 个义项。明天再来，记忆曲线会安排下次出现时间。
            </Text>
          </View>
        ) : (
          <View style={styles.centerBox}>
            <Text style={styles.doneTitle}>今天没有到期的任务</Text>
            <Text style={styles.doneSub}>已学的词还没到下次复习时间。可以去「词库」逛逛，或切「练习」继续。</Text>
          </View>
        )
      ) : sense ? (
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
      ) : null}

      {!quizMode && !flipFinished && sense && mode === 'flip' ? (
        <View style={styles.gradeRow}>
          {revealed
            ? gradesForMode(ratingMode).map((g) => (
                <Pressable
                  key={g}
                  style={[styles.gradeBtn, g === PRIMARY_GRADE && styles.gradeBtnPrimary]}
                  onPress={() => rate(g)}
                  disabled={busy}
                  accessibilityRole="button"
                >
                  <Text style={[styles.gradeText, g === PRIMARY_GRADE && styles.gradeTextPrimary]}>
                    {RATING_LABELS[g]}
                  </Text>
                </Pressable>
              ))
            : null}
        </View>
      ) : null}

      {!quizMode && !flipFinished && sense && mode === 'flip' && !revealed ? (
        <Pressable style={[styles.revealBtn]} onPress={() => setRevealed(true)} accessibilityRole="button">
          <Text style={styles.revealBtnText}>显示释义</Text>
        </Pressable>
      ) : null}

      <PlayToast />
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
    // I1 练习范围行 + 分段控件（沿用 history.tsx segChip 既有风格，同源 modeChip）
    scopeRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
    segRow: { flexDirection: 'row' },
    segChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      backgroundColor: t.bgSurface,
      marginLeft: 6,
    },
    segChipActive: { backgroundColor: t.bgSurfaceElevated, borderColor: t.borderStrong },
    segChipText: { color: t.textMuted, fontSize: 12, fontWeight: '700' },
    segChipTextActive: { color: t.textPrimary },
    cefrChip: {
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 7,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      backgroundColor: t.bgSurface,
      marginLeft: 6,
    },
    cefrChipText: { color: t.textMuted, fontSize: 11, fontWeight: '700' },
    scopeHint: { color: t.textMuted, fontSize: 11 },
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
