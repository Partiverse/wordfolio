import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { FilterChips, type Chip } from '@/components/FilterChips';
import { SearchIcon, StarIcon } from '@/components/icons';
import { TtsBanner } from '@/components/TtsHint';
import { WordCard } from '@/components/WordCard';
import { browseEntries, searchSenses, type BrowseFilters, type BrowseItem } from '@/db/repository';
import type { SearchHit } from '@/db/release';
import { isTooShort } from '@/db/search';
import { useFavorites } from '@/stores/favorites';
import { useTheme } from '@/theme/tokens';

const PAGE_SIZE = 50;
// 词性筛选只暴露高频项（14 个铺满一屏既难用又挤）
const VISIBLE_POS = ['n', 'v', 'adj', 'adv', 'prep', 'conj'] as const;

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
  const [favOnly, setFavOnly] = useState(false);

  const { ids: favoriteIds, hydrate, toggle } = useFavorites();
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // null = 尚未加载（派生 loading）
  const [browse, setBrowse] = useState<BrowsePageState | null>(null);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const offsetRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const searching = debounced.trim().length > 0;
  const queryTooShort = searching && isTooShort(debounced);
  const total = browse?.total ?? 0;
  const loadingBrowse = !searching && browse === null;
  const loadingSearch = searching && hits === null;

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // 筛选对象分别 memo，避免点星标之类无关状态触发浏览重载
  const posFilters = useMemo<BrowseFilters>(() => ({ pos }), [pos]);
  const favFilters = useMemo<BrowseFilters>(
    () => ({ entryIds: [...favoriteIds], pos }),
    [favoriteIds, pos],
  );
  const filters = favOnly ? favFilters : posFilters;

  useEffect(() => {
    if (searching) return;
    let alive = true;
    offsetRef.current = 0;
    browseEntries(0, PAGE_SIZE, filters)
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
  }, [searching, filters]);

  useEffect(() => {
    if (!searching || queryTooShort) return;
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
  }, [searching, queryTooShort, debounced]);

  const loadMore = useCallback(() => {
    if (searching || loadingMoreRef.current || offsetRef.current >= total) return;
    loadingMoreRef.current = true;
    browseEntries(offsetRef.current, PAGE_SIZE, filters)
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
  }, [searching, total, filters]);

  const chips: Chip[] = useMemo(
    () => [
      { label: '全部', value: null },
      { label: '收藏', value: '__fav__' },
      ...VISIBLE_POS.map((p) => ({ label: p, value: p })),
    ],
    [],
  );
  const activeChip = favOnly ? '__fav__' : pos;
  const onChipChange = useCallback((value: string | null) => {
    if (value === '__fav__') {
      setFavOnly(true);
      return;
    }
    setFavOnly(false);
    setPos(value);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleCol}>
          <Text style={styles.h1}>词库</Text>
          <Text style={styles.subtitle}>
            {searching
              ? `${hits?.length ?? 0} 条结果`
              : favOnly
                ? `${browse?.total ?? 0} 条收藏`
                : `${browse?.total ?? 0} 词 · v0.1-m1`}
          </Text>
        </View>
        {favoriteIds.size > 0 ? (
          <View style={styles.favCount}>
            <StarIcon color={t.primary} size={14} />
            <Text style={styles.favCountText}>{favoriteIds.size}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.searchWrap}>
        <SearchIcon color={t.textMuted} size={18} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="搜索词头或中文释义"
          placeholderTextColor={t.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable
            onPress={() => setQuery('')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="清空搜索"
          >
            <Ionicons name="close-circle" size={18} color={t.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <TtsBanner />

      <FilterChips chips={chips} active={activeChip} onChange={onChipChange} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {queryTooShort ? (
        <Text style={styles.hint}>英文至少输入 2 个字母；中文可直接搜单字（如「走」）</Text>
      ) : searching ? (
        <FlatList
          data={hits ?? []}
          keyExtractor={(h) => h.stableId}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={loadingSearch} tintColor={t.primary} />}
          renderItem={({ item }) => <SearchHitRow hit={item} onPress={() => router.push(`/entry/${item.entryId}`)} />}
          ListEmptyComponent={
            !loadingSearch ? <Text style={styles.muted}>没有匹配的义项，换个词试试</Text> : null
          }
        />
      ) : (
        <FlatList
          data={browse?.items ?? []}
          keyExtractor={(it) => String(it.entryId)}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          refreshControl={<RefreshControl refreshing={loadingBrowse} tintColor={t.primary} />}
          renderItem={({ item }) => (
            <WordCard
              item={item}
              favorite={favoriteIds.has(item.entryId)}
              onPress={(entryId) => router.push(`/entry/${entryId}`)}
              onToggleFavorite={toggle}
            />
          )}
          ListEmptyComponent={
            favOnly && !loadingBrowse ? (
              <Text style={styles.muted}>还没有收藏，点卡片右上角星标收起来</Text>
            ) : !loadingBrowse ? (
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
    safe: { flex: 1, backgroundColor: t.bgCanvas, paddingHorizontal: 16, gap: 12 },
    header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 8 },
    titleCol: { gap: 2 },
    h1: { fontSize: 26, fontWeight: '800', color: t.textPrimary },
    subtitle: { fontSize: 13, color: t.textMuted },
    favCount: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 2 },
    favCountText: { color: t.textSecondary, fontSize: 13, fontWeight: '600' },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: t.bgSurface,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderStrong,
      paddingHorizontal: 12,
      height: 48,
    },
    input: { flex: 1, color: t.textPrimary, fontSize: 16, height: 48 },
    list: { paddingBottom: 24, gap: 12 },
    gridRow: { gap: 12 },
    pressed: { opacity: 0.7 },
    hit: {
      backgroundColor: t.bgSurface,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderSubtle,
      padding: 14,
      gap: 4,
    },
    hitTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    hitHead: { color: t.textPrimary, fontWeight: '700', fontSize: 15 },
    hitPos: { color: t.textMuted, fontSize: 12, fontWeight: '600' },
    hitDef: { color: t.textSecondary, fontSize: 13 },
    error: { color: t.destructive, fontSize: 12 },
    hint: { color: t.textMuted, fontSize: 13, paddingVertical: 16 },
    muted: { color: t.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  });
}
