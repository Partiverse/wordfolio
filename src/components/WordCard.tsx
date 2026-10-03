import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StarIcon, StarOutlineIcon } from '@/components/icons';
import type { BrowseItem } from '@/db/repository';
import { useTheme } from '@/theme/tokens';

// 浏览网格词条卡：词头 + 收藏星标（图标替代 emoji）+ 词性 + 首义项中文预览。
// 配色收敛：卡片/边框走中性阶，词性与 CEFR 徽标统一用弱化中性色，star 激活才用 brand。
export function WordCard({
  item,
  favorite,
  onPress,
  onToggleFavorite,
}: {
  item: BrowseItem;
  favorite: boolean;
  onPress: (entryId: number) => void;
  onToggleFavorite: (entryId: number) => void;
}) {
  const t = useTheme();
  const styles = makeStyles(t);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onPress(item.entryId)}
      accessibilityRole="button"
    >
      <View style={styles.topRow}>
        <Text style={styles.headword} numberOfLines={1}>
          {item.headword}
        </Text>
        <Pressable
          onPress={() => onToggleFavorite(item.entryId)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={favorite ? '取消收藏' : '收藏'}
        >
          {favorite ? <StarIcon color={t.primary} size={18} /> : <StarOutlineIcon color={t.textMuted} size={18} />}
        </Pressable>
      </View>

      <View style={styles.metaRow}>
        {item.pos ? <Text style={styles.pos}>{item.pos}</Text> : null}
        {item.cefr ? <Text style={styles.cefr}>{item.cefr}</Text> : null}
        {item.ipaAm ? (
          <Text style={styles.ipa} numberOfLines={1}>
            /{item.ipaAm}/
          </Text>
        ) : null}
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
      backgroundColor: t.bgSurface,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderSubtle,
      padding: 14,
      gap: 8,
      minHeight: 112,
    },
    pressed: { opacity: 0.7 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
    headword: { color: t.textPrimary, fontWeight: '700', fontSize: 17, flexShrink: 1 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
    cefr: { color: t.textMuted, fontSize: 11, fontWeight: '700' },
    ipa: { color: t.textMuted, fontSize: 12, flexShrink: 1 },
    gloss: { color: t.textSecondary, fontSize: 13, lineHeight: 19 },
  });
}
