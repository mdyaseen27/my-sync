# Agent Instructions — MY Sync

Architecture notes and agent-facing documentation for the MY Sync application.

## Architecture Overview

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Real-time | Socket.IO 4 |
| Database | Supabase (Postgres) |
| Storage | Supabase Storage (for future image storage) |
| Encryption | WebCrypto API (AES-256-GCM + PBKDF2) |
| Hashing | Argon2id (server-side PIN hashing) |

### Data Flow
```
User copies text/image on Device A
  → Client-side AES-GCM encryption (PIN + salt → PBKDF2 key)
  → POST /api/sessions/:id/clipboard (ciphertext only)
  → Supabase stores ciphertext + IV
  → Socket.IO broadcasts to all devices in session
  → Device B receives ciphertext via WebSocket
  → Client-side AES-GCM decryption (PIN + salt → PBKDF2 key)
  → Display to user (never stores plaintext)
```

### Key Security Principles
1. **Zero-knowledge**: Server never sees plaintext or PIN
2. **Ephemeral**: Sessions auto-expire, no permanent accounts
3. **Rate-limited**: 5 failed PIN attempts per session, 15min lockout
4. **Constant-time**: PIN comparison uses Argon2 verify (timing-safe)
5. **Content Security**: CSP headers, no innerHTML, text-as-plain-text rendering

## File Map

### Backend (`backend/`)
- **`index.js`** — Main Express server, all REST routes, Socket.IO setup, security middleware
- **`schema.sql`** — Supabase Postgres DDL (sessions, devices, clipboard_items tables)
- **`package.json`** — Dependencies: express, socket.io, @supabase/supabase-js, argon2, helmet, cors, dotenv, express-rate-limit
- **`.env.example`** — Template for environment variables

### Frontend (`frontend/src/`)
- **`App.jsx`** — Root component, manages all state (session, devices, items, connection), orchestrates flow
- **`api.js`** — REST API client (fetch-based), handles all backend communication
- **`socket.js`** — Socket.IO client wrapper, event subscriptions, ping interval, reconnection logic
- **`crypto.js`** — WebCrypto operations: deriveKey (PBKDF2), encryptText, decryptText, encryptImage, decryptImage, generateSalt, base64 utilities
- **`clipboard-polyfill.js`** — ClipboardItem API polyfill for older browsers
- **`components/`** — React components (all in src root):
  - `PinDisplay.jsx` — 6-digit PIN display with copy button
  - `JoinForm.jsx` — 6-digit PIN input with paste support
  - `SessionHeader.jsx` — Connection status, expiry timer, end session button
  - `DeviceList.jsx` — Connected devices with kick capability
  - `ClipboardFeed.jsx` — Main feed with drag-drop, paste, file upload
  - `Toast.jsx` — Toast notifications
  - `styles.css` — Dark/light mode CSS variables, responsive styles
- **`vite.config.js`** — Dev server proxy for /api and /socket.io
- **`package.json`** — Dependencies: react, react-dom, socket.io-client

## Key Implementation Details

### PIN Generation & Verification
- **Generation**: `crypto.randomBytes(3)` → `readUIntBE(0,3) % 1000000` → padStart(6, '0')
- **Hashing**: Argon2id with memoryCost=64MB, timeCost=3, parallelism=1, salt appended to PIN before hashing
- **Verification**: `argon2.verify(hash, pin + salt)` — constant-time comparison
- **Rate limiting**: In-memory Map keyed by `ip:sessionId`, 5 attempts max, 15min lockout

### Client-Side Encryption
- **Key derivation**: PBKDF2 with SHA-256, 100000 iterations, 256-bit key from PIN + random salt
- **Encryption**: AES-256-GCM with random 12-byte IV per operation
- **Text**: String → TextEncoder → AES-GCM → base64 ciphertext + base64 IV
- **Image**: File → ArrayBuffer → AES-GCM → base64 ciphertext + base64 IV + MIME type
- **Decryption**: base64 → ArrayBuffer → AES-GCM → original data

### Session Management
- **TTL**: 24 hours max lifetime, 30 minutes inactivity timeout
- **Cleanup**: `setInterval` every 5 minutes, deletes expired items/sessions
- **End session**: Wipes all data from Supabase, emits `session-ended` via Socket.IO
- **Expiry timer**: Client-side countdown using `setInterval`, updates every second

### Socket.IO Events
| Event | Direction | Payload |
|-------|-----------|---------|
| `clipboard-item` | Server → Client | {id, type, ciphertext, iv, createdAt} |
| `device-joined` | Server → Client | {deviceId} |
| `device-left` | Server → Client | {deviceId} |
| `session-ended` | Server → Client | — |
| `device-joined` | Client → Server | — |
| `ping` | Client → Server | — |
| `disconnect` | Client → Server | — |

### Security Headers (Helmet)
- CSP: default-src 'self', connect-src includes wss/ws
- HSTS: max-age=31536000, includeSubDomains, preload
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Frame-Ancestors: 'none'

## Known Limitations & Future Work

1. **In-memory rate limiting**: `pinAttempts` Map is not distributed across server instances. For multi-instance deployments, use Redis or Supabase.
2. **ClipboardItem API**: Not supported in all browsers. Fallback needed for older browsers.
3. **Image preview**: Decryption for preview happens client-side, which can be slow for large images. Consider lazy loading.
4. **QR code**: Planned stretch feature for easier session joining.
5. **Burn after reading**: Planned stretch feature for single-use items.
6. **Supabase Storage**: Currently encrypts images in memory. For large-scale use, consider uploading to Supabase Storage after encryption.

## Agent Behavior

When working on this project:
1. Always test the full flow: create session → join → copy text → verify sync → test expiry
2. Security first: never introduce plaintext PIN storage or innerHTML usage
3. Follow the encryption pattern: encrypt before sending to server, decrypt only in browser
4. Check `npm audit` results before committing
5. Ensure all user input is treated as plain text (no innerHTML)
6. Images must be validated by magic bytes, not file extension