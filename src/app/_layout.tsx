import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { bindAudioCache } from '@/utils/pronunciation';
import { getAudioUrl, putAudioUrl } from '@/db/study';

// 真人发音缓存绑定（韦氏→免费词典链，见 utils/pronunciation.ts）；进程内一次
let audioCacheBound = false;

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const dark = colorScheme === 'dark';

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
        <Stack.Screen name="spike" />
      </Stack>
      <StatusBar style={dark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
