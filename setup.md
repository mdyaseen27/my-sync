# Setup & Deployment Guide

Detailed instructions for setting up and deploying MY Sync.

## Prerequisites

- Node.js 20+
- npm 10+
- A Supabase project (free tier)

## Step 1: Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project** and give it a name
3. Wait for the project to provision
4. Go to **SQL Editor** in the Supabase dashboard
5. Run `backend/schema.sql` to create all tables
6. Go to **Settings → API** and copy:
   - **Project URL** (e.g., `https://xyzcompany.supabase.co`)
   - **anon public key** (for frontend)
   - **service_role key** (for backend — keep this secret!)

## Step 2: Environment Configuration

### Backend (`.env` in `backend/`)

```env
# Copy from .env.example
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
PORT=3001
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

> ⚠️ **Never commit `.env` files to version control.**

### Frontend (`.env` in `frontend/`)

```env
VITE_API_BASE=/api
```

## Step 3: Local Development

```bash
# Run the setup script (optional but recommended)
./setup.sh

# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173).

## Step 4: Deployment

### Frontend — Vercel

1. Push your repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import your repo
4. Set **Build Command**: `cd frontend && npm install && npm run build`
5. Set **Dev Command**: `cd frontend && npm run dev`
6. Set **Framework Preset**: `vite`
7. Add environment variable: `VITE_API_BASE=/api`
8. Deploy

### Frontend — Netlify

1. Push your repo to GitHub
2. Go to [netlify.com](https://netlify.com) → **Add new site**
3. Import your repo
4. Set **Build command**: `cd frontend && npm install && npm run build`
5. Set **Publish directory**: `frontend/dist`
6. Add `netlify.toml` (already included)
7. Deploy

### Backend — Render

1. Go to [render.com](https://render.com) → **New Web Service**
2. Connect your GitHub repo
3. Set **Build Command**: `cd backend && npm install`
4. Set **Start Command**: `node backend/index.js`
5. Set **Environment Variables**: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PORT`
6. Add a **PostgreSQL** database (free tier)
7. Deploy

### Backend — Docker

```bash
docker build -t my-sync .
docker run -p 3001:3001 --env-file backend/.env my-sync
```

### Database — Supabase (already set up)

No additional database configuration needed. Supabase handles all storage.

## Step 5: SSL/HTTPS

All deployments above provide HTTPS automatically. The backend uses Helmet for HSTS headers.

## Verification

After deployment, test:
1. Create a session on one device → get a 6-digit PIN
2. Join the session on another device with the PIN
3. Copy text on one device → appears on the other
4. Upload an image → appears on the other
5. Wait 30 minutes of inactivity → session auto-expires

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Socket.IO not connecting | Check that `/socket.io` proxy is configured in Vite |
| Supabase errors | Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct |
| CORS errors | Ensure `FRONTEND_URL` matches your deployed frontend URL |
| PIN not generating | Check that `crypto.randomBytes` is available (Node 19+) |
| Session not expiring | Verify the cleanup interval is running in the backend |
| Images not displaying | Check that image types are in the allowed list (JPEG, PNG, GIF, WebP) |

## CI/CD

GitHub Actions runs on every push:
- Lint backend and frontend
- Run `npm audit` for security vulnerabilities
- Build frontend

See `.github/workflows/ci.yml` for configuration.