import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { usePlayStatus } from '@/stores/playStatus';
import { useTheme } from '@/theme/tokens';

// 发音降级/失败浮条：三层降级（有道/合成音/失败）显式可见，用户能自证问题在哪层。
// 显示 3 秒后自动消失；seq 递增保证同文案连续触发也重新计时。
export function PlayToast() {
  const t = useTheme();
  const styles = makeStyles(t);
  const msg = usePlayStatus((s) => s.msg);
  const seq = usePlayStatus((s) => s.seq);
  const clear = usePlayStatus((s) => s.clear);

  useEffect(() => {
    if (!msg) return;
    const timer = setTimeout(() => clear(), 3000);
    return () => clearTimeout(timer);
  }, [msg, seq, clear]);

  if (!msg) return null;

  return (
    <View style={styles.toast} pointerEvents="none">
      <Text style={styles.text}>{msg}</Text>
    </View>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    toast: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 80,
      backgroundColor: t.tooltipBg,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      opacity: 0.95,
    },
    text: { color: t.tooltipText, fontSize: 12, lineHeight: 18 },
  });
}
