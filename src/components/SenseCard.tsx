import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';

import { VolumeIcon } from '@/components/icons';
import type { SenseDetail } from '@/db/repository';
import { speakEn, speakZh } from '@/utils/speech';
import { useTheme } from '@/theme/tokens';

/** 可朗读行：文本 + 喇叭图标（emoji 替代品），点击朗读。 */
function Speakable({
  text,
  lang,
  style,
}: {
  text: string;
  lang: 'en' | 'zh';
  style: TextStyle;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => (lang === 'en' ? speakEn(text) : speakZh(text))}
      style={({ pressed }) => [styles_line.pressable, pressed && styles_line.pressed]}
      accessibilityRole="button"
      accessibilityLabel={lang === 'en' ? '朗读英文' : '朗读中文'}
    >
      <Text style={style}>{text}</Text>
      <VolumeIcon color={t.textMuted} size={14} />
    </Pressable>
  );
}

const styles_line = StyleSheet.create({
  pressable: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pressed: { opacity: 0.6 },
});

// 义项卡：词性徽标 + 中英定义 + 例句，每行右侧配喇叭图标（替代 emoji）。
export function SenseCard({ sense }: { sense: SenseDetail }) {
  const t = useTheme();
  const styles = makeStyles(t);

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Text style={styles.pos}>{sense.pos}</Text>
        {sense.labelZh ? <Text style={styles.label}>{sense.labelZh}</Text> : null}
      </View>

      <Speakable text={sense.definitionEn} lang="en" style={styles.defEn} />
      <Speakable text={sense.definitionZh} lang="zh" style={styles.defZh} />

      {sense.grammarPattern ? <Text style={styles.pattern}>{sense.grammarPattern}</Text> : null}

      {sense.examples.map((ex, i) => (
        <View key={i} style={styles.example}>
          <Speakable text={ex.textEn} lang="en" style={styles.exEn} />
          {ex.textZh ? <Speakable text={ex.textZh} lang="zh" style={styles.exZh} /> : null}
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
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
    label: { color: t.textPrimary, fontWeight: '700', fontSize: 15, flexShrink: 1 },
    defEn: { color: t.textSecondary, fontSize: 14, lineHeight: 20, flex: 1 },
    defZh: { color: t.textPrimary, fontSize: 15, lineHeight: 21, fontWeight: '500', flex: 1 },
    pattern: {
      color: t.textMuted,
      fontSize: 12,
      backgroundColor: t.bgSurfaceElevated,
      alignSelf: 'flex-start',
      borderRadius: 5,
      overflow: 'hidden',
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    example: {
      borderLeftWidth: 2,
      borderColor: t.borderStrong,
      paddingLeft: 10,
      gap: 4,
      marginTop: 2,
    },
    exEn: { color: t.textSecondary, fontSize: 13, lineHeight: 19, flex: 1 },
    exZh: { color: t.textMuted, fontSize: 12, lineHeight: 18, flex: 1 },
  });
}
