// Socket.IO client for the chat gateway (backend/src/realtime/gateway.js).
//
// The gateway accepts a connection only with the session token in the
// handshake, puts the socket into the rooms of the conversations the doctor
// belongs to (there is no "subscribe" event a client could abuse) and answers
// every event through an acknowledgement.
import { io } from 'socket.io-client';
import { ApiError } from './api';
import { API_ORIGIN, SOCKET_PATH } from './config';

export const ACK_TIMEOUT_MS = 8000;

export function createChatSocket(token) {
  return io(API_ORIGIN, {
    path: SOCKET_PATH,
    transports: ['websocket'], // React Native has a native WebSocket; long-polling is not needed
    auth: { token },
    autoConnect: false,
    forceNew: true, // a new session never shares a connection with the previous one
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15000,
    randomizationFactor: 0.4,
    timeout: 15000,
  });
}

// Emits an event and waits for the server's { ok, … } acknowledgement.
// Rejects with ApiError — code 'SOCKET_TIMEOUT' when no answer arrived, in
// which case the caller may fall back to the REST endpoint.
export function emitWithAck(socket, event, payload, timeout = ACK_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      reject(new ApiError({ code: 'SOCKET_OFFLINE', message: 'Not connected.' }));
      return;
    }
    socket.timeout(timeout).emit(event, payload, (err, reply) => {
      if (err) return reject(new ApiError({ code: 'SOCKET_TIMEOUT', message: 'The server did not answer in time.' }));
      if (!reply || reply.ok !== true) {
        const error = (reply && reply.error) || {};
        return reject(new ApiError({ status: 400, code: error.code || 'UNKNOWN', message: error.message || 'That did not work. Please try again.', details: error.details || null }));
      }
      resolve(reply);
    });
  });
}
