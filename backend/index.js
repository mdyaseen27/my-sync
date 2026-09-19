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
const io = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", "data:", "blob:"], connectSrc: ["'self'", 'ws:', 'wss:'], fontSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"] } },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true, xssFilter: true, frameguard: { action: 'deny' }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static(join(__dirname, '..', 'frontend', 'dist')));

const pinAttempts = new Map();
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 15 * 60 * 1000;

function getClientIp(req) { return req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown'; }
function checkPinRateLimit(ip) {
  const now = Date.now();
  const attempts = pinAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  if (now < attempts.lockedUntil) return { allowed: false, retryAfter: Math.ceil((attempts.lockedUntil - now) / 1000) };
  if (attempts.count >= MAX_PIN_ATTEMPTS) { attempts.lockedUntil = now + PIN_LOCKOUT_MS; attempts.count = 0; pinAttempts.set(ip, attempts); return { allowed: false, retryAfter: Math.ceil(PIN_LOCKOUT_MS / 1000) }; }
  return { allowed: true };
}
function recordPinAttempt(ip, success) { const key = ip; const attempts = pinAttempts.get(key) || { count: 0, lockedUntil: 0 }; if (success) pinAttempts.delete(key); else { attempts.count += 1; pinAttempts.set(key, attempts); } }
function generatePin() { const bytes = randomBytes(3); return String(bytes.readUIntBE(0, 3) % 1000000).padStart(6, '0'); }
async function hashPin(pin, salt) { return argon2.hash(pin + salt, { type: argon2.argon2id, memoryCost: 2 ** 16, timeCost: 3, parallelism: 1 }); }
async function verifyPin(pin, hash, salt) { return argon2.verify(hash, pin + salt); }

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

app.post('/api/pin', async (req, res) => {
  try {
    const { pin } = req.body;
    const ip = getClientIp(req);
    const rateLimit = checkPinRateLimit(ip);
    if (!rateLimit.allowed) return res.status(429).json({ error: 'Too many attempts. Try again later.', retryAfter: rateLimit.retryAfter });
    const { data: pinData, error } = await supabase.from('pins').select('*').single();
    if (error || !pinData) { recordPinAttempt(ip, false); return res.status(404).json({ error: 'PIN not configured' }); }
    const valid = await verifyPin(pin, pinData.hash, pinData.salt);
    recordPinAttempt(ip, valid);
    if (!valid) return res.status(401).json({ error: 'Invalid PIN' });
    res.json({ success: true, salt: pinData.salt });
  } catch (err) {
    console.error('PIN verify error:', err);
    res.status(500).json({ error: 'Failed to verify PIN' });
  }
});

app.post('/api/setup-pin', async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || pin.length !== 6) return res.status(400).json({ error: 'PIN must be 6 digits' });
    const salt = randomBytes(16).toString('hex');
    const hash = await hashPin(pin, salt);
    const { data: existing } = await supabase.from('pins').select('*').single();
    if (existing) {
      const { error } = await supabase.from('pins').update({ hash, salt }).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from('pins').insert({ hash, salt, created_at: new Date().toISOString() }).select().single();
      if (error) throw error;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Setup PIN error:', err);
    res.status(500).json({ error: 'Failed to setup PIN' });
  }
});

app.get('/api/pin/status', async (req, res) => {
  try {
    const { data } = await supabase.from('pins').select('id').single();
    res.json({ configured: !!data });
  } catch { res.json({ configured: false }); }
});

app.post('/api/clipboard', async (req, res) => {
  try {
    const { type, ciphertext, iv, mimeType } = req.body;
    if (!['text', 'image'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
    const { data: item, error } = await supabase.from('clipboard_items').insert({ type, ciphertext, iv, mime_type: mimeType || null, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString() }).select().single();
    if (error) throw error;
    io.emit('clipboard-item', { id: item.id, type: item.type, ciphertext: item.ciphertext, iv: item.iv, mimeType: item.mime_type, createdAt: item.created_at });
    res.json({ id: item.id });
  } catch (err) {
    console.error('Add clipboard error:', err);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

app.get('/api/clipboard', async (req, res) => {
  try {
    const { data: items, error } = await supabase.from('clipboard_items').select('id, type, ciphertext, iv, mime_type, created_at').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    res.json({ items: items || [] });
  } catch (err) {
    console.error('Get clipboard error:', err);
    res.status(500).json({ error: 'Failed to get items' });
  }
});

app.delete('/api/clipboard/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await supabase.from('clipboard_items').delete().eq('id', id);
    io.emit('clipboard-deleted', { id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

io.on('connection', (socket) => {
  socket.on('ping', () => socket.emit('pong'));
});

setInterval(async () => {
  const now = new Date().toISOString();
  await supabase.from('clipboard_items').delete().lt('expires_at', now);
}, 5 * 60 * 1000);

app.get('*', (req, res) => { res.sendFile(join(__dirname, '..', 'frontend', 'dist', 'index.html')); });

const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });