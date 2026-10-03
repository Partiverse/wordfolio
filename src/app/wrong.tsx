import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ChevronBackIcon, VolumeIcon } from '@/components/icons';
import { getWrongBook, type WrongBookItem } from '@/db/study';
import { getStudySenses, type StudySense } from '@/db/repository';
import { playWordAudio, prefetchWordAudio } from '@/utils/wordAudio';
import { useTheme } from '@/theme/tokens';

// 错题本：最近一次评分仍是「重来」的义项（逻辑树 §6 槽位：依赖 review_log）。
export default function WrongBookScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const router = useRouter();

  const [items, setItems] = useState<WrongBookItem[] | null>(null);
  const [senses, setSenses] = useState<Map<string, StudySense>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getWrongBook()
      .then(async (rows) => {
        const content = await getStudySenses(rows.map((r) => r.stableId));
        if (!alive) return;
        setItems(rows);
        setSenses(content);
        // 预取错题词头音频（错题本不大，点开即响）
        for (const r of rows.slice(0, 12)) {
          const w = content.get(r.stableId)?.headword;
          if (w) prefetchWordAudio(w);
        }
      })
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, []);

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
        <Text style={styles.h1}>错题本</Text>
        <Text style={styles.subtitle}>
          {items ? `${items.length} 个义项最近一次没记住` : '加载中…'}
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {items === null ? (
        <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.doneTitle}>没有错题</Text>
          <Text style={styles.doneSub}>
            复习时选「重来」的义项会收进这里；答对一次就自动移出。
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.map((item) => {
            const sense = senses.get(item.stableId);
            if (!sense) return null;
            return (
              <View key={item.stableId} style={styles.card}>
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
                  <Text style={styles.lapses}>忘 {item.lapses} 次</Text>
                </View>
                <Text style={styles.defZh} numberOfLines={2}>
                  {sense.labelZh ?? sense.definitionZh}
                </Text>
                <Text style={styles.defEn} numberOfLines={1}>
                  {sense.definitionEn}
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
    lapses: { color: t.accentWarning, fontSize: 12, fontWeight: '600' },
    defZh: { color: t.textPrimary, fontSize: 14, lineHeight: 20 },
    defEn: { color: t.textMuted, fontSize: 12, lineHeight: 18 },
    centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 60 },
    doneTitle: { color: t.textPrimary, fontSize: 19, fontWeight: '800' },
    doneSub: { color: t.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
    error: { color: t.destructive, fontSize: 12 },
  });
}
