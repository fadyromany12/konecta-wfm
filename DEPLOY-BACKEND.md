# Deploy database + backend (step-by-step)

Use this after your **frontend is on Vercel**. Pick **one** option below. All are free-tier friendly.

---

## Option 1: Railway (database + backend together)

**What you get:** PostgreSQL + Node backend on one dashboard. Free tier: ~$5 credit/month.

### Step 1 – Create project and database

1. Go to **[railway.app](https://railway.app)** and sign in with **GitHub**.
2. Click **“New Project”**.
3. Choose **“Deploy from GitHub repo”**.
4. Select your repo: **`fadyromany12/konecta-wfm`** (or your fork). If it’s not listed, click **“Configure GitHub App”** and allow Railway to see the repo.
5. After the project is created, you’ll see one service. First, add the database:
   - Click **“+ New”** (or **“Add Service”**) in the project.
   - Click **“Database”** → **“Add PostgreSQL”**.
6. Open the **PostgreSQL** service, go to the **“Variables”** tab.
7. Copy the value of **`DATABASE_URL`** (starts with `postgresql://`). You’ll paste it into the backend in Step 3.

### Step 2 – Configure the backend service

1. In the same project, click the **first service** (the one created from your repo). If you only have the PostgreSQL service, click **“+ New”** → **“GitHub Repo”** and select **`fadyromany12/konecta-wfm`** again.
2. Open that service → **“Settings”** (or the gear icon).
3. Set **Root Directory**: type **`backend`** and save.
4. Under **Build**:
   - **Build Command:** `npm install && npm run build`
5. Under **Deploy** (or **Start**):
   - **Start Command:** `node dist/index.js`
6. **Generate a JWT secret** (use one of these):
   - In PowerShell: `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])`
   - Or use any long random string (e.g. from [randomkeygen.com](https://randomkeygen.com) “Code 128 bit”).
7. Go to the **“Variables”** tab of the **backend** service. Click **“Add Variable”** or **“New Variable”** and add:

   | Name             | Value |
   |------------------|--------|
   | `DATABASE_URL`   | Paste the `DATABASE_URL` you copied from the PostgreSQL service. (Or use Railway’s “Reference” to link it: `${{Postgres.DATABASE_URL}}` if your Postgres service is named “Postgres”.) |
   | `JWT_SECRET`     | The long random string you generated. |
   | `NODE_ENV`       | `production` |
   | `JWT_EXPIRES_IN`| `2592000` (optional; 30 days) |
   | `FRONTEND_ORIGIN` | Your Vercel frontend URL, e.g. `https://konecta-wfm.vercel.app` (no trailing slash). |

8. Save. Railway will **redeploy** automatically.

### Step 3 – Get the backend URL

1. In the backend service, open **“Settings”** and find **“Networking”** or **“Public Networking”**.
2. Click **“Generate Domain”** (or **“Add Domain”**). Railway will give you a URL like `https://konecta-wfm-production-xxxx.up.railway.app`.
3. Copy this URL. Your **API base URL** for the frontend is: **that URL + `/api`**, e.g. `https://konecta-wfm-production-xxxx.up.railway.app/api`.

### Step 4 – Set frontend env on Vercel

1. Go to **[vercel.com](https://vercel.com)** → your project → **Settings** → **Environment Variables**.
2. Add (or edit):
   - **Name:** `NEXT_PUBLIC_API_BASE_URL`
   - **Value:** `https://your-railway-backend-url.up.railway.app/api` (the URL from Step 3, with `/api` at the end).
3. Redeploy the frontend (Deployments → … → Redeploy).

### Step 5 – Run database setup (one-time)

1. In Railway, open your **backend** service.
2. Go to **“Settings”** and find **“Shell”** or **“One-off command”**, or open the **“Deployments”** tab and use **“View Logs”** to see if there’s a “Run command” option. Alternatively use **“Settings”** → **“Service”** and check for **“Custom start command”** – the normal start is `node dist/index.js`; we’re not changing that.
3. If Railway offers a **Shell / Console** for the service: open it and run:
   ```bash
   npm run setup-db
   ```
   If there’s no shell, use **“Deploy”** → trigger a new deploy; ensure your backend has a way to run migrations (e.g. run `setup-db` locally once against the production `DATABASE_URL`, or add a one-off job if Railway supports it).
4. **If you can’t run a shell:** On your own PC, set `DATABASE_URL` in a `.env` file to the **same** Railway Postgres URL, then in the `backend` folder run:
   ```bash
   npm run setup-db
   ```
   That will create tables in the hosted database.

You’re done. Open your Vercel frontend URL and log in or register.

---

## Option 2: Render (database + backend)

**What you get:** Free PostgreSQL + free Web Service (backend). Free tier may spin down after inactivity.

### Step 1 – Create PostgreSQL database

1. Go to **[render.com](https://render.com)** and sign in with **GitHub**.
2. Dashboard → **“New +”** → **“PostgreSQL”**.
3. **Name:** e.g. `konecta-wfm-db`. **Region:** choose one (e.g. Oregon).
4. Click **“Create Database”**.
5. When it’s ready, open the database. In **“Connections”** you’ll see **“Internal Database URL”** (use this; it’s only for services on Render). Copy the full URL (starts with `postgres://`).

### Step 2 – Create backend Web Service

1. Dashboard → **“New +”** → **“Web Service”**.
2. Connect **GitHub** and select repo **`fadyromany12/konecta-wfm`**.
3. **Name:** e.g. `konecta-wfm-api`.
4. **Region:** same as the database.
5. **Root Directory:** type **`backend`**.
6. **Runtime:** Node.
7. **Build Command:** `npm install && npm run build`
8. **Start Command:** `node dist/index.js`
9. **Instance type:** Free (or pick a paid plan if you prefer).
10. Click **“Advanced”** (if shown) and add **Environment Variables**:

    | Key               | Value |
    |-------------------|--------|
    | `NODE_ENV`        | `production` |
    | `DATABASE_URL`   | Paste the **Internal Database URL** from Step 1. |
    | `JWT_SECRET`     | Long random string (e.g. from [randomkeygen.com](https://randomkeygen.com)). |
    | `JWT_EXPIRES_IN` | `2592000` (optional) |
    | `FRONTEND_ORIGIN`| Your Vercel URL, e.g. `https://konecta-wfm.vercel.app` |

11. Click **“Create Web Service”**. Render will build and deploy. The backend URL will be like `https://konecta-wfm-api.onrender.com`.

### Step 3 – Frontend env on Vercel

1. Vercel → your project → **Settings** → **Environment Variables**.
2. Set **`NEXT_PUBLIC_API_BASE_URL`** = `https://konecta-wfm-api.onrender.com/api` (your Render backend URL + `/api`).
3. Redeploy the frontend.

### Step 4 – Run database setup (one-time)

1. In Render, open your **backend** Web Service.
2. Go to **“Shell”** (in the left menu or under the service). If Shell is available:
   - Run: `npm run setup-db`
3. **If Shell is not available:** On your PC, create a `.env` in `backend` with only:
   ```env
   DATABASE_URL=<paste the same Internal Database URL from Render>
   ```
   Then in `backend` run: `npm run setup-db`. Tables will be created in the Render Postgres.

Done. Use your Vercel URL to open the app.

---

## Option 3: Neon (database) + Railway (backend)

**What you get:** Free PostgreSQL on Neon + backend on Railway. Good if you want to separate DB and backend.

### Step 1 – Create Neon database

1. Go to **[neon.tech](https://neon.tech)** and sign in (GitHub or email).
2. **New Project**. Name it e.g. `konecta-wfm`. Region: pick one.
3. After creation, you’ll see a **Connection string**. Copy the one that looks like:
   `postgresql://user:password@ep-xxx.region.aws.neon.tech/neon?sslmode=require`
   This is your **`DATABASE_URL`**.

### Step 2 – Deploy backend on Railway

1. Go to **[railway.app](https://railway.app)** → **New Project** → **Deploy from GitHub repo** → select **`fadyromany12/konecta-wfm`**.
2. Open the deployed service → **Settings**.
3. **Root Directory:** `backend`.
4. **Build Command:** `npm install && npm run build`
5. **Start Command:** `node dist/index.js`
6. **Variables** tab → Add:
   - `DATABASE_URL` = the **Neon** connection string from Step 1.
   - `JWT_SECRET` = long random string.
   - `NODE_ENV` = `production`
   - `FRONTEND_ORIGIN` = your Vercel URL (e.g. `https://konecta-wfm.vercel.app`)
7. **Networking** → Generate domain. Copy the backend URL (e.g. `https://xxx.up.railway.app`).

### Step 3 – Vercel and DB setup

1. Vercel: set **`NEXT_PUBLIC_API_BASE_URL`** = `https://xxx.up.railway.app/api`.
2. Run DB setup once: on your PC, in `backend`, set `DATABASE_URL` in `.env` to the **Neon** URL and run `npm run setup-db`. Or use Railway Shell if available: `npm run setup-db`.

Done.

---

## Option 4: Neon (database) + Fly.io (backend)

**What you get:** Free Postgres on Neon + backend on Fly.io free allowance.

### Step 1 – Neon database

Same as Option 3 Step 1: create a project at **[neon.tech](https://neon.tech)** and copy the PostgreSQL connection string → **`DATABASE_URL`**.

### Step 2 – Install Fly CLI and deploy backend

1. Install **flyctl**:  
   - Windows (PowerShell): `powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"`  
   - Or see [fly.io/docs/hands-on/install-flyctl](https://fly.io/docs/hands-on/install-flyctl).
2. Log in: `fly auth login`.
3. In your project folder (repo root), from the **backend** folder:
   ```bash
   cd backend
   fly launch
   ```
   - Choose app name (or auto-generated).
   - Don’t create a Postgres app (we use Neon).
   - Region: pick one.
4. Set secrets (env):
   ```bash
   fly secrets set DATABASE_URL="postgresql://..." JWT_SECRET="your-long-secret" FRONTEND_ORIGIN="https://konecta-wfm.vercel.app"
   ```
   Use your real Neon `DATABASE_URL` and Vercel URL.
5. Deploy:
   ```bash
   fly deploy
   ```
6. Get URL: `fly status` or dashboard. Backend URL is like `https://your-app-name.fly.dev`. API base = `https://your-app-name.fly.dev/api`.

### Step 3 – Fix Fly.io start command (if needed)

Fly may expect a different start. If the app doesn’t start, add a **Dockerfile** in `backend` or set the run command in `fly.toml`:

```toml
[env]
  PORT = "8080"

[[services]]
  internal_port = 8080
  protocol = "tcp"
  ...
```

And ensure the backend listens on `process.env.PORT || 8080`. Then:

```bash
fly deploy
```

### Step 4 – Vercel and DB setup

1. Vercel: **`NEXT_PUBLIC_API_BASE_URL`** = `https://your-app-name.fly.dev/api`.
2. Run `npm run setup-db` once (locally with `DATABASE_URL` = Neon URL, or via Fly console if available).

Done.

---

## Option 5: Supabase (database) + Railway or Render (backend)

**What you get:** Free PostgreSQL on Supabase + backend on Railway or Render.

### Step 1 – Supabase database

1. Go to **[supabase.com](https://supabase.com)** → **New project**.
2. Name, password, region. Create.
3. **Project Settings** → **Database** → **Connection string** → **URI**. Copy it (use the one with session mode if you have options). This is **`DATABASE_URL`**. It may look like:
   `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

### Step 2 – Backend on Railway or Render

- **Railway:** Same as Option 1 Step 2–3, but set **`DATABASE_URL`** = the Supabase connection string.
- **Render:** Same as Option 2 Step 2, but set **`DATABASE_URL`** = the Supabase connection string.

### Step 3 – Vercel and DB setup

1. Vercel: **`NEXT_PUBLIC_API_BASE_URL`** = your backend URL + `/api`.
2. Run `npm run setup-db` once with `DATABASE_URL` = Supabase URL (locally or via host’s shell).

Done.

---

## Checklist (any option)

- [ ] **Database** created and **`DATABASE_URL`** copied.
- [ ] **Backend** deployed with **Root directory** = `backend`, build = `npm install && npm run build`, start = `node dist/index.js`.
- [ ] Backend env: **`DATABASE_URL`**, **`JWT_SECRET`**, **`FRONTEND_ORIGIN`** (your Vercel URL).
- [ ] Backend has a **public URL** (e.g. `https://xxx.up.railway.app` or `https://xxx.onrender.com`).
- [ ] **Vercel** env: **`NEXT_PUBLIC_API_BASE_URL`** = backend URL + **`/api`**.
- [ ] **`npm run setup-db`** run once against the hosted database (Shell on host or locally with same `DATABASE_URL`).
- [ ] Open Vercel URL, register or log in, and test.

If something fails, check backend logs (Railway/Render/Fly dashboard) and that CORS has **`FRONTEND_ORIGIN`** set to your exact Vercel URL (no trailing slash).
