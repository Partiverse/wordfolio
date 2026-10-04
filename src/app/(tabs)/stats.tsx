import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ChevronForwardIcon, FlameIcon, PencilIcon, SparkIcon, StarIcon, TrophyIcon } from '@/components/icons';
import { getDailyGoal, getPracticeTotal, getReviewHistory, getStudyStats, setDailyTarget, type StudyStats } from '@/db/study';
import { disableReminder, enableReminder, getReminderSetting, REMINDER_TIMES, type ReminderSetting } from '@/utils/reminders';
import { bestStreak, bucketHistory, computeStreak, todayKey } from '@/study/stats-core';
import { useFavorites } from '@/stores/favorites';
import { useTheme } from '@/theme/tokens';

const TARGET_OPTIONS = [10, 20, 30, 50];

export default function StatsScreen() {
  const t = useTheme();
  const styles = makeStyles(t);

  const [stats, setStats] = useState<StudyStats | null>(null);
  const [history, setHistory] = useState<{ day: string; count: number }[]>([]);
  const [practiceTotal, setPracticeTotal] = useState(0);
  const [reminder, setReminder] = useState<ReminderSetting | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [target, setTarget] = useState(20);
  const [doneToday, setDoneToday] = useState(0);
  const { ids: favoriteIds, hydrate } = useFavorites();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    let alive = true;
    const day = todayKey(new Date());
    Promise.all([getStudyStats(), getDailyGoal(day), getReviewHistory(7), getReminderSetting(), getPracticeTotal()])
      .then(([s, goal, rows, rem, practices]) => {
        if (!alive) return;
        setStats(s);
        setHistory(bucketHistory(rows, 7, day));
        setReminder(rem);
        setPracticeTotal(practices);
        setTarget(goal.target);
        setDoneToday(goal.completed);
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
              <View style={styles.weekRow}>
                {history.map((d) => {
                  const max = Math.max(1, ...history.map((h) => h.count));
                  return (
                    <View key={d.day} style={styles.dayCol}>
                      <Text style={styles.dayCount}>{d.count || ''}</Text>
                      <View style={styles.dayBarTrack}>
                        <View
                          style={[
                            styles.dayBar,
                            {
                              height: Math.max(4, (d.count / max) * 44),
                              backgroundColor: d.count > 0 ? t.accentSuccess : t.bgSurfaceElevated,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.dayLabel}>{d.day.slice(8)}</Text>
                    </View>
                  );
                })}
              </View>
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
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    barLabel: { color: t.textSecondary, fontSize: 13, width: 52 },
    barTrack: { flex: 1, height: 8, borderRadius: 999, backgroundColor: t.bgSurfaceElevated, overflow: 'hidden' },
    barFill: { height: 8, borderRadius: 999 },
    barValue: { color: t.textMuted, fontSize: 12, width: 32, textAlign: 'right', fontVariant: ['tabular-nums'] },
  });
}
