# MY Sync — Deployment Guide (Live + Custom Domain)

## Quick Start (10 minutes)

### Step 1: Supabase (5 min)

1. Go to [supabase.com](https://supabase.com) → **New Project** → name it `my-sync`
2. Wait ~30 seconds
3. **SQL Editor** → paste `backend/schema.sql` → **Run**
4. **Settings → API** → copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** → `SUPABASE_SERVICE_KEY`

### Step 2: Environment (2 min)

**`backend/.env`:**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
PORT=10000
```

**`frontend/.env`:**
```
VITE_API_BASE=/api
```

### Step 3: Test Locally (3 min)

```bash
# Terminal 1
cd backend && npm install && npm run dev

# Terminal 2
cd frontend && npm install && npm run dev
```

Open `localhost:5173`. Set a PIN → enter it → copy text → it syncs.

### Step 4: Deploy on Render (5 min)

**Backend:**
1. Go to [render.com](https://render.com) → **New Web Service** → select `my-sync` repo
2. **Root Directory**: `backend`, **Build Command**: `npm run build`, **Start Command**: `node index.js`, **Instance**: **Free**
3. **Environment Variables**: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PORT=10000`
4. Click **Create Web Service**
5. After deploy, copy the URL (e.g., `https://my-sync.onrender.com`)
6. Update `FRONTEND_URL` env var with this URL

That's it. Your entire app (frontend + backend + Socket.IO) is at `https://my-sync.onrender.com`.

### Step 5: Custom Domain (optional)

1. Buy domain from Namecheap/Cloudflare
2. Render → **Settings → Custom Domains** → add domain
3. Update DNS at your registrar
4. Done — free SSL included

---

**Full details**: See `DEPLOY.md`
**Architecture notes**: See `AGENTS.md`