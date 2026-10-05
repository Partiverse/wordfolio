import { StyleSheet, Text, View } from 'react-native';

import { LayersIcon } from '@/components/icons';
import type { MorphemeDetail } from '@/db/repository';
import { morphemeKindZh } from '@/db/morpheme-core';
import { useTheme } from '@/theme/tokens';

// 词根词缀区块（F2）：详情页展示该词条关联的 morpheme，复用义项卡/tile 卡片风格。
// 无数据时由调用方整个隐藏（当前发布物 morpheme 表为空，数据灌入后自动出现）。
export function MorphemeCard({ morphemes }: { morphemes: MorphemeDetail[] }) {
  const t = useTheme();
  const styles = makeStyles(t);

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <LayersIcon color={t.textSecondary} size={16} />
        <Text style={styles.title}>词根词缀</Text>
      </View>
      {morphemes.map((m, i) => (
        <View key={`${m.morpheme}-${i}`} style={styles.row}>
          <Text style={styles.kind}>{morphemeKindZh(m.kind)}</Text>
          <Text style={styles.morpheme}>{m.morpheme}</Text>
          {m.glossZh ? <Text style={styles.gloss}>{m.glossZh}</Text> : null}
          {m.origin ? <Text style={styles.origin}>{m.origin}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: {
      backgroundColor: t.bgSurface,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderSubtle,
      padding: 16,
      gap: 10,
    },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: { color: t.textSecondary, fontSize: 13, fontWeight: '700' },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      gap: 8,
      backgroundColor: t.bgSurfaceElevated,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    kind: {
      color: t.textSecondary,
      backgroundColor: t.bgCanvas,
      fontSize: 11,
      fontWeight: '700',
      borderRadius: 5,
      overflow: 'hidden',
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    morpheme: { color: t.textPrimary, fontSize: 15, fontWeight: '700' },
    gloss: { color: t.textPrimary, fontSize: 13, flexShrink: 1 },
    origin: { color: t.textMuted, fontSize: 12 },
  });
}
