import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { WordCard } from '@/components/WordCard';
import { browseEntries, searchSenses, type BrowseItem } from '@/db/repository';
import type { SearchHit } from '@/db/release';
import { POS_OPTIONS } from '@/db/repository';
import { useTheme } from '@/theme/tokens';

const PAGE_SIZE = 50;

interface BrowsePageState {
  items: BrowseItem[];
  total: number;
}

export default function BrowseScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [pos, setPos] = useState<string | null>(null);

  // null = 尚未加载（派生 loading），加载后始终持有数据
  const [browse, setBrowse] = useState<BrowsePageState | null>(null);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const offsetRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const searching = debounced.trim().length > 0;
  const total = browse?.total ?? 0;
  const loadingBrowse = !searching && browse === null;
  const loadingSearch = searching && hits === null;

  // 搜索防抖 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // 浏览列表：筛选变化时重载首页（setState 只出现在异步回调中）。
  // 注：v0.1-m1 尚无 CEFR 标注（entry.cefr 全 NULL），UI 只暴露词性筛选；
  // repository 的 cefr 参数留给后续带标注的发布物。
  useEffect(() => {
    if (searching) return;
    let alive = true;
    browseEntries(0, PAGE_SIZE, { pos })
      .then((page) => {
        if (!alive) return;
        setBrowse({ items: page.items, total: page.total });
        offsetRef.current = page.items.length;
        setError(null);
      })
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [searching, pos]);

  // 搜索（中文走 LIKE 回退，拉丁走 FTS，见 src/db/repository.ts）
  useEffect(() => {
    if (!searching) return;
    let alive = true;
    searchSenses(debounced)
      .then((h) => {
        if (!alive) return;
        setHits(h);
        setError(null);
      })
      .catch((e) => {
        if (!alive) return;
        setHits([]);
        setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, [searching, debounced]);

  const loadMore = useCallback(() => {
    if (searching || loadingMoreRef.current || offsetRef.current >= total) return;
    loadingMoreRef.current = true;
    browseEntries(offsetRef.current, PAGE_SIZE, { pos })
      .then((page) => {
        setBrowse((prev) =>
          prev
            ? { items: [...prev.items, ...page.items], total: prev.total }
            : { items: page.items, total: page.total },
        );
        offsetRef.current += page.items.length;
      })
      .catch((e) => setError(String(e)))
      .finally(() => {
        loadingMoreRef.current = false;
      });
  }, [searching, total, pos]);

  const openEntry = useCallback(
    (entryId: number) => router.push(`/entry/${entryId}`),
    [router],
  );

  const renderChip = (label: string, active: boolean, onPress: () => void) => (
    <Pressable key={label} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );

  if (error && !browse && !hits) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.h1}>Wordfolio</Text>
        <Text style={styles.error}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.h1}>Wordfolio</Text>
        <Text style={styles.subtitle}>
          {searching
            ? `${hits?.length ?? 0} 条搜索结果`
            : `${browse?.total ?? 0} 词 · v0.1-m1`}
        </Text>
      </View>

      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="搜词头或中文释义（如 run / 走）…"
        placeholderTextColor={t.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {!searching && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {renderChip('全部词性', pos === null, () => setPos(null))}
          {POS_OPTIONS.map((p) => renderChip(p, pos === p, () => setPos(p)))}
        </ScrollView>
      )}

      {searching ? (
        <FlatList
          key="search-list"
          data={hits ?? []}
          keyExtractor={(h) => h.stableId}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={loadingSearch} tintColor={t.primary} />}
          renderItem={({ item }) => (
            <SearchHitRow hit={item} onPress={() => openEntry(item.entryId)} />
          )}
          ListEmptyComponent={
            !loadingSearch ? <Text style={styles.muted}>无结果，试试别的关键词</Text> : null
          }
        />
      ) : (
        <FlatList
          key="browse-list"
          data={browse?.items ?? []}
          keyExtractor={(it) => String(it.entryId)}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          refreshControl={
            <RefreshControl refreshing={loadingBrowse} tintColor={t.primary} />
          }
          renderItem={({ item }) => <WordCard item={item} onPress={openEntry} />}
          ListEmptyComponent={
            !loadingBrowse ? (
              <Text style={styles.muted}>没有词条</Text>
            ) : (
              <ActivityIndicator color={t.primary} />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

function SearchHitRow({ hit, onPress }: { hit: SearchHit; onPress: () => void }) {
  const t = useTheme();
  const styles = makeStyles(t);
  return (
    <Pressable style={({ pressed }) => [styles.hit, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.hitTop}>
        <Text style={styles.hitHead}>{hit.headword}</Text>
        <Text style={styles.hitPos}>{hit.pos}</Text>
      </View>
      <Text style={styles.hitDef} numberOfLines={2}>
        {hit.definitionZh}
      </Text>
    </Pressable>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background, paddingHorizontal: 16 },
    header: { paddingTop: 8, paddingBottom: 10, gap: 2 },
    h1: { fontSize: 24, fontWeight: '800', color: t.foreground },
    subtitle: { fontSize: 13, color: t.mutedForeground },
    input: {
      borderWidth: 1,
      borderColor: t.input,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: t.foreground,
      fontSize: 15,
      backgroundColor: t.card,
      marginBottom: 10,
    },
    chipRow: { flexGrow: 0, marginBottom: 8 },
    chip: {
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      backgroundColor: t.card,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginRight: 8,
    },
    chipActive: { backgroundColor: t.primary, borderColor: t.primary },
    chipText: { color: t.textSecondary, fontSize: 13, fontWeight: '600' },
    chipTextActive: { color: t.primaryForeground },
    list: { paddingBottom: 24, gap: 10 },
    gridRow: { gap: 10 },
    pressed: { opacity: 0.7 },
    hit: {
      backgroundColor: t.card,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      padding: 12,
      gap: 4,
    },
    hitTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    hitHead: { color: t.foreground, fontWeight: '700', fontSize: 15 },
    hitPos: { color: t.accentPrimary, fontSize: 12, fontWeight: '500' },
    hitDef: { color: t.textSecondary, fontSize: 13 },
    error: { color: t.destructive, fontSize: 12, marginBottom: 6 },
    muted: { color: t.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  });
}
