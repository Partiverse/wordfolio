// 筛选 chips：内测反馈「筛选栏高度太窄」后重做——minHeight 40、字号 14、
// 横向滚动带 padding，并让选中态只用 brand 一种色。
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
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
    </ScrollView>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    scroll: { flexGrow: 0 },
    content: { paddingVertical: 2, paddingRight: 16, gap: 8 },
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
