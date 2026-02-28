# Konecta WFM

Workforce management app: attendance, AUX, leave, schedules, shift swaps, approvals, and admin tools.

## Quick start (development)

### 1. Database

Create a PostgreSQL database and user, then run **one** of these:

**Option A – One command (recommended)**  
From the `backend` folder (with `.env` and `DATABASE_URL` set):

```bash
cd backend
npm run setup-db
```

This runs `schema.sql`, `seed.sql`, `sql/migrations_extra.sql`, and `sql/migrations_enterprise.sql` in order.

**Option B – Manual with psql**  
From project root:

```bash
psql -U konecta -d konecta_wfm -f backend/schema.sql
psql -U konecta -d konecta_wfm -f backend/seed.sql
psql -U konecta -d konecta_wfm -f backend/sql/migrations_extra.sql
psql -U konecta -d konecta_wfm -f backend/sql/migrations_enterprise.sql
```

On Windows if `psql` is not in PATH, use the full path to `psql.exe` or run `backend\setup-db.cmd` (after editing it to point to your PostgreSQL `bin` folder).

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET
npm install
npm run dev
```

Runs at http://localhost:4000

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
# .env.local: NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000/api
npm install
npm run dev
```

Runs at http://localhost:3000

---

## Login credentials (after seed)

| Role   | Email                    | Password  |
|--------|--------------------------|-----------|
| Admin  | admin@konecta.com        | Password1 |
| Manager| manager@konecta.com      | Password1 |
| Agent  | test.agent@konecta.com   | Password1 |

All emails must be `@konecta.com`.

---

## Production (plug and play)

1. **Database**
   - Create a PostgreSQL database.
   - Run in order: `schema.sql` → `seed.sql` → `sql/migrations_extra.sql` → `sql/migrations_enterprise.sql`.

2. **Backend**
   - Set `NODE_ENV=production`.
   - Set `DATABASE_URL` and a strong `JWT_SECRET`.
   - Set `FRONTEND_ORIGIN` to your frontend URL (e.g. `https://wfm.yourcompany.com`).
   - Optional: S3 and SMTP for uploads and email.
   - Run: `npm install && npm run build && npm start` (or use a process manager).

3. **Frontend**
   - Set `NEXT_PUBLIC_API_BASE_URL` to your backend API URL (e.g. `https://api.yourcompany.com/api`).
   - If the frontend is on a different domain, ensure the backend allows that origin in CORS (and optionally use a reverse proxy so the browser calls the same origin).
   - Run: `npm install && npm run build && npm start` (or deploy the `.next` output to your host).

4. **One-time edits**
   - Backend: only `.env` (and optionally S3/SMTP).
   - Frontend: only `.env.local` / production env with `NEXT_PUBLIC_API_BASE_URL`.
   - No code changes needed for a standard deployment.

---

## Hosting online (deploy on GitHub push)

You can host the app so that **pushing to GitHub** triggers deployment.

### Option 1: Vercel (frontend) + Railway (backend + DB)

1. **Push your code to GitHub** (create a repo and push this project).

2. **Backend + database (Railway)**
   - Go to [railway.app](https://railway.app), sign in with GitHub.
   - New Project → Deploy from GitHub repo → select your repo.
   - Add a **PostgreSQL** service (Railway will set `DATABASE_URL`).
   - In the same project, add a **service** for the backend:
     - Root directory: `backend` (or set in Settings).
     - Build: `npm install && npm run build`.
     - Start: `npm start`.
   - In backend service **Variables**, set:
     - `NODE_ENV=production`
     - `JWT_SECRET` (generate a long random string)
     - `FRONTEND_ORIGIN` = your frontend URL (e.g. `https://your-app.vercel.app`)
   - Run migrations once: in Railway’s backend service, run a one-off command (or use CLI):  
     `node scripts/setup-db.js` (with `DATABASE_URL` from the PostgreSQL service).
   - Note the backend URL (e.g. `https://your-backend.up.railway.app`).

3. **Frontend (Vercel)**
   - Go to [vercel.com](https://vercel.com), sign in with GitHub.
   - Import your repo. Set **Root Directory** to `frontend`.
   - In **Environment Variables** add:
     - `NEXT_PUBLIC_API_BASE_URL` = `https://your-backend.up.railway.app/api` (your Railway backend URL + `/api`)
   - Deploy. Every push to `main` will redeploy the frontend.

4. **CORS**
   - Backend already uses `FRONTEND_ORIGIN` for CORS. Set it to your Vercel URL so the browser can call the API.

After this, **push to GitHub** → Vercel redeploys the frontend; Railway redeploys the backend (if connected to the same repo and configured to watch `backend` or root).

### Option 2: Render

- **Web service** for backend (root or `backend` folder, build/start as above), **PostgreSQL** database, run migrations manually once.
- **Static site or Web Service** for frontend: use Next.js “Build Command” `npm run build`, “Start Command” `npm start`, root directory `frontend`, and set `NEXT_PUBLIC_API_BASE_URL` to your Render backend URL + `/api`.

### GitHub Actions (optional)

A workflow under `.github/workflows/ci.yml` runs **builds** on every push (frontend + backend). It does not deploy; it only checks that the project builds. Actual deployment is done by Vercel/Railway when you connect the repo.

---

## Features

- **Agent:** Clock in/out, AUX (break, lunch, etc. — break/lunch/last break once per day), leave requests (sick with file upload, overtime with start/end time), schedule, shift swap, profile.
- **Manager:** Team dashboard, **live wallboard**, leave and shift-swap approvals, schedule, team, **manager notes**, **disciplinary tracking**, **team attendance scores**, **alerts**.
- **Admin:** Users, CSV exports (attendance, leave, AUX, overtime, **payroll**), **wallboard**, schedule import and edit, audit logs, settings (holidays, departments, announcements), notifications, **system alerts**.

**Enterprise:** Payroll export (worked hours, overtime, leave deductions), wallboard (agents online/on break/late/overtime), manager notes & disciplinary, attendance scores, system alerts. Email: use Brevo SMTP (see `.env.example`).

---

## File layout

- `backend/` — Node + Express + TypeScript API.
- `frontend/` — Next.js 14 (App Router).
- `backend/schema.sql` — Base tables (run first).
- `backend/seed.sql` — Default users (admin, manager, agent).
- `backend/sql/migrations_extra.sql` — Extra tables (holidays, departments, announcements, password reset).
- `backend/sql/migrations_enterprise.sql` — Enterprise tables (attendance_scores, manager_notes, disciplinary_actions, payroll_exports, system_alerts, chat_messages).
