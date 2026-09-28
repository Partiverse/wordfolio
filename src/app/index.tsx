import * as Speech from 'expo-speech';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/tokens';
import { readReleaseMeta, searchSenses, type ReleaseMeta, type SearchHit } from '@/db/release';

export default function SpikeScreen() {
  const t = useTheme();
  const styles = makeStyles(t);

  const [meta, setMeta] = useState<ReleaseMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    readReleaseMeta()
      .then(setMeta)
      .catch((e) => setError(String(e)));
  }, []);

  const runSearch = useCallback(async (q: string) => {
    setSearching(true);
    try {
      setHits(await searchSenses(q));
    } catch (e) {
      setError(String(e));
    } finally {
      setSearching(false);
    }
  }, []);

  const speak = useCallback((text: string, lang: 'en-US' | 'zh-CN') => {
    Speech.speak(text, { language: lang, rate: lang === 'zh-CN' ? 0.95 : 0.9 });
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.h1}>Wordfolio T0 Spikes</Text>

      {/* S1/S3：发布物 DB 状态（含 FTS5 可用性） */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>S1/S3 · 发布物 DB</Text>
        {error ? (
          <Text style={[styles.mono, { color: t.destructive }]}>{error}</Text>
        ) : meta ? (
          <>
            <Row k="edition" v={meta.edition} s={styles} />
            <Row k="generated" v={meta.generatedAt} s={styles} />
            <Row k="words / senses" v={`${meta.wordCount} / ${meta.senseCount}`} s={styles} />
            <View style={styles.row}>
              <Text style={styles.k}>FTS5 available</Text>
              <Text style={[styles.v, { color: meta.fts5Available ? t.accentSuccess : t.destructive }]}>
                {meta.fts5Available ? 'YES' : 'NO'}
              </Text>
            </View>
          </>
        ) : (
          <ActivityIndicator color={t.primary} />
        )}
      </View>

      {/* S1：FTS5 检索 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>S1 · FTS5 检索</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="英文词头或中文释义…"
            placeholderTextColor={t.textMuted}
            onSubmitEditing={() => runSearch(query)}
            autoCapitalize="none"
          />
          <Pressable style={styles.btn} onPress={() => runSearch(query)} disabled={searching}>
            <Text style={styles.btnText}>{searching ? '…' : '搜索'}</Text>
          </Pressable>
        </View>
        <FlatList
          data={hits}
          keyExtractor={(h) => h.stableId}
          style={styles.hits}
          renderItem={({ item }) => (
            <View style={styles.hit}>
              <Text style={styles.hitHead}>
                {item.headword} <Text style={styles.pos}>{item.pos}</Text>
              </Text>
              <Text style={styles.hitDef} numberOfLines={2}>
                {item.definitionZh}
              </Text>
              <View style={styles.hitActions}>
                <Pressable onPress={() => speak(item.headword, 'en-US')} hitSlop={8}>
                  <Text style={[styles.link, styles.linkEn]}>🔊 EN</Text>
                </Pressable>
                <Pressable onPress={() => speak(item.definitionZh, 'zh-CN')} hitSlop={8}>
                  <Text style={[styles.link, styles.linkZh]}>🔊 中文</Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={
            !searching ? <Text style={styles.muted}>无结果（试试 run / 走 / apple）</Text> : null
          }
        />
      </View>

      {/* S2：TTS 直测 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>S2 · expo-speech TTS</Text>
        <View style={styles.ttsRow}>
          <Pressable style={styles.btn} onPress={() => speak('serendipity', 'en-US')}>
            <Text style={styles.btnText}>Speak EN</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={() => speak('意外发现的乐趣', 'zh-CN')}>
            <Text style={styles.btnText}>Speak 中文</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Row({ k, v, s }: { k: string; v: string; s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={s.row}>
      <Text style={s.k}>{k}</Text>
      <Text style={s.v}>{v}</Text>
    </View>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background, padding: 16, gap: 14 },
    h1: { fontSize: 22, fontWeight: '700', color: t.foreground },
    card: {
      backgroundColor: t.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      padding: 14,
      gap: 10,
    },
    cardTitle: { fontSize: 13, fontWeight: '600', color: t.mutedForeground, letterSpacing: 0.3 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    k: { color: t.textSecondary, fontSize: 14 },
    v: { color: t.foreground, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
    mono: { fontFamily: 'Menlo', fontSize: 12 },
    searchRow: { flexDirection: 'row', gap: 8 },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: t.input,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: t.foreground,
      fontSize: 15,
    },
    btn: {
      backgroundColor: t.primary,
      borderRadius: 10,
      paddingHorizontal: 16,
      justifyContent: 'center',
    },
    btnText: { color: t.primaryForeground, fontWeight: '600' },
    hits: { maxHeight: 260 },
    hit: {
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderSubtle,
      gap: 2,
    },
    hitHead: { color: t.foreground, fontWeight: '700', fontSize: 15 },
    pos: { color: t.accentPrimary, fontWeight: '500', fontSize: 12 },
    hitDef: { color: t.textSecondary, fontSize: 13 },
    hitActions: { flexDirection: 'row', gap: 14 },
    linkEn: { color: t.accentPrimary },
    linkZh: { color: t.accentWarning },
    link: { fontSize: 12, fontWeight: '600' },
    muted: { color: t.textMuted, fontSize: 13 },
    ttsRow: { flexDirection: 'row', gap: 8 },
  });
}
