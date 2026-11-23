import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";
import { cacheStorage } from "@/api/storage";

/*
 * Reminders scheduled on the phone itself: no server, no push service, nothing sent anywhere.
 * The choices are kept on this phone, like the theme.
 */

export interface ReminderPrefs {
  /** A daily "log today's workout?" at `dailyTime` ("HH:mm"). */
  daily: boolean;
  dailyTime: string;
  /** A weekly weigh-in on `weighDay` (0 Sunday … 6 Saturday) at `weighTime`. Only while weight tracking is on. */
  weigh: boolean;
  weighDay: number;
  weighTime: string;
}

export const DEFAULT_REMINDERS: ReminderPrefs = { daily: false, dailyTime: "20:00", weigh: false, weighDay: 1, weighTime: "07:00" };
const KEY = "reminders";
const CHANNEL = "reminders";

export async function loadReminders(): Promise<ReminderPrefs> {
  try {
    const raw = await cacheStorage.getItem(KEY);
    return raw ? { ...DEFAULT_REMINDERS, ...JSON.parse(raw) } : DEFAULT_REMINDERS;
  } catch {
    return DEFAULT_REMINDERS;
  }
}

/** Asks for permission if needed. False when the user said no (they can change it in the phone's Settings). */
export async function allowNotifications(): Promise<boolean> {
  const now = await Notifications.getPermissionsAsync();
  if (now.granted) return true;
  if (!now.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

const hm = (v: string) => {
  const [hour, minute] = v.split(":").map(Number);
  return { hour: hour || 0, minute: minute || 0 };
};

/** Saves the choices and replaces what's scheduled with them. `trackWeight` gates the weigh-in. */
export async function saveReminders(p: ReminderPrefs, trackWeight: boolean) {
  await cacheStorage.setItem(KEY, JSON.stringify(p)).catch(() => {});
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: "Reminders", importance: AndroidImportance.DEFAULT });
  }
  if (p.daily) {
    await Notifications.scheduleNotificationAsync({
      content: { title: "How did today go?", body: "Log today's workout, or mark it as a rest day." },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, channelId: CHANNEL, ...hm(p.dailyTime) },
    });
  }
  if (p.weigh && trackWeight) {
    await Notifications.scheduleNotificationAsync({
      content: { title: "Weigh-in day", body: "Step on the scale and log it on today's page." },
      // Expo counts weekdays from 1 (Sunday).
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, channelId: CHANNEL, weekday: p.weighDay + 1, ...hm(p.weighTime) },
    });
  }
}

/** Reminders show as a banner even while the app is open. */
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}
