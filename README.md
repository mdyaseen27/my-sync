# MY Sync

Secure cross-device sync with end-to-end encryption. No accounts needed — just a 6-digit PIN.

## Features

- 🔐 End-to-end AES-GCM encryption (client-side, zero-knowledge)
- ⚡ Real-time WebSocket sync via Socket.IO
- 📱 Works on any device — phone, tablet, desktop
- 🕐 Ephemeral sessions — auto-expires after 30 min inactivity or 24h max lifetime
- 🎨 Dark & light mode, fully responsive
- 🖼️ Text + image clipboard sync with drag-and-drop and paste
- 🔒 Rate-limited PIN attempts, salted Argon2id hashing
- 📋 Device list with kick capability, session expiry countdown

## Quick Start

### 1. Set up Supabase

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Run `backend/schema.sql` in the SQL Editor
4. Get your URL and Service Key from **Project Settings → API**
5. Copy `.env.example` to `.env` and fill in the values

### 2. Install dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

### 3. Configure environment variables

```bash
# backend/.env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
PORT=3001
FRONTEND_URL=http://localhost:5173

# frontend/.env
VITE_API_BASE=/api
```

### 4. Start development

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 5. Deploy

- **Frontend** → Vercel (free tier)
- **Backend** → Render (free tier)
- **Database** → Supabase (free tier)
- **Full step-by-step guide with custom domain** → See `DEPLOY.md`

## Project Structure

```
my-sync/
├── backend/                  # Express + Socket.IO server
│   ├── index.js              # Main server with all routes & Socket.IO
│   ├── schema.sql            # Supabase Postgres tables
│   ├── package.json
│   └── .env.example
├── frontend/                 # React + Vite app
│   ├── src/
│   │   ├── App.jsx           # Main app component
│   │   ├── api.js            # REST API client
│   │   ├── socket.js         # Socket.IO client & helpers
│   │   ├── crypto.js         # WebCrypto AES-GCM + PBKDF2
│   │   ├── clipboard-polyfill.js  # ClipboardItem polyfill
│   │   ├── PinDisplay.jsx    # PIN display component
│   │   └── styles.css        # Global styles (dark/light mode)
│   ├── package.json
│   └── vite.config.js
├── Dockerfile                # Container deployment
├── netlify.toml              # Netlify deployment config
├── vercel.json               # Vercel deployment config
├── setup.sh                  # Automated setup script
├── .github/workflows/ci.yml  # GitHub Actions CI
├── README.md
├── DEPLOY.md               # Step-by-step deployment guide with custom domain
├── setup.md                  # Detailed setup & deployment guide
└── AGENTS.md                 # Agent instructions & architecture notes
```

## Security

- PINs generated with `crypto.randomBytes`, hashed with Argon2id before storage
- AES-256-GCM client-side encryption derived from PIN + per-session salt (PBKDF2)
- Rate limiting on PIN attempts (5 max, 15min lockout after too many failures)
- HTTPS/HSTS enforced, security headers via Helmet (CSP, X-Frame-Options, etc.)
- No plaintext clipboard data ever stored — only ciphertext
- Socket.IO authentication middleware, scoped sessions
- httpOnly, Secure, SameSite=Strict session cookies
- Content-Security-Policy headers

## License

MIT