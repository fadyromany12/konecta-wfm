# How to host Konecta WFM online

Your app has three parts:

1. **Frontend** – Next.js (in `frontend/`)
2. **Backend** – Node/Express API (in `backend/`)
3. **Database** – PostgreSQL

**For exact step-by-step deployment of database + backend** (Railway, Render, Neon, Fly.io, Supabase), see **[DEPLOY-BACKEND.md](./DEPLOY-BACKEND.md)**.

Below are two simple ways to get everything online.

---

## Option A: Vercel (frontend) + Render (backend + database)

Good if you want the frontend on Vercel and backend/DB on Render.

### 1. Database and backend on Render

1. Go to [render.com](https://render.com) and sign in (or use GitHub).
2. **Create a PostgreSQL database**
   - Dashboard → **New +** → **PostgreSQL**
   - Name it (e.g. `konecta-wfm-db`)
   - Region: pick one close to you
   - Create. Copy the **Internal Database URL** (you’ll use it as `DATABASE_URL`).
3. **Create a Web Service for the backend**
   - **New +** → **Web Service**
   - Connect the repo: `fadyromany12/konecta-wfm` (or your fork)
   - **Root directory:** `backend`
   - **Build command:** `npm install && npm run build`
   - **Start command:** `node dist/index.js`
   - **Environment variables** (use “Add Environment Variable”):
     - `NODE_ENV` = `production`
     - `PORT` = `4000` (or leave default; Render sets `PORT` automatically)
     - `DATABASE_URL` = paste the **Internal Database URL** from step 2
     - `JWT_SECRET` = generate a long random string (e.g. `openssl rand -hex 32`)
     - `JWT_EXPIRES_IN` = `2592000` (30 days, optional)
     - `FRONTEND_ORIGIN` = leave empty for now; you’ll set it after deploying the frontend
   - Create Web Service. Note the backend URL, e.g. `https://konecta-wfm-api.onrender.com`.

4. **Run migrations and seed** (one-time)
   - In Render dashboard, open your backend service → **Shell** (or use a one-off job).
   - Run:
     ```bash
     cd backend
     npm run setup-db
     ```
   - If you have other migrations (e.g. `migrate:acid`, `migrate:enterprise`), run them too.

5. **Set CORS**
   - In the same backend service, add/update:
     - `FRONTEND_ORIGIN` = your frontend URL (e.g. `https://konecta-wfm.vercel.app`).

### 2. Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Import** the repo `fadyromany12/konecta-wfm` (or your fork).
3. **Root directory:** set to `frontend` (or leave default if the repo root is the frontend).
4. **Environment variable:**
   - `NEXT_PUBLIC_API_BASE_URL` = your backend URL, e.g. `https://konecta-wfm-api.onrender.com/api`
   - (No trailing slash; the app will call `${NEXT_PUBLIC_API_BASE_URL}/auth/login`, etc.)
5. Deploy. Vercel will give you a URL like `https://konecta-wfm.vercel.app`.

### 3. Connect frontend and backend

- In **Render** (backend service), set:
  - `FRONTEND_ORIGIN` = `https://konecta-wfm.vercel.app` (your Vercel URL)
- In the frontend, ensure all API requests use `NEXT_PUBLIC_API_BASE_URL` (your backend + `/api`). If the app uses a proxy in dev, in production it should point to the Render backend URL.

---

## Option B: Everything on Render

You can host frontend, backend, and database all on Render.

1. **PostgreSQL** – Same as Option A: create a PostgreSQL instance and copy the Internal Database URL.
2. **Backend** – Same as Option A: Web Service, root `backend`, build `npm install && npm run build`, start `node dist/index.js`, same env vars (including `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_ORIGIN`).
3. **Frontend** – **New +** → **Web Service**
   - Repo: same repo
   - **Root directory:** `frontend`
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
   - **Environment variable:** `NEXT_PUBLIC_API_BASE_URL` = `https://YOUR-BACKEND-SERVICE.onrender.com/api`
4. After the frontend is deployed, set the backend’s `FRONTEND_ORIGIN` to the frontend’s Render URL (e.g. `https://konecta-wfm-frontend.onrender.com`).

---

## Environment variables summary

**Backend (Render / any Node host)**

| Variable | Required | Example |
|----------|----------|--------|
| `DATABASE_URL` | Yes | `postgres://user:pass@host:5432/dbname` |
| `JWT_SECRET` | Yes | Long random string |
| `FRONTEND_ORIGIN` | Yes in prod | `https://your-frontend.vercel.app` |
| `PORT` | Set by host | Render sets this |
| `JWT_EXPIRES_IN` | No | `2592000` (30 days) |
| `NODE_ENV` | No | `production` |

**Frontend (Vercel / Render)**

| Variable | Required | Example |
|----------|----------|--------|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | `https://your-backend.onrender.com/api` |

---

## After deployment

1. Open the frontend URL and register or log in.
2. If you use “admin approval”, approve the first user from the backend (e.g. set `is_approved = true` in the DB) or use an admin seed.
3. For email (password reset, etc.), set the optional SMTP env vars on the backend (e.g. Brevo).

---

## Free alternatives to Render

If you prefer not to use Render, here are **free** options for backend + PostgreSQL (frontend can stay on **Vercel**, which is free).

| Service | Free tier | What you get |
|--------|-----------|----------------|
| **Railway** | $5 credit/month (enough for small apps) | PostgreSQL + Node backend. Connect repo, set root `backend`, add Postgres plugin, use its `DATABASE_URL`. |
| **Fly.io** | Free allowance for small VMs | Postgres + Node apps. Good docs; you deploy with `flyctl`. |
| **Koyeb** | Free tier (1 web service + limits) | Run backend; use external DB (e.g. Neon). Or use Koyeb Postgres if available in your region. |
| **Neon** (DB only) | Free tier | Serverless PostgreSQL. Use Neon only as `DATABASE_URL` and host the backend on Railway / Fly.io / Koyeb. |
| **Supabase** | Free tier | PostgreSQL + extras. Use the Postgres connection string as `DATABASE_URL`; host backend elsewhere (Railway, Fly, Koyeb). |
| **Oracle Cloud** | Always-free tier | Free VMs + optional free DB. More setup (VM, Node, PM2, Postgres install) but no time limit. |
| **Cyclic** | Free (Node only) | Node/Express backend only; no built-in Postgres. Pair with Neon or Supabase for DB. |

### Quick setup: Vercel (frontend) + Railway (backend + DB)

1. **Railway** ([railway.app](https://railway.app)) – Sign in with GitHub.
2. **New Project** → **Add PostgreSQL**. Copy the `DATABASE_URL` from Variables.
3. **New Service** → deploy from GitHub repo; set **Root Directory** to `backend`.
   - Build: `npm install && npm run build`
   - Start: `node dist/index.js`
   - Add env: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_ORIGIN` (after you have the frontend URL).
4. Deploy frontend on **Vercel**, set `NEXT_PUBLIC_API_BASE_URL` to your Railway backend URL (e.g. `https://your-app.up.railway.app/api`).
5. Set Railway `FRONTEND_ORIGIN` to your Vercel URL. Run DB setup once (Railway → backend service → Shell: `npm run setup-db`).

### Quick setup: Neon (DB) + Fly.io (backend)

1. **Neon** ([neon.tech](https://neon.tech)) – Create a project, copy the Postgres connection string → `DATABASE_URL`.
2. **Fly.io** ([fly.io](https://fly.io)) – Install `flyctl`, create app for `backend` (see [Fly.io Node docs](https://fly.io/docs/languages-and-frameworks/node/)). Set `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_ORIGIN`.
3. Frontend on **Vercel**; `NEXT_PUBLIC_API_BASE_URL` = your Fly backend URL.

---

## Other hosts (paid or trial)

- **DigitalOcean App Platform** – Add a Postgres DB and two components: backend (Node) and frontend (Node with build `npm run build`, run `npm start` in `frontend`).
- **Heroku** – No longer has a free tier; paid only.

In all cases: set `DATABASE_URL` and `JWT_SECRET` on the backend, and point the frontend’s `NEXT_PUBLIC_API_BASE_URL` at your backend API URL. Set the backend’s `FRONTEND_ORIGIN` to the frontend URL so CORS and redirects work.
