import { Pressable, StyleSheet, Text, View } from 'react-native';

import { speakEn, speakZh } from '@/utils/speech';
import type { SenseDetail } from '@/db/repository';
import { useTheme } from '@/theme/tokens';

// 义项卡：词性徽标 + 中文标签 + 英文定义 + 中文释义 + 例句（可点读）。
export function SenseCard({ sense }: { sense: SenseDetail }) {
  const t = useTheme();
  const styles = makeStyles(t);

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Text style={styles.pos}>{sense.pos}</Text>
        {sense.labelZh ? <Text style={styles.label}>{sense.labelZh}</Text> : null}
      </View>
      <Pressable onPress={() => speakEn(sense.definitionEn)} hitSlop={6}>
        <Text style={styles.defEn}>{sense.definitionEn}</Text>
      </Pressable>
      <Pressable onPress={() => speakZh(sense.definitionZh)} hitSlop={6}>
        <Text style={styles.defZh}>{sense.definitionZh}</Text>
      </Pressable>
      {sense.grammarPattern ? <Text style={styles.pattern}>{sense.grammarPattern}</Text> : null}
      {sense.examples.map((ex, i) => (
        <View key={i} style={styles.example}>
          <Pressable onPress={() => speakEn(ex.textEn)} hitSlop={6}>
            <Text style={styles.exEn}>{ex.textEn}</Text>
          </Pressable>
          {ex.textZh ? (
            <Pressable onPress={() => ex.textZh && speakZh(ex.textZh)} hitSlop={6}>
              <Text style={styles.exZh}>{ex.textZh}</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: {
      backgroundColor: t.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      padding: 14,
      gap: 8,
    },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pos: {
      color: t.primaryForeground,
      backgroundColor: t.primary,
      fontSize: 11,
      fontWeight: '700',
      borderRadius: 6,
      overflow: 'hidden',
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    label: { color: t.foreground, fontWeight: '700', fontSize: 15, flexShrink: 1 },
    defEn: { color: t.textSecondary, fontSize: 14, lineHeight: 20 },
    defZh: { color: t.foreground, fontSize: 15, lineHeight: 21, fontWeight: '500' },
    pattern: {
      color: t.mutedForeground,
      fontSize: 12,
      backgroundColor: t.muted,
      alignSelf: 'flex-start',
      borderRadius: 6,
      overflow: 'hidden',
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    example: {
      borderLeftWidth: 2,
      borderColor: t.borderStrong,
      paddingLeft: 10,
      gap: 2,
      marginTop: 2,
    },
    exEn: { color: t.textSecondary, fontSize: 13, lineHeight: 19 },
    exZh: { color: t.textMuted, fontSize: 12, lineHeight: 18 },
  });
}
