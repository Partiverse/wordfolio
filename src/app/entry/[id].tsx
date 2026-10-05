import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { SenseCard } from '@/components/SenseCard';
import { MorphemeCard } from '@/components/MorphemeCard';
import { ChevronBackIcon, StarIcon, StarOutlineIcon, VolumeIcon } from '@/components/icons';
import { PlayToast } from '@/components/PlayToast';
import { TtsBanner } from '@/components/TtsHint';
import { getEntryDetail, type EntryDetail } from '@/db/repository';
import { useFavorites } from '@/stores/favorites';
import { playWordAudio, prefetchWordAudio } from '@/utils/wordAudio';
import { useTheme } from '@/theme/tokens';

export default function EntryDetailScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const entryId = Number(id);
  const invalidId = !Number.isInteger(entryId);

  // null = 加载中；错误与「不存在」都落在 error
  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { ids: favoriteIds, hydrate, toggle } = useFavorites();
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (invalidId) return;
    let alive = true;
    getEntryDetail(entryId)
      .then((e) => {
        if (!alive) return;
        if (!e) setError('词条不存在');
        else {
          setEntry(e);
          if (e.headword) prefetchWordAudio(e.headword);
        }
      })
      .catch((err) => alive && setError(String(err)));
    return () => {
      alive = false;
    };
  }, [invalidId, entryId]);

  if (invalidId) {
    return (
      <SafeAreaView style={styles.safe}>
        <BackButton onPress={() => router.back()} styles={styles} />
        <Text style={styles.error}>无效词条 id: {id}</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <BackButton onPress={() => router.back()} styles={styles} />
        <Text style={styles.error}>{error}</Text>
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <BackButton onPress={() => router.back()} styles={styles} />

        {/* 词条头：词头 / IPA / 徽标 / 点读 */}
        <View style={styles.headerCard}>
          <View style={styles.titleRow}>
            <Text style={styles.headword}>{entry.headword}</Text>
            <View style={styles.titleIcons}>
              <Pressable
                onPress={() => toggle(entry.entryId)}
                hitSlop={12}
                accessible
                accessibilityLabel={favoriteIds.has(entry.entryId) ? '取消收藏' : '收藏'}
              >
                {favoriteIds.has(entry.entryId) ? (
                  <StarIcon color={t.primary} size={24} />
                ) : (
                  <StarOutlineIcon color={t.textMuted} size={24} />
                )}
              </Pressable>
              <Pressable onPress={() => void playWordAudio(entry.headword)} hitSlop={10} accessibilityLabel="播放词头发音">
                <VolumeIcon color={t.textSecondary} size={22} />
              </Pressable>
            </View>
          </View>
          <View style={styles.badgeRow}>
            {entry.ipaBr ? (
              <Pressable onPress={() => void playWordAudio(entry.headword)} hitSlop={6}>
                <Text style={styles.ipa}>英 /{entry.ipaBr}/</Text>
              </Pressable>
            ) : null}
            {entry.ipaAm ? (
              <Pressable onPress={() => void playWordAudio(entry.headword)} hitSlop={6}>
                <Text style={styles.ipa}>美 /{entry.ipaAm}/</Text>
              </Pressable>
            ) : null}
            {entry.cefr ? <Text style={styles.badge}>{entry.cefr}</Text> : null}
            {entry.isOxford3000 ? <Text style={styles.badge}>Oxford3000</Text> : null}
            {entry.collinsStar ? <Text style={styles.badge}>{'★'.repeat(entry.collinsStar)}</Text> : null}
          </View>
          {entry.forms.length ? (
            <Text style={styles.forms}>
              词形：{entry.forms.map((f) => f.form).join(' · ')}
            </Text>
          ) : null}
          {entry.etymologyZh ? <Text style={styles.etym}>{entry.etymologyZh}</Text> : null}
        </View>

        {/* 词根词缀：发布物 morpheme 表有数据才渲染，无数据整块隐藏 */}
        {entry.morphemes.length ? <MorphemeCard morphemes={entry.morphemes} /> : null}

        {/* 义项卡列表 */}
        <View style={styles.senseList}>
          {entry.senses.map((sense) => (
            <SenseCard key={sense.stableId} sense={sense} />
          ))}
        </View>

        <TtsBanner />

        <PlayToast />
      </ScrollView>
    </SafeAreaView>
  );
}

function BackButton({
  onPress,
  styles,
}: {
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={styles.back}
      accessibilityRole="button"
      accessibilityLabel="返回"
    >
      <ChevronBackIcon color={t.textSecondary} size={20} />
      <Text style={styles.backText}>返回</Text>
    </Pressable>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bgCanvas, paddingHorizontal: 16 },
    scroll: { paddingBottom: 32, gap: 12 },
    back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', paddingVertical: 8 },
    backText: { color: t.textSecondary, fontSize: 15, fontWeight: '600' },
    error: { color: t.destructive, fontSize: 14, marginTop: 24 },
    headerCard: {
      backgroundColor: t.bgSurface,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderSubtle,
      padding: 16,
      gap: 8,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    titleIcons: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    headword: { color: t.textPrimary, fontSize: 28, fontWeight: '800', flexShrink: 1 },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    ipa: { color: t.textSecondary, fontSize: 14 },
    badge: {
      color: t.textSecondary,
      backgroundColor: t.bgSurfaceElevated,
      fontSize: 11,
      fontWeight: '700',
      borderRadius: 5,
      overflow: 'hidden',
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    forms: { color: t.textSecondary, fontSize: 13 },
    etym: { color: t.textMuted, fontSize: 13, lineHeight: 19 },
    senseList: { gap: 12 },
  });
}
