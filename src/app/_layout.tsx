import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const dark = colorScheme === 'dark';
  return (
    <ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: dark ? '#090d16' : '#f9f6f0' },
        }}
      >
        <Stack.Screen name="index" />
      </Stack>
      <StatusBar style={dark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
