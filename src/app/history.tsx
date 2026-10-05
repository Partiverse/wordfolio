import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { Grade } from 'ts-fsrs';

import { ChevronBackIcon, VolumeIcon } from '@/components/icons';
import { getRecentReviews, getReviewHistory, type RecentReview } from '@/db/study';
import { getStudySenses, type StudySense } from '@/db/repository';
import { GRADE_LABELS } from '@/study/fsrs-core';
import { bucketHistory, aggregateTrend, formatReviewTime, todayKey, type TrendGranularity } from '@/study/stats-core';
import { playWordAudio } from '@/utils/wordAudio';
import { useTheme } from '@/theme/tokens';

// 复习历史（逻辑树 §6 槽位：统计 tab 二级页——完整曲线 + 逐次明细，数据源 review_log）。
const HISTORY_DAYS = 30;
const DETAIL_LIMIT = 200;

// 柱状卡维度切换：日=现状（逐日），周=ISO 周聚合，月=自然月聚合（纯函数 aggregateTrend 前端聚合）。
type Granularity = 'day' | TrendGranularity;
const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: 'day', label: '日' },
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
];

export default function HistoryScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const router = useRouter();

  const [logs, setLogs] = useState<RecentReview[] | null>(null);
  const [buckets, setBuckets] = useState<{ day: string; count: number }[]>([]);
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [senses, setSenses] = useState<Map<string, StudySense>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [rows, history] = await Promise.all([
        getRecentReviews(DETAIL_LIMIT),
        getReviewHistory(HISTORY_DAYS),
      ]);
      const content = await getStudySenses([...new Set(rows.map((r) => r.stableId))]);
      if (!alive) return;
      setLogs(rows);
      setSenses(content);
      setBuckets(bucketHistory(history, HISTORY_DAYS, todayKey(new Date())));
    })().catch((e) => {
      console.warn('[history] load failed', e);
      if (alive) setError(String(e));
    });
    return () => {
      alive = false;
    };
  }, []);

  const last30Total = buckets.reduce((sum, b) => sum + b.count, 0);
  // 日=逐日原样；周/月=纯函数前端聚合（输入已是补零连续序列，空期自然为 0）。
  // key 用完整日期/聚合标签：日档的展示标签只取「几号」，跨月会同名，不能作 key。
  const columns =
    granularity === 'day'
      ? buckets.map((b) => ({ key: b.day, label: b.day.slice(8), count: b.count }))
      : aggregateTrend(buckets, granularity).map((b) => ({
          key: b.label,
          label: granularity === 'week' ? b.label.slice(5) : `${Number(b.label.slice(5, 7))}月`,
          count: b.count,
        }));
  const maxCount = Math.max(1, ...columns.map((c) => c.count));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="返回"
        >
          <ChevronBackIcon color={t.textSecondary} size={20} />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        <Text style={styles.h1}>复习历史</Text>
        <Text style={styles.subtitle}>
          {logs ? `近 ${HISTORY_DAYS} 日 ${last30Total} 次 · 共显示 ${logs.length} 条` : '加载中…'}
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {logs === null ? (
        <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} />
      ) : logs.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.doneTitle}>还没有学习记录</Text>
          <Text style={styles.doneSub}>先去学习 tab 完成一轮吧</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <View style={styles.card}>
            <View style={styles.chartHead}>
              <Text style={styles.cardTitle}>
                {granularity === 'day' ? `近 ${HISTORY_DAYS} 日复习` : `近 ${HISTORY_DAYS} 日 · 按${granularity === 'week' ? '周' : '月'}`}
              </Text>
              <View style={styles.segRow} accessibilityRole="tablist">
                {GRANULARITIES.map((g) => (
                  <Pressable
                    key={g.key}
                    onPress={() => setGranularity(g.key)}
                    style={[styles.segChip, granularity === g.key && styles.segChipActive]}
                    accessibilityRole="tab"
                    accessibilityLabel={`按${g.label}查看`}
                    accessibilityState={{ selected: granularity === g.key }}
                  >
                    <Text style={[styles.segChipText, granularity === g.key && styles.segChipTextActive]}>{g.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.weekRow}>
              {columns.map((c, i) => (
                <View key={c.key} style={styles.dayCol}>
                  <Text style={styles.dayCount}>{c.count || ''}</Text>
                  <View style={styles.dayBarTrack}>
                    <View
                      style={[
                        styles.dayBar,
                        {
                          height: Math.max(4, (c.count / maxCount) * 44),
                          backgroundColor: c.count > 0 ? t.accentSuccess : t.bgSurfaceElevated,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.dayLabel}>
                    {granularity === 'day' ? ((i + 1) % 5 === 0 || i === columns.length - 1 ? c.label : '') : c.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {logs.map((item) => {
            const sense = senses.get(item.stableId);
            if (!sense) return null;
            return (
              <View key={`${item.stableId}-${item.reviewedAt}-${item.rating}`} style={styles.card}>
                <View style={styles.cardTop}>
                  <Pressable
                    style={styles.headRow}
                    onPress={() => void playWordAudio(sense.headword)}
                    hitSlop={8}
                    accessibilityLabel={`播放 ${sense.headword} 发音`}
                  >
                    <Text style={styles.headword}>{sense.headword}</Text>
                    <Text style={styles.pos}>{sense.pos}</Text>
                    <VolumeIcon color={t.textMuted} size={15} />
                  </Pressable>
                  <Text style={styles.time}>{formatReviewTime(item.reviewedAt)}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={[styles.rating, item.rating === 1 && styles.ratingAgain]}>
                    {GRADE_LABELS[item.rating as Grade]}
                  </Text>
                  {item.kind === 'practice' ? <Text style={styles.practiceBadge}>练习</Text> : null}
                </View>
                <Text style={styles.defZh} numberOfLines={1}>
                  {sense.labelZh ?? sense.definitionZh}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bgCanvas, paddingHorizontal: 16 },
    header: { paddingTop: 8, paddingBottom: 12, gap: 6 },
    back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
    backText: { color: t.textSecondary, fontSize: 15, fontWeight: '600' },
    h1: { fontSize: 24, fontWeight: '800', color: t.textPrimary },
    subtitle: { fontSize: 13, color: t.textMuted },
    list: { paddingBottom: 32, gap: 10 },
    card: {
      backgroundColor: t.bgSurface,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderSubtle,
      padding: 14,
      gap: 6,
    },
    cardTitle: { color: t.textPrimary, fontSize: 15, fontWeight: '700' },
    chartHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    segRow: { flexDirection: 'row' },
    // 分段控件沿用 study 屏 modeChip 既有风格
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
    weekRow: { flexDirection: 'row', gap: 2, alignItems: 'flex-end' },
    dayCol: { flex: 1, alignItems: 'center', gap: 4 },
    dayCount: { color: t.textSecondary, fontSize: 9, fontVariant: ['tabular-nums'] },
    dayBarTrack: { height: 48, width: '70%', justifyContent: 'flex-end' },
    dayBar: { width: '100%', borderRadius: 3 },
    dayLabel: { color: t.textMuted, fontSize: 9 },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
    headword: { color: t.textPrimary, fontSize: 17, fontWeight: '700' },
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
    time: { color: t.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rating: { color: t.textSecondary, fontSize: 13, fontWeight: '600' },
    ratingAgain: { color: t.destructive },
    practiceBadge: {
      color: t.textSecondary,
      backgroundColor: t.bgSurfaceElevated,
      fontSize: 11,
      fontWeight: '700',
      borderRadius: 5,
      overflow: 'hidden',
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    defZh: { color: t.textMuted, fontSize: 12, lineHeight: 18 },
    centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 60 },
    doneTitle: { color: t.textPrimary, fontSize: 19, fontWeight: '800' },
    doneSub: { color: t.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
    error: { color: t.destructive, fontSize: 12 },
  });
}
