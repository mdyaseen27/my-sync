import { io } from 'socket.io-client';

let socket = null;

export function initSocket(sessionId, deviceId) {
  if (socket?.connected) {
    socket.disconnect();
  }
  
  socket = io('/', {
    auth: { sessionId, deviceId },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  });
  
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function onClipboardItem(callback) {
  socket?.on('clipboard-item', callback);
}

export function offClipboardItem(callback) {
  socket?.off('clipboard-item', callback);
}

export function onDeviceJoined(callback) {
  socket?.on('device-joined', callback);
}

export function offDeviceJoined(callback) {
  socket?.off('device-joined', callback);
}

export function onDeviceLeft(callback) {
  socket?.on('device-left', callback);
}

export function offDeviceLeft(callback) {
  socket?.off('device-left', callback);
}

export function onSessionEnded(callback) {
  socket?.on('session-ended', callback);
}

export function offSessionEnded(callback) {
  socket?.off('session-ended', callback);
}

export function onConnect(callback) {
  socket?.on('connect', callback);
}

export function offConnect(callback) {
  socket?.off('connect', callback);
}

export function onDisconnect(callback) {
  socket?.on('disconnect', callback);
}

export function offDisconnect(callback) {
  socket?.off('disconnect', callback);
}

export function onReconnecting(callback) {
  socket?.on('reconnecting', callback);
}

export function offReconnecting(callback) {
  socket?.off('reconnecting', callback);
}

export function onReconnect(callback) {
  socket?.on('reconnect', callback);
}

export function offReconnect(callback) {
  socket?.off('reconnect', callback);
}

export function sendPing() {
  socket?.emit('ping');
}

setInterval(() => {
  sendPing();
}, 30000);