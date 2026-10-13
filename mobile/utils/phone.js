import { Linking } from 'react-native';

// The community's default calling code (DEFAULT_COUNTRY_CODE on the API).
export const DEFAULT_COUNTRY_CODE = '91';

// Mirrors normalizePhone in backend/src/utils/text.js so the app can tell the
// doctor about a mistake before the request is sent. The API validates again
// and stores its own canonical "+<digits>" form.
export function normalizePhone(value, countryCode = DEFAULT_COUNTRY_CODE) {
  const raw = String(value ?? '').trim();
  if (!raw || /[^\d\s()+.-]/.test(raw)) return null;
  let digits = raw.replace(/\D/g, '');
  let international = raw.startsWith('+');
  if (!international && raw.startsWith('00')) {
    digits = digits.slice(2);
    international = true;
  }
  if (!international) {
    digits = digits.replace(/^0+/, '');
    if (digits.length === 10) digits = countryCode + digits;
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

// "+919876543210" → "+91 98765 43210" (plain grouping for other countries).
export function formatPhone(value) {
  const s = String(value || '');
  const m = /^\+91(\d{5})(\d{5})$/.exec(s);
  return m ? `+91 ${m[1]} ${m[2]}` : s;
}

// Opens a WhatsApp chat with the number. Nothing is sent: WhatsApp opens with
// an empty message box and the doctor decides what to write.
export async function openWhatsApp(number) {
  const digits = String(number || '').replace(/\D/g, '');
  if (!digits) return false;
  try {
    await Linking.openURL(`whatsapp://send?phone=${digits}`);
    return true;
  } catch {
    try {
      await Linking.openURL(`https://wa.me/${digits}`); // WhatsApp not installed: its web page explains what to do
      return true;
    } catch {
      return false;
    }
  }
}

export async function openLink(url) {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
