// TTS 可用性提示：设备缺 TTS 引擎/语言包时给出可见说明，而不是点了没反应。
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { VolumeIcon } from '@/components/icons';
import { probeVoices, type SpeechLang } from '@/utils/speech';
import { useTheme } from '@/theme/tokens';

export function TtsBanner({ lang = 'en-US' }: { lang?: SpeechLang }) {
  const t = useTheme();
  const styles = makeStyles(t);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    probeVoices().then((map) => alive && setAvailable(map[lang]));
    return () => {
      alive = false;
    };
  }, [lang]);

  if (available !== false) return null;

  return (
    <View style={styles.banner}>
      <VolumeIcon color={t.textSecondary} size={16} />
      <Text style={styles.text}>
        这台设备没有可用的语音引擎，发音不会响。系统设置里安装/启用语音引擎后即可恢复。
      </Text>
    </View>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: t.bgSurfaceElevated,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    text: { color: t.textSecondary, fontSize: 12, lineHeight: 17, flex: 1 },
  });
}
