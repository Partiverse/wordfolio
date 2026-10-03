import { Tabs } from 'expo-router';

import { BookIcon, FlameIcon, StatsIcon } from '@/components/icons';
import { useTheme } from '@/theme/tokens';

// 底部三 tab：词库 / 学习 / 统计（内测反馈「功能单一、入口不明显」的改法）。
export default function TabsLayout() {
  const t = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.textMuted,
        // 不设固定 height/padding：交给 React Navigation 按系统手势区自适应，
        // 否则 Android 手势条会压住 label（beta.3 实测「菜单栏显示不完整」）。
        tabBarStyle: {
          backgroundColor: t.bgSurface,
          borderTopColor: t.border,
        },
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '词库',
          tabBarIcon: ({ color, size }) => <BookIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="study"
        options={{
          title: '学习',
          tabBarIcon: ({ color, size }) => <FlameIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: '统计',
          tabBarIcon: ({ color, size }) => <StatsIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
