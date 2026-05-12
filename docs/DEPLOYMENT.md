# Deployment Guide — Vercel + Neon

This guide walks through deploying the Bank Statement OCR application to Vercel with a Neon PostgreSQL database.

---

## Architecture on Vercel

```
Browser
  │
  ├── GET /*, /dashboard, /admin   ──► Vercel CDN (frontend/dist static files)
  │
  └── /api/*                       ──► Vercel Serverless Function
                                         (backend/api/index.ts → Express app)
                                               │
                                         Neon PostgreSQL (pooled)
```

The frontend (React/Vite) and backend (Express) are deployed as a single Vercel project. `vercel.json` rewrites `/api/*` to the serverless function; everything else is served from the static build output.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| [Vercel account](https://vercel.com/signup) | Free Hobby plan is sufficient to start |
| [Neon account](https://neon.tech) | Free tier includes 0.5 GB storage |
| SMTP provider | Gmail App Password, Brevo, Resend, or SendGrid |
| Node.js >= 18 | For running migrations locally |
| Git repository | GitHub, GitLab, or Bitbucket |

---

## Step 1 — Set up the Neon Database

### 1.1 Create a Neon project

1. Log in to [console.neon.tech](https://console.neon.tech).
2. Click **New Project**.
3. Choose a region close to your Vercel deployment region (e.g. `us-east-1`).
4. Note the project name and region for later.

### 1.2 Get the connection strings

In your Neon project dashboard, go to **Connection Details**:

- **Direct URL** (for migrations and local dev):
  ```
  postgresql://user:pass@ep-xxx-yyy.us-east-1.aws.neon.tech/neondb?sslmode=require
  ```
- **Pooled URL** (for the serverless function — use this as `DATABASE_URL` in Vercel):
  ```
  postgresql://user:pass@ep-xxx-yyy.pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
  ```

> **Why the pooled URL?** Each Lambda instance opens its own connection. Without PgBouncer (Neon's built-in pooler), dozens of cold-start instances can exhaust PostgreSQL's `max_connections`. The pooled URL routes through Neon's PgBouncer, preventing this.

### 1.3 Run the database migration

Run the migration locally using the **direct** URL (PgBouncer doesn't support the DDL statements in migrations):

```bash
# From the project root
DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require" \
SUPER_ADMIN_EMAIL="your@email.com" \
npm run db:migrate --workspace=backend
```

Verify the tables were created:
```bash
psql "postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  -c "\dt"
```

---

## Step 2 — Configure SMTP

The app sends magic-link emails for passwordless login. Any SMTP provider works.

### Gmail (simplest for testing)

1. Enable 2-Step Verification on your Google account.
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. Generate an App Password (select **Mail** + **Other**).
4. Use these settings:

   | Variable | Value |
   |---|---|
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_SECURE` | `false` |
   | `SMTP_USER` | `your@gmail.com` |
   | `SMTP_PASS` | _(16-char App Password)_ |
   | `SMTP_FROM` | `"Bank Statement OCR <your@gmail.com>"` |

### Recommended for production: Resend or Brevo

Both have generous free tiers and better deliverability than Gmail SMTP.

- **Resend**: `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=resend`, `SMTP_PASS=<api-key>`
- **Brevo**: `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER=<login-email>`, `SMTP_PASS=<smtp-key>`

---

## Step 3 — Generate a JWT secret

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output. You'll paste it as `JWT_SECRET` in Vercel.

---

## Step 4 — Deploy to Vercel

### 4.1 Import the repository

1. Go to [vercel.com/new](https://vercel.com/new).
2. Click **Import Git Repository** and select your repository.
3. Vercel will detect the `vercel.json` at the root and pre-fill the build settings. **Do not change them** — the defaults from `vercel.json` are correct:
   - **Build Command**: `npm run build --workspace=shared && npm run vercel-build --workspace=frontend`
   - **Output Directory**: `frontend/dist`
   - **Install Command**: `npm ci`

### 4.2 Set environment variables

In the Vercel project settings → **Environment Variables**, add the following. Set each one for **Production** (and optionally **Preview**).

#### Required

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon pooled connection string | Must be the **pooled** URL |
| `JWT_SECRET` | 64-char hex string | From Step 3 |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` | Add custom domain too if applicable |
| `SMTP_HOST` | e.g. `smtp.gmail.com` | |
| `SMTP_PORT` | e.g. `587` | |
| `SMTP_SECURE` | `false` or `true` | |
| `SMTP_USER` | SMTP username / email | |
| `SMTP_PASS` | SMTP password / API key | |
| `SMTP_FROM` | `"App Name <noreply@yourdomain.com>"` | |
| `SUPER_ADMIN_EMAIL` | Your admin email | Used during migration |
| `VITE_API_URL` | `/api` | **Frontend** build variable — tells the React app to call `/api/*` on the same origin |

#### Optional

| Variable | Default | Notes |
|---|---|---|
| `MAX_FILE_SIZE_MB` | `10` | Maximum upload size in MB |
| `JWT_EXPIRES_IN` | `7d` | Session token lifetime |
| `NODE_ENV` | `production` | Already set in `vercel.json` env block |

> **`VITE_API_URL` is a build-time variable.** Vite embeds it into the JavaScript bundle at build time. After adding or changing it, you must trigger a new deployment (Vercel does this automatically when you push).

### 4.3 Deploy

Click **Deploy**. Vercel will:
1. Run `npm ci` to install all workspace dependencies.
2. Build the shared types package.
3. Build the frontend with Vite.
4. Bundle the backend serverless function.
5. Serve the static files from the CDN and route `/api/*` to the Lambda.

---

## Step 5 — Post-deployment verification

### Health check

```bash
curl https://your-app.vercel.app/api/health
```

Expected response:
```json
{ "status": "ok", "timestamp": "2026-05-12T10:00:00.000Z", "database": "connected" }
```

If `"database": "unreachable"`, check your `DATABASE_URL` in Vercel environment variables.

### Admin login

1. Navigate to `https://your-app.vercel.app/admin/login`.
2. Enter the email you set as `SUPER_ADMIN_EMAIL`.
3. Check your inbox for the magic link.
4. Click the link — you should land on the admin dashboard.

### User registration

1. Register a domain from the admin dashboard (e.g. `yourcompany.com`).
2. Navigate to `https://your-app.vercel.app` and log in with a `@yourcompany.com` address.

---

## Custom Domain (optional)

1. In Vercel project settings → **Domains**, add your custom domain.
2. Follow the DNS instructions Vercel provides (usually a CNAME or A record).
3. Update `ALLOWED_ORIGINS` in Vercel environment variables to include the new domain:
   ```
   https://your-app.vercel.app,https://yourdomain.com
   ```
4. Update `VITE_API_URL` if your custom domain changes the origin (it shouldn't — keep it as `/api`).

---

## Local development with `vercel dev`

`vercel dev` simulates the Vercel environment locally, including function routing.

```bash
npm install -g vercel     # Install Vercel CLI once

vercel login              # Authenticate
vercel link               # Link this directory to your Vercel project

# Pull production env vars to .env.local (do NOT commit this file)
vercel env pull .env.local

vercel dev                # Starts frontend + serverless function locally
```

> Alternatively, use the standard local dev workflow (`npm run dev`) which starts Vite and the Express server separately. Both approaches work; `vercel dev` is more representative of production behaviour.

---

## Troubleshooting

### `"database": "unreachable"` in health check

- Confirm `DATABASE_URL` is set in Vercel → Environment Variables for **Production**.
- Ensure you're using the **pooled** Neon URL (contains `pooler` in hostname).
- Neon free-tier projects sleep after 5 minutes of inactivity. The first request after sleep has extra latency (~1–2 s) but should succeed.

### Magic-link emails not arriving

- Check the Vercel function logs: Vercel dashboard → project → **Functions** tab → click a recent invocation.
- Confirm all `SMTP_*` variables are set correctly.
- For Gmail: verify you're using an App Password, not your account password.
- Check your spam folder.

### `FUNCTION_INVOCATION_TIMEOUT` (60 s exceeded)

This happens during OCR of scanned (image-based) PDFs on cold starts.

- **Short-term**: re-upload the file — warm instances process in ~5–15 s.
- **Long-term**: upgrade to Vercel Pro and increase `maxDuration` to `300` in `vercel.json`.

### `CORS: origin '...' is not allowed` errors in the browser

- Add the origin to `ALLOWED_ORIGINS` in Vercel environment variables.
- Redeploy (environment variable changes require a new deployment on Vercel).

### Frontend shows a blank page or 404 on reload

- Confirm `vercel.json` has the SPA fallback rewrite: `{ "source": "/(.*)", "destination": "/index.html" }`.
- Verify the `outputDirectory` in `vercel.json` matches Vite's `build.outDir` (`frontend/dist`).

### `Cannot find module '@bank-statement-ocr/shared'`

- The shared package must be built before the frontend. Confirm `buildCommand` in `vercel.json` starts with `npm run build --workspace=shared`.
- Locally: run `npm run build --workspace=shared` once before `npm run dev`.

### Backend TypeScript errors in the serverless function

- Vercel's `@vercel/node` runtime compiles TypeScript using esbuild. If you see type errors in Vercel's build logs, run `npx tsc --noEmit` in the `backend/` directory locally to reproduce and fix them.

---

## Environment variables reference (complete)

| Variable | Required | Where to set | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | Vercel + local `.env` | Neon pooled connection string |
| `JWT_SECRET` | ✅ | Vercel + local `.env` | 64-char random hex secret |
| `JWT_EXPIRES_IN` | — | Vercel + local `.env` | Session token TTL (default `7d`) |
| `SMTP_HOST` | ✅ | Vercel + local `.env` | SMTP server hostname |
| `SMTP_PORT` | ✅ | Vercel + local `.env` | `587` or `465` |
| `SMTP_SECURE` | ✅ | Vercel + local `.env` | `true` for port 465 |
| `SMTP_USER` | ✅ | Vercel + local `.env` | SMTP login |
| `SMTP_PASS` | ✅ | Vercel + local `.env` | SMTP password or API key |
| `SMTP_FROM` | ✅ | Vercel + local `.env` | Sender address |
| `ALLOWED_ORIGINS` | ✅ | Vercel + local `.env` | Comma-separated allowed origins |
| `SUPER_ADMIN_EMAIL` | ✅ | Local `.env` only | Seeded during `db:migrate` |
| `MAX_FILE_SIZE_MB` | — | Vercel + local `.env` | Upload limit in MB (default `10`) |
| `VITE_API_URL` | ✅ | Vercel (build) | `/api` for production |
| `NODE_ENV` | — | Set by `vercel.json` | `production` on Vercel |
| `DATABASE_URL_TEST` | — | Local `.env` only | Separate DB for test suite |
