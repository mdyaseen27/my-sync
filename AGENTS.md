# Agent Instructions — MY Sync

## Architecture

### Simplified Design
Everything runs on **Render** (single server). No separate Vercel.

```
Render Server (my-sync.onrender.com)
├── Express static file serving (frontend/dist)
├── Express API routes (/api/pin, /api/clipboard)
├── Socket.IO (WebSocket for real-time sync)
└── Supabase (database: pins, clipboard_items)
```

### Data Flow
```
User enters PIN
  → POST /api/pin → verifies against Supabase pins table
  → Returns salt for encryption
  → Frontend stores salt in state
  → All encryption/decryption uses this salt + PIN
  → AES-256-GCM encryption client-side
  → Ciphertext sent to /api/clipboard
  → Supabase stores ciphertext
  → Socket.IO broadcasts to all connected clients
  → Other clients decrypt locally
```

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Real-time | Socket.IO |
| Database | Supabase (Postgres) |
| Encryption | WebCrypto API (AES-256-GCM + PBKDF2) |
| Server | Render (single deployment) |

### Key Security Principles
1. **Zero-knowledge**: Server never sees plaintext or PIN
2. **PIN stored as Argon2id salted hash** in `pins` table
3. **Salt returned on PIN verification** and stored in frontend state
4. **Same salt used for encryption and decryption**
5. **Ephemeral**: Clipboard items expire after 24 hours
6. **Rate-limited**: 5 failed PIN attempts, 15min lockout
7. **Content Security**: No innerHTML, text-as-plain-text rendering

### Tables
- `pins` — stores `hash` (Argon2id), `salt`, `created_at`
- `clipboard_items` — stores `type`, `ciphertext`, `iv`, `mime_type`, `expires_at`

### API Routes
- `POST /api/pin` — verify PIN, returns `{ success: true, salt: '...' }`
- `POST /api/setup-pin` — set a new PIN
- `GET /api/pin/status` — check if PIN is configured
- `POST /api/clipboard` — add clipboard item
- `GET /api/clipboard` — get all clipboard items
- `DELETE /api/clipboard/:id` — delete clipboard item

### Socket.IO Events
- `clipboard-item` — server → client, new item broadcast
- `clipboard-deleted` — server → client, item removed
- `ping` / `pong` — keepalive

## Agent Behavior

When working on this project:
1. PIN verification is the only auth — no sessions, no devices
2. Encryption uses the same salt for encrypt and decrypt
3. All clipboard data is ciphertext only — never plaintext
4. The backend serves static frontend files from `frontend/dist`
5. Everything runs on one Render server — no CORS issues
6. Run `npm run build` on backend to build frontend and copy to `backend/frontend/dist`
7. Test the full flow: set PIN → verify → add item → check sync

## Known Limitations
1. Single server deployment — if Render sleeps, WebSocket reconnects
2. No multi-user sessions — PIN is personal only
3. Salt is returned on verification — stored only in frontend memory (not persisted)
4. If user closes browser, salt is lost — they need to re-verify PIN to decrypt