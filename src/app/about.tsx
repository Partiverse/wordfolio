import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

import { ChevronBackIcon } from '@/components/icons';
import { readReleaseMeta, type ReleaseMeta } from '@/db/release';
import { useTheme } from '@/theme/tokens';

// 关于页（M-D「edition 更新机制展示」）：app 版本 + 词库发布物元信息 + 隐私说明。
// 词库数据全部来自打包内 wordfolio.db 的 meta 表（readReleaseMeta），不写死数值。
export default function AboutScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const router = useRouter();

  const [meta, setMeta] = useState<ReleaseMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    readReleaseMeta()
      .then((m) => alive && setMeta(m))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, []);

  const appVersion = Constants.expoConfig?.version ?? '未知';

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
        <Text style={styles.h1}>关于</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>版本</Text>
          <Row label="Wordfolio" value={appVersion} styles={styles} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>词库</Text>
          {error ? (
            <Text style={styles.errorText}>词库信息加载失败：{error}</Text>
          ) : meta ? (
            <>
              <Row label="发布物" value={meta.edition} styles={styles} />
              <Row label="生成日期" value={meta.generatedAt} styles={styles} />
              <Row label="规模" value={`${meta.wordCount} 词 / ${meta.senseCount} 义项`} styles={styles} />
            </>
          ) : (
            <Text style={styles.pendingText}>加载中…</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>隐私</Text>
          <Text style={styles.privacyText}>完全离线，数据仅存本机。</Text>
          <Text style={styles.cardHint}>
            词库打包在安装包内，学习记录只写入设备本地数据库；没有任何账号、上报或联网同步。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bgCanvas, paddingHorizontal: 16 },
    header: { paddingTop: 8, paddingBottom: 12, gap: 6 },
    back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', paddingVertical: 8 },
    backText: { color: t.textSecondary, fontSize: 15, fontWeight: '600' },
    h1: { fontSize: 26, fontWeight: '800', color: t.textPrimary },
    scroll: { paddingBottom: 32, gap: 12 },
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
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rowLabel: { color: t.textSecondary, fontSize: 14 },
    rowValue: { color: t.textPrimary, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
    privacyText: { color: t.textPrimary, fontSize: 14, fontWeight: '600' },
    pendingText: { color: t.textMuted, fontSize: 13 },
    errorText: { color: t.destructive, fontSize: 13, lineHeight: 19 },
  });
}
