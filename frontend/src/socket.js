import { io } from 'socket.io-client';

let socket = null;
const SERVER_URL = 'https://my-sync.onrender.com';

export function initSocketDirect() {
  if (socket?.connected) { socket.disconnect(); }
  socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  });
  return socket;
}

export function getSocket() { return socket; }
export function disconnectSocket() { if (socket) { socket.disconnect(); socket = null; } }

export function onClipboardItem(callback) { socket?.on('clipboard-item', callback); }
export function offClipboardItem(callback) { socket?.off('clipboard-item', callback); }
export function onClipboardDeleted(callback) { socket?.on('clipboard-deleted', callback); }
export function offClipboardDeleted(callback) { socket?.off('clipboard-deleted', callback); }
export function onConnect(callback) { socket?.on('connect', callback); }
export function offConnect(callback) { socket?.off('connect', callback); }
export function onDisconnect(callback) { socket?.on('disconnect', callback); }
export function offDisconnect(callback) { socket?.off('disconnect', callback); }

export function sendPing() { socket?.emit('ping'); }
setInterval(() => { sendPing(); }, 30000);