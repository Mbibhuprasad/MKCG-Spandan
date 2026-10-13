// On-device alerts for chat messages that arrive while the app is running but
// the conversation is not on screen. These are LOCAL notifications raised by
// the app itself from its live chat connection — the server sends no push
// notifications, so nothing arrives while the app is closed (see docs/MOBILE.md).
//
// expo-notifications is loaded only when the doctor switches alerts on, so the
// notification permission is never requested before it is needed.
import { KEYS, getItem, setItem } from '@/services/storage';

const CHANNEL = 'messages';
let enabled = false;
let Notifications = null;
let onOpen = null;
let responseSubscription = null;

function load() {
  if (!Notifications) {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
    responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response && response.notification && response.notification.request.content.data;
      if (data && data.conversationId && onOpen) onOpen(String(data.conversationId));
    });
  }
  return Notifications;
}

async function prepare() {
  const N = load();
  await N.setNotificationChannelAsync(CHANNEL, { name: 'Chat messages', importance: N.AndroidImportance.DEFAULT });
  return N;
}

export async function restoreAlertsPreference() {
  enabled = (await getItem(KEYS.messageAlerts)) === '1';
  if (enabled) {
    try {
      await prepare();
    } catch {
      enabled = false;
    }
  }
  return enabled;
}

export const alertsEnabled = () => enabled;

// Returns { enabled, reason? }. Asks for the notification permission when switching on.
export async function setAlertsEnabled(next) {
  if (!next) {
    enabled = false;
    await setItem(KEYS.messageAlerts, '0');
    return { enabled: false };
  }
  try {
    const N = await prepare();
    let permission = await N.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain !== false) permission = await N.requestPermissionsAsync();
    if (!permission.granted) {
      return { enabled: false, reason: 'Notifications are switched off for this app in Android settings.' };
    }
    enabled = true;
    await setItem(KEYS.messageAlerts, '1');
    return { enabled: true };
  } catch {
    return { enabled: false, reason: 'Notifications are not available on this device.' };
  }
}

export function setOpenHandler(handler) {
  onOpen = handler;
}

export async function alertNewMessage({ title, body, conversationId }) {
  if (!enabled) return;
  try {
    const N = load();
    await N.scheduleNotificationAsync({
      content: { title, body, data: { conversationId } },
      trigger: { channelId: CHANNEL },
    });
  } catch {
    // an alert is a convenience; the message itself is already in the app
  }
}

export function disposeAlerts() {
  if (responseSubscription) responseSubscription.remove();
  responseSubscription = null;
}
