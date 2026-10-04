import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';

import { ChevronBackIcon, DownloadIcon, SaveIcon } from '@/components/icons';
import { PlayToast } from '@/components/PlayToast';
import { readReleaseMeta, type ReleaseMeta } from '@/db/release';
import { exportLearningData, importLearningData } from '@/db/study';
import { usePlayStatus } from '@/stores/playStatus';
import { useTheme } from '@/theme/tokens';

// 备份文件固定放应用文档目录（与发音缓存同域，用户可经系统文件可见性访问）
const BACKUP_FILE = 'wordfolio-backup.json';

// 关于页（M-D「edition 更新机制展示」）：app 版本 + 词库发布物元信息 + 隐私说明。
// 词库数据全部来自打包内 wordfolio.db 的 meta 表（readReleaseMeta），不写死数值。
export default function AboutScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const router = useRouter();

  const [meta, setMeta] = useState<ReleaseMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 导出/导入进行中标记：防止并发触发（两操作共用学习库连接）
  const [busy, setBusy] = useState<null | 'export' | 'import'>(null);
  const showFeedback = usePlayStatus((s) => s.show);

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

  async function handleExport() {
    if (busy) return;
    setBusy('export');
    try {
      const json = await exportLearningData();
      await FileSystem.writeAsStringAsync(FileSystem.documentDirectory + BACKUP_FILE, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      showFeedback(`已导出 ${countRows(json)} 条学习记录到 ${BACKUP_FILE}`);
    } catch (e) {
      showFeedback(`导出失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleImport() {
    if (busy) return;
    setBusy('import');
    try {
      const path = FileSystem.documentDirectory + BACKUP_FILE;
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) {
        showFeedback(`未找到 ${BACKUP_FILE}，请先导出或把备份文件放到应用文档目录`);
        return;
      }
      const json = await FileSystem.readAsStringAsync(path);
      const result = await importLearningData(json);
      const c = result.counts;
      const imported = c.favorite.imported + c.review_card.imported + c.review_log.imported
        + c.daily_goal.imported + c.settings.imported;
      const skipped = c.favorite.skipped + c.review_card.skipped + c.review_log.skipped
        + c.daily_goal.skipped + c.settings.skipped;
      showFeedback(`导入完成：新增 ${imported} 条，跳过已存在 ${skipped} 条`);
    } catch (e) {
      // 畸形 JSON / 结构非法在这里被捕获（解析层抛出）
      showFeedback(`导入失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

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
          <Text style={styles.cardHint}>例句来自 Tatoeba（CC-BY 4.0）</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>数据</Text>
          <Pressable
            onPress={handleExport}
            disabled={busy !== null}
            style={({ pressed }) => [styles.actionRow, (pressed || busy !== null) && styles.actionPressed]}
            accessibilityRole="button"
            accessibilityLabel="导出学习数据"
          >
            <SaveIcon color={t.accentPrimary} size={20} />
            <View style={styles.actionText}>
              <Text style={styles.actionLabel}>{busy === 'export' ? '导出中…' : '导出学习数据'}</Text>
              <Text style={styles.actionHint}>写入本机 {BACKUP_FILE}</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={handleImport}
            disabled={busy !== null}
            style={({ pressed }) => [styles.actionRow, (pressed || busy !== null) && styles.actionPressed]}
            accessibilityRole="button"
            accessibilityLabel="从备份导入"
          >
            <DownloadIcon color={t.accentPrimary} size={20} />
            <View style={styles.actionText}>
              <Text style={styles.actionLabel}>{busy === 'import' ? '导入中…' : '从备份导入'}</Text>
              <Text style={styles.actionHint}>读取 {BACKUP_FILE}，已存在的记录跳过</Text>
            </View>
          </Pressable>
          <Text style={styles.cardHint}>
            备份保存在应用文档目录；导入为合并式——同主键记录跳过，不覆盖现有学习记录。
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>隐私</Text>
          <Text style={styles.privacyText}>完全离线，数据仅存本机。</Text>
          <Text style={styles.cardHint}>
            词库打包在安装包内，学习记录只写入设备本地数据库；没有任何账号、上报或联网同步。
          </Text>
        </View>
      </ScrollView>
      <PlayToast />
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

/** 导出串统计总行数（仅用于结果提示；解析失败不影响已写出的文件）。 */
function countRows(json: string): number {
  try {
    const data = (JSON.parse(json) as { data: Record<string, unknown[]> }).data;
    return Object.values(data).reduce((n, rows) => n + rows.length, 0);
  } catch {
    return 0;
  }
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
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 44,
      paddingVertical: 4,
    },
    actionPressed: { opacity: 0.6 },
    actionText: { flex: 1, gap: 2 },
    // 可点文本走蓝（tokens §8 交互语义）
    actionLabel: { color: t.accentPrimary, fontSize: 14, fontWeight: '600' },
    actionHint: { color: t.textMuted, fontSize: 12 },
  });
}
