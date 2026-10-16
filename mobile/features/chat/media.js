// Downloading, saving and sharing the photo of a chat message.
//
// The original file is streamed by the API only to members of the
// conversation (GET …/messages/:messageId/image with the bearer token), so the
// app never handles Cloudinary links to originals. Nothing here needs a
// media-library permission: "Save" lets the doctor pick a folder through the
// system file picker, and "Share" opens the native share sheet.
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ApiError, getToken } from '@/services/api';
import { chatApi } from './api';

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

const pad = (n) => String(n).padStart(2, '0');

// mkcgspandan-chat-20261016-153012.jpg — the same name the website uses.
export function imageFileName(message) {
  const d = new Date(message.createdAt);
  const stamp = Number.isNaN(d.getTime())
    ? String(Date.now())
    : `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  const format = (message.image && message.image.format) || 'jpg';
  return `mkcgspandan-chat-${stamp}.${format}`;
}

export const imageMimeType = (message) => MIME[(message.image && message.image.format) || 'jpg'] || 'image/jpeg';

// Downloads the original photo of `message` into the app's cache.
export async function downloadChatImage(conversationId, message) {
  const token = getToken();
  const folder = new Directory(Paths.cache, 'chat-images');
  folder.create({ idempotent: true, intermediates: true });
  const target = new File(folder, imageFileName(message));
  try {
    return await File.downloadFileAsync(chatApi.imageUrl(conversationId, message.id), target, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      idempotent: true,
    });
  } catch (err) {
    const status = /(\d{3})/.exec(String(err && err.message))?.[1];
    if (status === '409' || status === '404') {
      throw new ApiError({ status: Number(status), code: 'NOT_AVAILABLE', message: 'This photo is no longer available.' });
    }
    if (status === '401' || status === '403') {
      throw new ApiError({ status: Number(status), code: 'FORBIDDEN', message: 'You do not have access to this photo.' });
    }
    throw new ApiError({ code: 'NETWORK', message: 'The photo could not be downloaded. Check your connection and try again.' });
  }
}

const cancelled = (err) => (err && err.code === 'ERR_PICKER_CANCELLED') || /cancel/i.test(String(err && err.message));

// Lets the doctor choose a folder (Downloads, Pictures, …) and writes the photo
// there. Resolves with false when the doctor closes the picker.
export async function saveChatImage(conversationId, message) {
  const file = await downloadChatImage(conversationId, message);
  let folder;
  try {
    folder = await Directory.pickDirectoryAsync();
  } catch (err) {
    if (cancelled(err)) return false;
    throw new ApiError({ code: 'SAVE_FAILED', message: 'The folder could not be opened on this phone.' });
  }
  try {
    const saved = folder.createFile(imageFileName(message), imageMimeType(message));
    saved.write(await file.bytes());
    return true;
  } catch {
    throw new ApiError({ code: 'SAVE_FAILED', message: 'The photo could not be saved in that folder. Please choose another one.' });
  }
}

// Opens the native share sheet with the original photo (Save to Photos, Drive, WhatsApp, …).
export async function shareChatImage(conversationId, message) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new ApiError({ code: 'SHARE_UNAVAILABLE', message: 'Sharing is not available on this phone.' });
  }
  const file = await downloadChatImage(conversationId, message);
  await Sharing.shareAsync(file.uri, { mimeType: imageMimeType(message), dialogTitle: 'Save or share photo' });
}
