// Where the MKCGSPANDAN API lives. The address is configuration, never code:
//   • EXPO_PUBLIC_API_URL (see .env.example) is used when it is set;
//   • in development only, an empty value falls back to the computer that
//     serves the JavaScript bundle, on the API's default port — this works on
//     an emulator and on a phone on the same network without editing anything;
//   • a production build with no address reports a configuration error
//     instead of guessing (it never falls back to localhost).
import Constants from 'expo-constants';

const DEV_API_PORT = 5000;

const tidy = (value) =>
  String(value || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/v1$/, '');

function devServerHost() {
  const hostUri =
    (Constants.expoConfig && Constants.expoConfig.hostUri) ||
    (Constants.expoGoConfig && Constants.expoGoConfig.debuggerHost) ||
    '';
  const host = String(hostUri).split(':')[0];
  return host || null;
}

function resolveOrigin() {
  const configured = tidy(process.env.EXPO_PUBLIC_API_URL);
  if (configured) return configured;
  if (__DEV__) {
    const host = devServerHost();
    if (host) return `http://${host}:${DEV_API_PORT}`;
  }
  return '';
}

export const API_ORIGIN = resolveOrigin();
export const API_URL = API_ORIGIN ? `${API_ORIGIN}/api/v1` : '';
export const SOCKET_PATH = '/socket.io';
export const isApiConfigured = Boolean(API_ORIGIN);

// The public MKCGSPANDAN website (EXPO_PUBLIC_WEB_URL, see .env.example): the
// "Explore MKCGSPANDAN on the Web" card on Home and the full legal texts. Only a
// full http(s):// address counts; otherwise it is empty and nothing is opened.
const webUrl = tidy(process.env.EXPO_PUBLIC_WEB_URL);
export const WEB_URL = /^https?:\/\/[^\s]+$/i.test(webUrl) ? webUrl : '';

export const REQUEST_TIMEOUT_MS = 20000;
export const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;
