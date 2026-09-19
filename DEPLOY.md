# MY Sync — Deployment Guide

## Architecture

Everything runs on **Render** (single server). Frontend, backend, and Socket.IO all on one domain.

```
User Browser
    │
    └── https://my-sync.onrender.com (Render)
            ├── Express server (frontend static files + API routes)
            ├── Socket.IO (real-time sync)
            └── Supabase (database)
```

## Prerequisites

- [x] GitHub account
- [x] `my-sync` repo pushed to GitHub
- [x] Supabase project with `pins` and `clipboard_items` tables

## Step 1: Push Code

```bash
cd my-sync
git add -A
git commit -m "Deploy"
git push origin main
```

Render auto-deploys on push (Auto-Deploy enabled).

## Step 2: Supabase Setup (one-time)

1. Go to [supabase.com](https://supabase.com) → your `my-sync` project
2. **SQL Editor** → paste `backend/schema.sql` → **Run**
3. **Settings → API** → copy `SUPABASE_URL` and `service_role` key

## Step 3: Deploy on Render

1. Go to [render.com](https://render.com) → **Sign up with GitHub**
2. **New +** → **Web Service** → select `my-sync` repo
3. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm run build`
   - **Start Command**: `node index.js`
   - **Instance Type**: **Free**
   - **Region**: closest to you
4. **Environment Variables**:
   - `SUPABASE_URL` = your Supabase URL
   - `SUPABASE_SERVICE_KEY` = your service_role key
   - `PORT` = `10000`
5. Click **Create Web Service**
6. Wait 3-5 minutes for the build (it builds the frontend too)
7. Your app is live at `https://my-sync.onrender.com`

## Step 4: Verify

1. Open `https://my-sync.onrender.com`
2. If no PIN set → **Set Your PIN** → choose a 6-digit PIN
3. Enter PIN → click **Access**
4. Copy text → it syncs in real-time via WebSocket
5. Test with a second browser tab using the same PIN

## Step 5: Custom Domain

1. Buy domain (e.g., `mysync.app`) from Namecheap or Cloudflare (~$5/year)
2. Render → your service → **Settings → Custom Domains** → add domain
3. Follow DNS instructions → update at your registrar
4. Wait 5-15 minutes → free SSL certificate issued

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails | Check Render logs → likely vite not installed |
| PIN not working | Verify `pins` table exists in Supabase |
| Clipboard not syncing | Check Socket.IO connection in browser console |
| 404 on refresh | `app.get('*')` serves `index.html` for SPA routing |
| CORS errors | Everything is on same domain, no CORS needed |

## Cost

| Service | Cost |
|---------|------|
| Render | $0 (free tier) |
| Supabase | $0 (free tier) |
| Domain | ~$5-12/year (optional) |
| **Total** | **$0-12/year** |