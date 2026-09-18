# MY Sync — Deployment Guide (Live + Custom Domain)

Step-by-step instructions to deploy MY Sync on the internet with a custom domain.

**Recommended stack**: Vercel (frontend) + Render (backend) + Supabase (database)

All three have free tiers that are sufficient for this project.

---

## Prerequisites

Before you begin, make sure you have:

- [x] A GitHub account
- [x] A Supabase project set up (see `setup.md`)
- [x] Your code pushed to a GitHub repository
- [x] A custom domain you own (e.g., `mysync.example.com`) — optional for testing

---

## Step 1: Push Code to GitHub

### 1.1 — Initialize a git repo (if not already done)

```bash
cd my-sync
git init
git add .
git commit -m "Initial commit: MY Sync"
```

> **Important**: Add a `.gitignore` file to exclude `node_modules/`, `.env`, and `dist/` before pushing. The `.gitignore` already exists at the project root.

```bash
# Make sure .env files are NOT committed
echo "backend/.env" >> .gitignore
echo "frontend/.env" >> .gitignore
git add .gitignore
git commit -m "Add .gitignore"
```

### 1.2 — Create a GitHub repository

1. Go to [github.com/new](https://github.com/new)
2. Name it `my-sync` (or any name you prefer)
3. Set it to **Public** (free tier deployment platforms work best with public repos; private repos may require a paid plan on some platforms)
4. Do NOT initialize with README

### 1.3 — Push your code

```bash
git remote add origin https://github.com/YOUR_USERNAME/my-sync.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy the Backend on Render

### 2.1 — Create a Render account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Authorize GitHub access to your repos

### 2.2 — Create a Web Service

1. Click **New +** → **Web Service**
2. Connect your `my-sync` GitHub repository
3. Configure the settings:

| Setting | Value |
|---------|-------|
| **Name** | `my-sync-backend` |
| **Region** | `Oregon (US West)` or closest to you |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node index.js` |
| **Instance Type** | **Free** |

### 2.3 — Set Environment Variables

In the Render dashboard, go to your service → **Environment** → **Add Environment Variable**:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | Your Supabase project URL (e.g., `https://xyz.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | Your Supabase `service_role` key |
| `PORT` | `10000` (Render sets this automatically) |
| `FRONTEND_URL` | Your Vercel URL (add later, e.g., `https://my-sync.vercel.app`) |
| `NODE_ENV` | `production` |

> ⚠️ **Never put `SUPABASE_SERVICE_KEY` in your frontend code.** It must only exist in the backend environment.

### 2.4 — Deploy

Click **Create Web Service**. Render will:
1. Detect your `backend/package.json`
2. Run `npm install`
3. Run `node index.js`

You'll get a live URL like `https://my-sync-backend.onrender.com`. **Note this URL** — you'll need it for the next step.

### 2.5 — Enable Auto-Deploy

By default, Render automatically deploys when you push to `main`. You can verify this in Settings → **Auto-Deploy**.

---

## Step 3: Deploy the Frontend on Vercel

### 3.1 — Create a Vercel account

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Authorize GitHub access

### 3.2 — Import Your Project

1. Click **Add New...** → **Project**
2. Import your `my-sync` repository
3. Configure the settings:

| Setting | Value |
|---------|-------|
| **Framework Preset** | `Vite` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Dev Command** | `npm run dev` |
| **Install Command** | `npm install` |

### 3.3 — Set Environment Variables

In the Vercel dashboard, go to your project → **Settings** → **Environment Variables**:

| Key | Value |
|-----|-------|
| `VITE_API_BASE` | `/api` |

For local development, Vite uses the proxy in `vite.config.js`. For production, Vercel redirects `/api/*` to your backend.

### 3.4 — Add a Backend Redirect (Critical!)

Vercel needs to forward API requests to your Render backend. Create a `vercel.json` at the project root (already exists, but update it):

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "devCommand": "cd frontend && npm run dev",
  "installCommand": "cd frontend && npm install",
  "framework": "vite",
  "regions": ["iad1"],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://my-sync-backend.onrender.com/api/:path*"
    }
  ]
}
```

> Replace `https://my-sync-backend.onrender.com` with your actual Render URL from Step 2.4.

### 3.5 — Deploy

Click **Deploy**. Vercel will:
1. Detect `vite.config.js` and `package.json`
2. Build the frontend
3. Deploy to a URL like `https://my-sync.vercel.app`

**Note this URL** — you'll need it for the next step.

### 3.6 — Update the Backend's `FRONTEND_URL`

Go back to Render (Step 2.3) and update the `FRONTEND_URL` environment variable to your Vercel URL (e.g., `https://my-sync.vercel.app`). This ensures CORS works correctly.

---

## Step 4: Set Up Supabase Database

### 4.1 — Run the Schema

1. Go to [supabase.com](https://supabase.com) → your project
2. Open **SQL Editor**
3. Paste and run the contents of `backend/schema.sql`
4. Click **Run**

This creates the `sessions`, `devices`, and `clipboard_items` tables.

### 4.2 — Get Credentials

1. Go to **Settings → API**
2. Copy:
   - **Project URL** → this is your `SUPABASE_URL`
   - **anon public key** → for reference
   - **service_role key** → this is your `SUPABASE_SERVICE_KEY` (keep it secret!)

### 4.3 — Verify Tables Exist

Go to **Table Editor** in Supabase and confirm you see:
- `sessions`
- `devices`
- `clipboard_items`

---

## Step 5: Test Your Live App

### 5.1 — Open the App

1. Go to your Vercel URL (e.g., `https://my-sync.vercel.app`)
2. Click **Start Clipboard**
3. Copy the 6-digit PIN
4. Open a new browser window/tab (simulating a second device)
5. Go to the same URL
6. Paste the PIN → **Join**
7. Copy text on Device A → it should appear on Device B instantly

### 5.2 — Test Features

- **Text sync**: Copy any text → appears on both devices
- **Image upload**: Drag-and-drop or paste an image → syncs
- **Session expiry**: Wait 30+ minutes → session auto-expires
- **Connection status**: Check the header shows "Connected"
- **End session**: Click "End Session" on the host device

---

## Step 6: Add a Custom Domain

### 6.1 — Buy a Domain (if you don't have one)

Popular registrars:
- [Namecheap](https://namecheap.com) — ~$5-10/year
- [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) — ~$9/year
- [Google Domains](https://domains.google) — ~$12/year

Buy something like `mysync.yourdomain.com` or just `mysync.app`.

### 6.2 — Add Domain to Vercel

1. Go to Vercel dashboard → your project → **Settings** → **Domains**
2. Click **Add**
3. Enter your domain (e.g., `sync.myapp.com`)
4. Vercel will show you DNS records to add

### 6.3 — Configure DNS at Your Registrar

Go to your domain registrar's DNS settings and add the records Vercel provided:

**For Vercel (frontend):**
| Type | Name | Value |
|------|------|-------|
| CNAME | `sync` | `cname.vercel-dns.com` |
| OR A | `@` | `76.76.21.21` (Vercel's default) |

**For Render (backend) — if you also want a backend domain:**
| Type | Name | Value |
|------|------|-------|
| CNAME | `api` | `my-sync-backend.onrender.com` |

### 6.4 — Add Domain to Render (Optional)

1. Go to Render dashboard → your backend service → **Settings** → **Custom Domains**
2. Add your backend domain (e.g., `api.myapp.com`)
3. Render will provide DNS records to add at your registrar
4. Click **Add Domain** and wait for verification

### 6.5 — Verify

1. Wait 5-15 minutes for DNS propagation
2. Visit your custom domain
3. The app should work with HTTPS automatically (Vercel and Render provide free SSL certificates)

---

## Step 7: Optional — Use Cloudflare for DNS + SSL

Cloudflare can provide additional performance and security:

1. Sign up at [cloudflare.com](https://cloudflare.com)
2. Add your domain to Cloudflare
3. Update your registrar's nameservers to Cloudflare's
4. In Cloudflare DNS:
   - Create a CNAME record pointing `sync` → `my-sync.vercel.app`
   - Enable **Proxy** (orange cloud) for CDN + SSL
5. Vercel will still handle the SSL certificate automatically

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| App shows blank page | Check Vercel build logs — likely a build error |
| CORS errors | Verify `FRONTEND_URL` matches your Vercel URL exactly |
| Socket.IO not connecting | Check that `vercel.json` has the rewrite rule for `/api/*` |
| "Session not found" | Verify Supabase tables are created and `SUPABASE_SERVICE_KEY` is correct |
| Images not loading | Verify image MIME types are in the allowed list (JPEG, PNG, GIF, WebP) |
| Custom domain shows warning | Wait for DNS propagation, or check that SSL certificate is issued |
| Backend crashes | Check Render logs — likely a Supabase connection issue |
| PIN not generating | Verify `crypto.randomBytes` works in Node 20+ |

---

## Cost Summary

| Service | Cost | Tier |
|---------|------|------|
| Vercel (frontend) | $0 | Free |
| Render (backend) | $0 | Free |
| Supabase (database) | $0 | Free |
| Domain registrar | ~$5-12/year | Optional |
| Cloudflare (optional) | $0 | Free |
| **Total** | **~$0-12/year** | |

---

## Architecture Diagram

```
User Browser
    │
    ├── Vercel (Frontend) ─── my-sync.vercel.app
    │       │
    │       ├── /api/* ────► Render (Backend) ─── my-sync-backend.onrender.com
    │       │                     │
    │       │                     ├── Supabase (Database) ─── my-sync.supabase.co
    │       │                     │       ├── sessions table
    │       │                     │       ├── devices table
    │       │                     │       └── clipboard_items table
    │       │                     │
    │       │                     └── WebSocket (Socket.IO)
    │       │
    │       └── /socket.io ──► Render (Backend)
    │
    └── Custom Domain: sync.myapp.com ──► Vercel
```

---

## Post-Deployment Checklist

- [ ] App loads at custom domain with HTTPS
- [ ] Can create a session and get a PIN
- [ ] Can join a session from another browser/device
- [ ] Text syncs between devices
- [ ] Image upload and sync works
- [ ] Session auto-expires after inactivity
- [ ] "End Session" wipes all data
- [ ] Connection status indicator works
- [ ] Dark/light mode toggles
- [ ] Mobile layout looks correct
- [ ] No errors in browser console or server logs