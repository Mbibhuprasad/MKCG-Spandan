// Device storage. Everything goes through expo-secure-store, which keeps values
// in the Android Keystore-backed encrypted store: the session token needs that
// protection, and the few preferences are small enough to live beside it.
import * as SecureStore from 'expo-secure-store';

export const KEYS = {
  token: 'mkcg.session.token',
  theme: 'mkcg.pref.theme',
  introSeen: 'mkcg.pref.introSeen',
  onboarding: 'mkcg.onboarding.pending', // id of the user who still has onboarding to finish
  messageAlerts: 'mkcg.pref.messageAlerts',
};

export async function getItem(key) {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null; // an unreadable value (for example after a device restore) counts as absent
  }
}

export async function setItem(key, value) {
  try {
    await SecureStore.setItemAsync(key, String(value));
    return true;
  } catch {
    return false;
  }
}

export async function removeItem(key) {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // nothing to remove
  }
}
