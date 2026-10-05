import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { ChevronForwardIcon, FlameIcon, PencilIcon, SparkIcon, StarIcon, TrophyIcon } from '@/components/icons';
import {
  getDailyGoal,
  getDueTimes,
  getPracticeDaily,
  getPracticeTotal,
  getReviewHistory,
  getReviewLogTimestamps,
  getSetting,
  getStudyStats,
  setDailyTarget,
  setSetting,
  type StudyStats,
} from '@/db/study';
import { disableReminder, enableReminder, getReminderSetting, REMINDER_TIMES, type ReminderSetting } from '@/utils/reminders';
import { parseRatingMode, RATING_MODE_KEY, type RatingMode } from '@/study/rating-core';
import {
  bestStreak,
  bucketHistory,
  computeStreak,
  futureLoad,
  heatmapData,
  todayKey,
  type FutureLoadResult,
  type HeatmapResult,
} from '@/study/stats-core';
import { useFavorites } from '@/stores/favorites';
import { useThemeStore } from '@/stores/theme';
import { useResolvedScheme, useTheme } from '@/theme/tokens';
import type { ThemePreference } from '@/theme/theme-core';

const TARGET_OPTIONS = [10, 20, 30, 50];

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
];

export default function StatsScreen() {
  const t = useTheme();
  const styles = makeStyles(t);

  const [stats, setStats] = useState<StudyStats | null>(null);
  const [history, setHistory] = useState<{ day: string; count: number }[]>([]);
  const [practiceHistory, setPracticeHistory] = useState<{ day: string; count: number }[]>([]);
  const [practiceTotal, setPracticeTotal] = useState(0);
  // 未来复习压力（F3）：7/30 天切换的逐日到期量 + 今日基准线
  const [forecast, setForecast] = useState<FutureLoadResult | null>(null);
  const [forecastRange, setForecastRange] = useState<7 | 30>(7);
  // 学习热力图（F4）：近 365 天逐日打卡计数 + 按周分列结构
  const [heatmap, setHeatmap] = useState<HeatmapResult | null>(null);
  const [reminder, setReminder] = useState<ReminderSetting | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [target, setTarget] = useState(20);
  const [doneToday, setDoneToday] = useState(0);
  // 评分模式偏好（settings 表 key='ratingMode'，F1）：默认三档自评，开「专家模式」后翻卡四键
  const [ratingMode, setRatingMode] = useState<RatingMode>('simple');
  const { ids: favoriteIds, hydrate } = useFavorites();
  const themePreference = useThemeStore((s) => s.preference);
  const setThemePreference = useThemeStore((s) => s.setPreference);
  const hydrateTheme = useThemeStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
    void hydrateTheme();
  }, [hydrate, hydrateTheme]);

  useEffect(() => {
    let alive = true;
    const day = todayKey(new Date());
    Promise.all([getStudyStats(), getDailyGoal(day), getReviewHistory(7), getReminderSetting(), getPracticeTotal(), getPracticeDaily(7), getDueTimes(), getReviewLogTimestamps(365)])
      .then(([s, goal, rows, rem, practices, practiceRows, dueTimes, logTimes]) => {
        if (!alive) return;
        setStats(s);
        setHistory(bucketHistory(rows, 7, day));
        setPracticeHistory(bucketHistory(practiceRows, 7, day));
        setReminder(rem);
        setPracticeTotal(practices);
        setTarget(goal.target);
        setDoneToday(goal.completed);
        setForecast(futureLoad(dueTimes, day));
        setHeatmap(heatmapData(logTimes, day));
      })
      .catch((e) => {
        console.warn('[stats] load failed', e);
        if (alive) setLoadError(String(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  const changeTarget = useCallback((next: number) => {
    const day = todayKey(new Date());
    setTarget(next);
    setDailyTarget(day, next).catch(() => {});
  }, []);

  // 聚焦即恢复评分偏好：学习屏/备份导入改了库，切回统计页立即反映
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getSetting(RATING_MODE_KEY)
        .then((v) => {
          if (alive) setRatingMode(parseRatingMode(v));
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  // 切开关即写入 settings，学习屏聚焦时恢复；落库失败静默（本次会话内仍生效）
  const toggleExpertMode = useCallback((on: boolean) => {
    const next: RatingMode = on ? 'expert' : 'simple';
    setRatingMode(next);
    void setSetting(RATING_MODE_KEY, next).catch(() => {});
  }, []);

  const streak = stats ? computeStreak(stats.activeDays, todayKey(new Date())) : 0;
  const best = stats ? bestStreak(stats.activeDays) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>统计</Text>

        {loadError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>统计加载失败：{loadError}</Text>
          </View>
        ) : !stats ? (
          <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.row}>
              <StatTile
                label="今日已复习"
                value={String(doneToday)}
                suffix={`/ ${target}`}
                icon={<SparkIcon color={t.textMuted} size={16} />}
              />
              <StatTile
                label="连续天数"
                value={String(streak)}
                suffix="天"
                icon={<FlameIcon color={t.textMuted} size={16} />}
              />
            </View>
            <View style={styles.row}>
              <StatTile
                label="最长连续"
                value={String(best)}
                suffix="天"
                icon={<TrophyIcon color={t.textMuted} size={16} />}
              />
              <StatTile
                label="自由练习"
                value={String(practiceTotal)}
                suffix="次"
                icon={<PencilIcon color={t.textMuted} size={16} />}
              />
            </View>
            <View style={styles.row}>
              <StatTile
                label="累计复习"
                value={String(stats.totalReviews)}
                suffix="次"
                icon={<StarIcon color={t.textMuted} size={16} />}
              />
              <StatTile
                label="已稳固"
                value={String(stats.solidCount)}
                suffix="义项"
                icon={<StarIcon color={t.textMuted} size={16} />}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>每日目标</Text>
              <View style={styles.targetRow}>
                {TARGET_OPTIONS.map((opt) => {
                  const active = opt === target;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => changeTarget(opt)}
                      style={[styles.targetBtn, active && styles.targetBtnActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.targetText, active && styles.targetTextActive]}>{opt}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.cardHint}>明天起按新目标组队列；今天已复习的进度不变。</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>近 7 日复习</Text>
              <WeekBars rows={history} activeColor={t.accentSuccess} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>近 7 日自由练习</Text>
              <WeekBars rows={practiceHistory} activeColor={t.accentWarning} />
            </View>

            <HeatmapCard data={heatmap} today={todayKey(new Date())} />

            <View style={styles.card}>
              <View style={styles.reminderHead}>
                <Text style={styles.cardTitle}>未来复习压力</Text>
                <View style={styles.rangeRow}>
                  {([7, 30] as const).map((r) => {
                    const active = r === forecastRange;
                    return (
                      <Pressable
                        key={r}
                        onPress={() => setForecastRange(r)}
                        style={[styles.rangeBtn, active && styles.rangeBtnActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{r} 天</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              {forecast ? (
                <LoadBars
                  rows={forecastRange === 7 ? forecast.daily7 : forecast.daily30}
                  baseline={forecast.todayCount}
                  today={todayKey(new Date())}
                />
              ) : null}
              <Text style={styles.cardHint}>
                今日到期 {forecast?.todayCount ?? 0} 张（基准线，含逾期未复习）；越往后到期越分散说明排期越健康。
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.reminderHead}>
                <Text style={styles.cardTitle}>每日提醒</Text>
                <Switch
                  value={!!reminder?.enabled}
                  disabled={reminderBusy}
                  onValueChange={(on) => {
                    if (!reminder) return;
                    setReminderBusy(true);
                    (on
                      ? enableReminder(reminder.hour, reminder.minute)
                      : disableReminder()
                    )
                      .then((r) => {
                        const granted = !r || r.granted;
                        setReminder({ ...reminder, enabled: on && granted, notificationId: null });
                      })
                      .catch(() => {})
                      .finally(() => setReminderBusy(false));
                  }}
                  trackColor={{ false: t.bgSurfaceElevated, true: t.primary }}
                  thumbColor="#ffffff"
                />
              </View>
              {reminder?.enabled ? (
                <View style={styles.targetRow}>
                  {REMINDER_TIMES.map((tm) => {
                    const active = tm.hour === reminder.hour && tm.minute === reminder.minute;
                    return (
                      <Pressable
                        key={tm.label}
                        disabled={reminderBusy}
                        onPress={() => {
                          setReminderBusy(true);
                          enableReminder(tm.hour, tm.minute)
                            .then((r) => {
                              if (r.granted) setReminder({ ...reminder, hour: tm.hour, minute: tm.minute });
                            })
                            .catch(() => {})
                            .finally(() => setReminderBusy(false));
                        }}
                        style={[styles.targetBtn, active && styles.targetBtnActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.targetText, active && styles.targetTextActive]}>{tm.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.cardHint}>开启后每天固定时间提醒你复习（需允许系统通知）。</Text>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.reminderHead}>
                <Text style={styles.cardTitle}>评分模式</Text>
                <Switch
                  value={ratingMode === 'expert'}
                  onValueChange={toggleExpertMode}
                  trackColor={{ false: t.bgSurfaceElevated, true: t.primary }}
                  thumbColor="#ffffff"
                />
              </View>
              {ratingMode === 'expert' ? (
                <Text style={styles.cardHint}>
                  专家模式：卡片复习展示四键自评（认识 / 简单 / 模糊 / 忘记）。
                </Text>
              ) : (
                <Text style={styles.cardHint}>
                  三档自评（认识 / 模糊 / 忘记）；开启后增加「简单」键，由 FSRS 以更高间隔排期。
                </Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>卡片分布</Text>
              <Bar label="新卡" value={stats.stateCounts.new} total={cardTotal(stats)} color={t.textMuted} />
              <Bar label="学习中" value={stats.stateCounts.learning} total={cardTotal(stats)} color={t.accentWarning} />
              <Bar label="复习中" value={stats.stateCounts.review} total={cardTotal(stats)} color={t.accentPrimary} />
              <Bar label="重学" value={stats.stateCounts.relearning} total={cardTotal(stats)} color={t.destructive} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>其他</Text>
              <Text style={styles.cardLine}>收藏词条：{favoriteIds.size}</Text>
              <Text style={styles.cardHint}>学习天数 {stats.activeDays.length} 天</Text>
              <Text style={styles.cardHint}>外观</Text>
              <View style={styles.targetRow}>
                {THEME_OPTIONS.map((opt) => {
                  const active = opt.value === themePreference;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setThemePreference(opt.value)}
                      style={[styles.targetBtn, active && styles.targetBtnActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.targetText, active && styles.targetTextActive]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.cardHint}>「跟随系统」随设备深色模式变化；其余两项立即覆盖。</Text>
              <Pressable
                style={styles.aboutRow}
                onPress={() => router.push('/history')}
                accessibilityRole="button"
                accessibilityLabel="复习历史"
              >
                <Text style={styles.aboutText}>复习历史</Text>
                <ChevronForwardIcon color={t.textMuted} size={16} />
              </Pressable>
              <Pressable
                style={styles.aboutRow}
                onPress={() => router.push('/about')}
                accessibilityRole="button"
                accessibilityLabel="关于 Wordfolio"
              >
                <Text style={styles.aboutText}>关于 Wordfolio</Text>
                <ChevronForwardIcon color={t.textMuted} size={16} />
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function cardTotal(stats: StudyStats): number {
  const c = stats.stateCounts;
  return Math.max(1, c.new + c.learning + c.review + c.relearning);
}

function StatTile({
  label,
  value,
  suffix,
  icon,
}: {
  label: string;
  value: string;
  suffix: string;
  icon: React.ReactNode;
}) {
  const t = useTheme();
  const styles = makeStyles(t);
  return (
    <View style={styles.tile}>
      <View style={styles.tileHead}>
        {icon}
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
      <Text style={styles.tileValue}>
        {value}
        <Text style={styles.tileSuffix}> {suffix}</Text>
      </Text>
    </View>
  );
}

/** 近 N 日逐日柱状（复习与自由练习两卡共用；缺日已由 bucketHistory 补零，0 值画空槽）。 */
function WeekBars({ rows, activeColor }: { rows: { day: string; count: number }[]; activeColor: string }) {
  const t = useTheme();
  const styles = makeStyles(t);
  const max = Math.max(1, ...rows.map((h) => h.count));
  return (
    <View style={styles.weekRow}>
      {rows.map((d) => (
        <View key={d.day} style={styles.dayCol}>
          <Text style={styles.dayCount}>{d.count || ''}</Text>
          <View style={styles.dayBarTrack}>
            <View
              style={[
                styles.dayBar,
                {
                  height: Math.max(4, (d.count / max) * 44),
                  backgroundColor: d.count > 0 ? activeColor : t.bgSurfaceElevated,
                },
              ]}
            />
          </View>
          <Text style={styles.dayLabel}>{d.day.slice(8)}</Text>
        </View>
      ))}
    </View>
  );
}

/** 学习热力图（F4）：GitHub 式近 365 天格状，列=周、行=周日→周六；
 *  颜色五档=当日打卡次数（review+practice，0 次无色槽）；点格内联显示当日次数，不做详情页。 */
const HEAT_RAMP_LIGHT = ['#fde68a', '#fbbf24', '#d97706', '#b45309'];
const HEAT_RAMP_DARK = ['#78350f', '#b45309', '#f59e0b', '#fcd34d'];

function HeatmapCard({ data, today }: { data: HeatmapResult | null; today: string }) {
  const t = useTheme();
  const scheme = useResolvedScheme();
  const styles = makeStyles(t);
  const { width } = useWindowDimensions();
  // 53 列（约 365 天）自适应屏宽：减去页边距 32 与 52 个列间隙
  const gap = 2;
  const cell = Math.max(3, Math.floor((width - 32 - 52 * gap) / 53));
  const [selected, setSelected] = useState<string | null>(null);
  const ramp = scheme === 'dark' ? HEAT_RAMP_DARK : HEAT_RAMP_LIGHT;
  const selectedDay = selected ? data?.days.find((d) => d.day === selected) : undefined;

  return (
    <View style={styles.card}>
      <View style={styles.reminderHead}>
        <Text style={styles.cardTitle}>学习热力图</Text>
        <View style={styles.heatLegend}>
          <Text style={styles.heatLegendText}>少</Text>
          {[0, 1, 2, 3, 4].map((lv) => (
            <View
              key={lv}
              style={[styles.heatCell, { width: cell, height: cell, backgroundColor: lv === 0 ? t.bgSurfaceElevated : ramp[lv - 1] }]}
            />
          ))}
          <Text style={styles.heatLegendText}>多</Text>
        </View>
      </View>
      {data ? (
        <View style={{ gap }}>
          {data.weeks.map((week, wi) => (
            <View key={wi} style={{ flexDirection: 'row', gap }}>
              {week.map((d, di) =>
                d ? (
                  <Pressable
                    key={d.day}
                    onPress={() => setSelected(selected === d.day ? null : d.day)}
                    style={[
                      styles.heatCell,
                      {
                        width: cell,
                        height: cell,
                        backgroundColor: d.count > 0 ? ramp[d.level - 1] : t.bgSurfaceElevated,
                        borderWidth: d.day === selected ? 1 : 0,
                        borderColor: t.textSecondary,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${d.day} 复习 ${d.count} 次`}
                  />
                ) : (
                  <View key={`empty-${di}`} style={{ width: cell, height: cell }} />
                ),
              )}
            </View>
          ))}
        </View>
      ) : null}
      <Text style={styles.cardHint}>
        {selectedDay
          ? `${selectedDay.day}：${selectedDay.count} 次`
          : '近一年每天的复习量（正式学习 + 自由练习都算打卡）；点任意格子查看当日次数。'}
      </Text>
    </View>
  );
}

/** 未来复习压力逐日柱状（F3）：7 天单行 / 30 天每行 15 列两行；
 *  每列轨道内按今日量画一条贯穿基准线，今日列高亮。 */
function LoadBars({
  rows,
  baseline,
  today,
}: {
  rows: { day: string; count: number }[];
  baseline: number;
  today: string;
}) {
  const t = useTheme();
  const styles = makeStyles(t);
  const max = Math.max(1, ...rows.map((r) => r.count));
  const baselineY = baseline > 0 ? Math.max(4, (baseline / max) * 44) : 0;
  const chunks: { day: string; count: number }[][] = [];
  for (let i = 0; i < rows.length; i += 15) chunks.push(rows.slice(i, i + 15));
  return (
    <View style={{ gap: 8 }}>
      {chunks.map((chunk, ci) => (
        <View key={ci} style={styles.weekRow}>
          {chunk.map((d) => {
            const isToday = d.day === today;
            return (
              <View key={d.day} style={styles.dayCol}>
                <Text style={styles.dayCount}>{d.count || ''}</Text>
                <View style={styles.dayBarTrack}>
                  {baselineY > 0 ? <View style={[styles.baselineLine, { bottom: baselineY }]} /> : null}
                  <View
                    style={[
                      styles.dayBar,
                      {
                        height: Math.max(4, (d.count / max) * 44),
                        backgroundColor: d.count > 0 ? (isToday ? t.primary : t.accentPrimary) : t.bgSurfaceElevated,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{isToday ? '今' : d.day.slice(8)}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const t = useTheme();
  const styles = makeStyles(t);
  const pct = Math.round((value / total) * 100);
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barValue}>{value}</Text>
    </View>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bgCanvas },
    scroll: { padding: 16, paddingBottom: 32, gap: 12 },
    h1: { fontSize: 26, fontWeight: '800', color: t.textPrimary, marginBottom: 4 },
    errorBox: {
      backgroundColor: t.bgSurface,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderSubtle,
      padding: 16,
      marginTop: 12,
    },
    errorText: { color: t.destructive, fontSize: 13, lineHeight: 19 },
    row: { flexDirection: 'row', gap: 12 },
    tile: {
      flex: 1,
      backgroundColor: t.bgSurface,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderSubtle,
      padding: 16,
      gap: 6,
    },
    tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    tileLabel: { color: t.textMuted, fontSize: 12, fontWeight: '600' },
    tileValue: { color: t.textPrimary, fontSize: 28, fontWeight: '800' },
    tileSuffix: { color: t.textMuted, fontSize: 14, fontWeight: '600' },
    card: {
      backgroundColor: t.bgSurface,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderSubtle,
      padding: 16,
      gap: 10,
    },
    cardTitle: { color: t.textPrimary, fontSize: 15, fontWeight: '700' },
    cardHint: { color: t.textMuted, fontSize: 12, lineHeight: 18 },
    cardLine: { color: t.textSecondary, fontSize: 14 },
    aboutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
      marginTop: 2,
    },
    aboutText: { color: t.accentPrimary, fontSize: 14, fontWeight: '600' },
    targetRow: { flexDirection: 'row', gap: 10 },
    targetBtn: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderStrong,
      backgroundColor: t.bgSurface,
    },
    targetBtnActive: { backgroundColor: t.primary, borderColor: t.primary },
    targetText: { color: t.textSecondary, fontWeight: '700', fontSize: 15 },
    targetTextActive: { color: t.primaryForeground },
    reminderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    weekRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-end' },
    dayCol: { flex: 1, alignItems: 'center', gap: 4 },
    dayCount: { color: t.textSecondary, fontSize: 10, fontVariant: ['tabular-nums'] },
    dayBarTrack: { height: 48, width: '70%', justifyContent: 'flex-end' },
    dayBar: { width: '100%', borderRadius: 4 },
    dayLabel: { color: t.textMuted, fontSize: 10 },
    dayLabelToday: { color: t.primary, fontWeight: '700' },
    baselineLine: { position: 'absolute', left: 0, right: 0, height: 2, borderRadius: 1, backgroundColor: t.destructive },
    rangeRow: { flexDirection: 'row', gap: 8 },
    rangeBtn: {
      paddingHorizontal: 12,
      minHeight: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderStrong,
      backgroundColor: t.bgSurface,
    },
    rangeBtnActive: { backgroundColor: t.primary, borderColor: t.primary },
    rangeText: { color: t.textSecondary, fontSize: 12, fontWeight: '700' },
    rangeTextActive: { color: t.primaryForeground },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    barLabel: { color: t.textSecondary, fontSize: 13, width: 52 },
    barTrack: { flex: 1, height: 8, borderRadius: 999, backgroundColor: t.bgSurfaceElevated, overflow: 'hidden' },
    barFill: { height: 8, borderRadius: 999 },
    barValue: { color: t.textMuted, fontSize: 12, width: 32, textAlign: 'right', fontVariant: ['tabular-nums'] },
    heatLegend: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    heatLegendText: { color: t.textMuted, fontSize: 10, marginHorizontal: 2 },
    heatCell: { borderRadius: 2 },
  });
}
