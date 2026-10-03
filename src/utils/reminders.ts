// 每日学习提醒（expo-notifications 本地通知，无推送服务器）。
// 功能树 §6「每日推送提醒」槽位：系统层能力，不进 tab；设置入口在统计页。
// 注意：setNotificationHandler 必须在模块加载时注册，否则前台收到通知不展示。
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';

import { getSetting, setSetting } from '@/db/study';

const CHANNEL_ID = 'study-reminder';
const SETTINGS_KEY = 'reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const REMINDER_TIMES = [
  { label: '08:00', hour: 8, minute: 0 },
  { label: '12:30', hour: 12, minute: 30 },
  { label: '18:00', hour: 18, minute: 0 },
  { label: '21:30', hour: 21, minute: 30 },
  { label: '22:30', hour: 22, minute: 30 },
] as const;

export interface ReminderSetting {
  enabled: boolean;
  hour: number;
  minute: number;
  notificationId: string | null;
}

const DEFAULT_SETTING: ReminderSetting = {
  enabled: false,
  hour: 21,
  minute: 30,
  notificationId: null,
};

export async function getReminderSetting(): Promise<ReminderSetting> {
  const raw = await getSetting(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTING;
  try {
    return { ...DEFAULT_SETTING, ...(JSON.parse(raw) as Partial<ReminderSetting>) };
  } catch {
    return DEFAULT_SETTING;
  }
}

async function ensureChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: '学习提醒',
    importance: Notifications.AndroidImportance.DEFAULT,
  }).catch(() => {});
}

/** 开启每日提醒：请求通知权限（Android 13+ 必需），未授权返回 false。 */
export async function enableReminder(hour: number, minute: number): Promise<{ granted: boolean }> {
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return { granted: false };

  await ensureChannel();
  const previous = await getReminderSetting();
  if (previous.notificationId) {
    await Notifications.cancelScheduledNotificationAsync(previous.notificationId).catch(() => {});
  }
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '该背单词了',
      body: '今天的义项复习在等你，几分钟就能完成',
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: CHANNEL_ID,
    },
  });
  await setSetting(
    SETTINGS_KEY,
    JSON.stringify({ enabled: true, hour, minute, notificationId } satisfies ReminderSetting),
  );
  return { granted: true };
}

/** 关闭每日提醒：取消已调度通知，保留上次时间偏好。 */
export async function disableReminder(): Promise<void> {
  const previous = await getReminderSetting();
  if (previous.notificationId) {
    await Notifications.cancelScheduledNotificationAsync(previous.notificationId).catch(() => {});
  }
  await setSetting(
    SETTINGS_KEY,
    JSON.stringify({ ...previous, enabled: false, notificationId: null }),
  );
}
