import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { bindAudioCache } from '@/utils/pronunciation';
import { getAudioUrl, putAudioUrl } from '@/db/study';
import { useThemeStore } from '@/stores/theme';
import { useResolvedScheme } from '@/theme/tokens';

// 真人发音缓存绑定（韦氏→免费词典链，见 utils/pronunciation.ts）；进程内一次
let audioCacheBound = false;

export default function RootLayout() {
  // E4：scheme = 用户偏好优先（settings 表），system 时回落系统色；水合在挂载时执行一次
  const scheme = useResolvedScheme();
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const dark = scheme === 'dark';

  useEffect(() => {
    void hydrateTheme();
  }, [hydrateTheme]);

  useEffect(() => {
    if (!audioCacheBound) {
      bindAudioCache(getAudioUrl, putAudioUrl);
      audioCacheBound = true;
    }
  }, []);

  return (
    <ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: dark ? '#090d16' : '#f8fafc' },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="entry/[id]" />
        <Stack.Screen name="wrong" />
        <Stack.Screen name="history" />
        <Stack.Screen name="about" />
        <Stack.Screen name="spike" />
      </Stack>
      <StatusBar style={dark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
