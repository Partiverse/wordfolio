import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BrowseItem } from '@/db/repository';
import { useTheme } from '@/theme/tokens';

// 浏览网格词条卡：词头 + IPA + 首义项中文预览 + CEFR 徽标。
export function WordCard({
  item,
  onPress,
}: {
  item: BrowseItem;
  onPress: (entryId: number) => void;
}) {
  const t = useTheme();
  const styles = makeStyles(t);

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => onPress(item.entryId)}>
      <View style={styles.topRow}>
        <Text style={styles.headword}>{item.headword}</Text>
        {item.cefr ? <Text style={styles.cefr}>{item.cefr}</Text> : null}
      </View>
      <View style={styles.midRow}>
        {item.ipaAm ? <Text style={styles.ipa}>/{item.ipaAm}/</Text> : null}
        {item.pos ? <Text style={styles.pos}>{item.pos}</Text> : null}
      </View>
      {item.glossZh ? (
        <Text style={styles.gloss} numberOfLines={2}>
          {item.glossZh}
        </Text>
      ) : null}
    </Pressable>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: t.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      padding: 12,
      gap: 6,
    },
    pressed: { opacity: 0.7 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    headword: { color: t.foreground, fontWeight: '700', fontSize: 16, flexShrink: 1 },
    cefr: {
      color: t.accentPrimary,
      fontSize: 11,
      fontWeight: '700',
      backgroundColor: t.accent,
      borderRadius: 6,
      overflow: 'hidden',
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    midRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    ipa: { color: t.textMuted, fontSize: 12 },
    pos: { color: t.accentPrimary, fontSize: 12, fontWeight: '500' },
    gloss: { color: t.textSecondary, fontSize: 13, lineHeight: 18 },
  });
}
