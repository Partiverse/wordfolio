// 筛选 chips：beta.3 反馈「筛选区域宽度没有改变」——横向滚动会截断右侧 chip，
// 改为 flexWrap 换行布局，全部 chip 一眼可见；点击已选中的 chip 即取消（回到「全部」）。
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/tokens';

export interface Chip {
  label: string;
  value: string | null;
}

export function FilterChips({
  chips,
  active,
  onChange,
}: {
  chips: readonly Chip[];
  active: string | null;
  onChange: (value: string | null) => void;
}) {
  const t = useTheme();
  const styles = makeStyles(t);

  return (
    <View style={styles.wrap}>
      {chips.map((chip) => {
        const selected = chip.value === active;
        return (
          <Pressable
            key={chip.value ?? '__all__'}
            onPress={() => onChange(chip.value)}
            style={({ pressed }) => [styles.chip, selected && styles.chipActive, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.label, selected && styles.labelActive]}>{chip.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      minHeight: 40,
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      backgroundColor: t.bgSurface,
    },
    chipActive: { backgroundColor: t.primary, borderColor: t.primary },
    pressed: { opacity: 0.7 },
    label: { color: t.textSecondary, fontSize: 14, fontWeight: '600' },
    labelActive: { color: t.primaryForeground },
  });
}
