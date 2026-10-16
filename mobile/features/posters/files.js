// Saving and sharing an exported poster file. No media-library permission is
// needed: "Save" lets the doctor pick a folder in Android's file picker, and
// "Share" opens the native share sheet.
import { Directory } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ApiError } from '@/services/api';

const cancelled = (err) => (err && err.code === 'ERR_PICKER_CANCELLED') || /cancel/i.test(String(err && err.message));

/** Writes the file into a folder the doctor chooses. Resolves with false if they close the picker. */
export async function savePosterFile(exported) {
  let folder;
  try {
    folder = await Directory.pickDirectoryAsync();
  } catch (err) {
    if (cancelled(err)) return false;
    throw new ApiError({ code: 'SAVE_FAILED', message: 'The folder could not be opened on this phone.' });
  }
  try {
    const saved = folder.createFile(exported.filename, exported.mimeType);
    saved.write(await exported.file.bytes());
    return true;
  } catch {
    throw new ApiError({ code: 'SAVE_FAILED', message: 'The file could not be saved in that folder. Please choose another one.' });
  }
}

/** Opens the share sheet with the file (WhatsApp, Drive, Gmail, …). */
export async function sharePosterFile(exported) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new ApiError({ code: 'SHARE_UNAVAILABLE', message: 'Sharing is not available on this phone.' });
  }
  await Sharing.shareAsync(exported.uri, {
    mimeType: exported.mimeType,
    dialogTitle: 'Share your batch poster',
    UTI: exported.mimeType === 'application/pdf' ? 'com.adobe.pdf' : 'public.png',
  });
}

/** Friendly message for an export failure (mirrors the website's exportErrorMessage). */
export function exportErrorMessage(error) {
  if (error && error.code === 'POSTER_NOT_READY') return 'Finish the poster and save it before downloading it.';
  if (error && error.isNetwork) return 'No connection — the poster could not be prepared.';
  return (error && error.message) || 'The poster could not be exported. Please try again.';
}
