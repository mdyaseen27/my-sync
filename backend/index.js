import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import { createClient } from '@supabase/supabase-js';
import argon2 from 'argon2';
import dotenv from 'dotenv';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,
  xssFilter: true,
  frameguard: { action: 'deny' }
}));

app.use(express.json({ limit: '10mb' }));

app.use(express.static(join(__dirname, '..', 'frontend', 'dist')));

const pinAttempts = new Map();
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 15 * 60 * 1000;

function getClientIp(req) {
  return req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
}

function checkPinRateLimit(ip, sessionId) {
  const key = `${ip}:${sessionId}`;
  const now = Date.now();
  const attempts = pinAttempts.get(key) || { count: 0, lockedUntil: 0 };
  if (now < attempts.lockedUntil) {
    return { allowed: false, retryAfter: Math.ceil((attempts.lockedUntil - now) / 1000) };
  }
  if (attempts.count >= MAX_PIN_ATTEMPTS) {
    attempts.lockedUntil = now + PIN_LOCKOUT_MS;
    attempts.count = 0;
    pinAttempts.set(key, attempts);
    return { allowed: false, retryAfter: Math.ceil(PIN_LOCKOUT_MS / 1000) };
  }
  return { allowed: true };
}

function recordPinAttempt(ip, sessionId, success) {
  const key = `${ip}:${sessionId}`;
  const attempts = pinAttempts.get(key) || { count: 0, lockedUntil: 0 };
  if (success) { pinAttempts.delete(key); } else { attempts.count += 1; pinAttempts.set(key, attempts); }
}

function generatePin() {
  const bytes = randomBytes(3);
  return String(bytes.readUIntBE(0, 3) % 1000000).padStart(6, '0');
}

async function hashPin(pin, salt) {
  return argon2.hash(pin + salt, { type: argon2.argon2id, memoryCost: 2 ** 16, timeCost: 3, parallelism: 1 });
}

async function verifyPin(pin, hash, salt) {
  return argon2.verify(hash, pin + salt);
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const INACTIVITY_TTL_MS = 60 * 60 * 1000;

app.post('/api/sessions', async (req, res) => {
  try {
    const pin = generatePin();
    const salt = randomBytes(16).toString('hex');
    const pinHash = await hashPin(pin, salt);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    const { data: session, error } = await supabase
      .from('sessions')
      .insert({ pin_hash: pinHash, salt, created_at: now.toISOString(), expires_at: expiresAt.toISOString(), last_active_at: now.toISOString() })
      .select().single();
    if (error) throw error;
    res.json({ sessionId: session.id, pin });
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

app.post('/api/sessions/:sessionId/join', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { pin } = req.body;
    const ip = getClientIp(req);
    const rateLimit = checkPinRateLimit(ip, sessionId);
    if (!rateLimit.allowed) {
      return res.status(429).json({ error: 'Too many failed attempts. Try again later.', retryAfter: rateLimit.retryAfter });
    }
    const { data: session, error } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
    if (error || !session) { recordPinAttempt(ip, sessionId, false); return res.status(404).json({ error: 'Session not found' }); }
    const now = new Date();
    if (new Date(session.expires_at) < now) { recordPinAttempt(ip, sessionId, false); return res.status(410).json({ error: 'Session expired' }); }
    const valid = await verifyPin(pin, session.pin_hash, session.salt);
    recordPinAttempt(ip, sessionId, valid);
    if (!valid) { return res.status(401).json({ error: 'Invalid PIN' }); }
    const deviceFingerprint = req.headers['user-agent'] || 'unknown';
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .insert({ session_id: sessionId, device_fingerprint: deviceFingerprint, joined_at: now.toISOString(), last_seen_at: now.toISOString() })
      .select().single();
    if (deviceError) throw deviceError;
    await supabase.from('sessions').update({ last_active_at: now.toISOString() }).eq('id', sessionId);
    res.json({ deviceId: device.id, session: { id: session.id, expiresAt: session.expires_at, lastActiveAt: session.last_active_at } });
  } catch (err) {
    console.error('Join session error:', err);
    res.status(500).json({ error: 'Failed to join session' });
  }
});

app.get('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { data: session, error: sessionError } = await supabase.from('sessions').select('id, created_at, expires_at, last_active_at').eq('id', sessionId).single();
    if (sessionError || !session) { return res.status(404).json({ error: 'Session not found' }); }
    const { data: devices, error } = await supabase.from('devices').select('id, device_fingerprint, joined_at, last_seen_at').eq('session_id', sessionId);
    if (error) throw error;
    res.json({ session, devices: devices || [] });
  } catch (err) {
    console.error('Get session error:', err);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

app.delete('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await Promise.all([
      supabase.from('clipboard_items').delete().eq('session_id', sessionId),
      supabase.from('devices').delete().eq('session_id', sessionId),
      supabase.from('sessions').delete().eq('id', sessionId)
    ]);
    io.to(sessionId).emit('session-ended');
    res.json({ success: true });
  } catch (err) {
    console.error('End session error:', err);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

app.post('/api/sessions/:sessionId/clipboard', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { type, ciphertext, iv, expiresAt } = req.body;
    if (!['text', 'image'].includes(type)) { return res.status(400).json({ error: 'Invalid type' }); }
    const { data: session } = await supabase.from('sessions').select('id').eq('id', sessionId).single();
    if (!session) { return res.status(404).json({ error: 'Session not found' }); }
    const now = new Date();
    const itemExpiresAt = expiresAt ? new Date(expiresAt) : new Date(now.getTime() + SESSION_TTL_MS);
    const { data: item, error } = await supabase
      .from('clipboard_items')
      .insert({ session_id: sessionId, type, ciphertext, iv, created_at: now.toISOString(), expires_at: itemExpiresAt.toISOString() })
      .select().single();
    if (error) throw error;
    await supabase.from('sessions').update({ last_active_at: now.toISOString() }).eq('id', sessionId);
    io.to(sessionId).emit('clipboard-item', { id: item.id, type: item.type, ciphertext: item.ciphertext, iv: item.iv, createdAt: item.created_at });
    res.json({ id: item.id });
  } catch (err) {
    console.error('Add clipboard item error:', err);
    res.status(500).json({ error: 'Failed to add clipboard item' });
  }
});

app.get('/api/sessions/:sessionId/clipboard', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { data: items, error } = await supabase
      .from('clipboard_items')
      .select('id, type, ciphertext, iv, created_at')
      .eq('session_id', sessionId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json({ items: items || [] });
  } catch (err) {
    console.error('Get clipboard items error:', err);
    res.status(500).json({ error: 'Failed to get clipboard items' });
  }
});

app.delete('/api/sessions/:sessionId/devices/:deviceId', async (req, res) => {
  try {
    const { sessionId, deviceId } = req.params;
    await supabase.from('devices').delete().eq('id', deviceId).eq('session_id', sessionId);
    io.to(sessionId).emit('device-left', { deviceId });
    res.json({ success: true });
  } catch (err) {
    console.error('Remove device error:', err);
    res.status(500).json({ error: 'Failed to remove device' });
  }
});

io.use(async (socket, next) => {
  const sessionId = socket.handshake.auth.sessionId;
  const deviceId = socket.handshake.auth.deviceId;
  if (!sessionId || !deviceId) { return next(new Error('Authentication required')); }
  const { data: device } = await supabase.from('devices').select('id').eq('id', deviceId).eq('session_id', sessionId).single();
  if (!device) { return next(new Error('Invalid device')); }
  socket.sessionId = sessionId;
  socket.deviceId = deviceId;
  next();
});

io.on('connection', (socket) => {
  socket.join(socket.sessionId);
  const now = new Date();
  supabase.from('devices').update({ last_seen_at: now.toISOString() }).eq('id', socket.deviceId);
  io.to(socket.sessionId).emit('device-joined', { deviceId: socket.deviceId });
  socket.on('disconnect', () => { io.to(socket.sessionId).emit('device-left', { deviceId: socket.deviceId }); });
  socket.on('ping', () => {
    const now = new Date();
    supabase.from('devices').update({ last_seen_at: now.toISOString() }).eq('id', socket.deviceId);
    supabase.from('sessions').update({ last_active_at: now.toISOString() }).eq('id', socket.sessionId);
  });
});

setInterval(async () => {
  const now = new Date().toISOString();
  await supabase.from('clipboard_items').delete().lt('expires_at', now);
  const { data: expiredSessions } = await supabase.from('sessions').select('id').lt('expires_at', now);
  if (expiredSessions) {
    for (const session of expiredSessions) {
      await Promise.all([
        supabase.from('clipboard_items').delete().eq('session_id', session.id),
        supabase.from('devices').delete().eq('session_id', session.id),
        supabase.from('sessions').delete().eq('id', session.id)
      ]);
      io.to(session.id).emit('session-ended');
    }
  }
  const inactivityCutoff = new Date(Date.now() - INACTIVITY_TTL_MS).toISOString();
  const { data: inactiveSessions } = await supabase.from('sessions').select('id').lt('last_active_at', inactivityCutoff);
  if (inactiveSessions) {
    for (const session of inactiveSessions) {
      await Promise.all([
        supabase.from('clipboard_items').delete().eq('session_id', session.id),
        supabase.from('devices').delete().eq('session_id', session.id),
        supabase.from('sessions').delete().eq('id', session.id)
      ]);
      io.to(session.id).emit('session-ended');
    }
  }
}, 5 * 60 * 1000);

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});