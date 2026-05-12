# Bank Statement OCR

A web application that extracts and processes transactions from bank statement PDFs and images using OCR.

## Tech Stack

| Layer    | Technology                                      |
|----------|-------------------------------------------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS        |
| Backend  | Node.js, Express, TypeScript                    |
| Database | PostgreSQL                                      |
| OCR      | Tesseract.js, pdf-parse, pdfjs-dist, Sharp      |
| Auth     | JWT (jsonwebtoken + bcrypt)                     |

## Project Structure

```
bank-statement-ocr/
├── frontend/          # React + Vite application
├── backend/           # Express API server
├── shared/            # Shared TypeScript types
├── package.json       # npm workspaces root
├── tsconfig.base.json # Base TypeScript config
├── .eslintrc.json     # ESLint config
└── .prettierrc        # Prettier config
```

## Prerequisites

- Node.js >= 18
- npm >= 9 (workspaces support)
- PostgreSQL >= 14

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

See the [Environment Variables](#environment-variables) section below for a full description of every variable.

### 3. Set up the database

Create a PostgreSQL database named `bank_statement_ocr` and run the migrations (see `backend/src/db/migrations/`).

### 4. Start development servers

```bash
# Start both frontend and backend concurrently
npm run dev

# Or start individually
npm run dev --workspace=frontend   # http://localhost:3000
npm run dev --workspace=backend    # http://localhost:4000
```

## Available Scripts

| Command              | Description                              |
|----------------------|------------------------------------------|
| `npm run dev`        | Start frontend + backend in dev mode     |
| `npm run build`      | Build all packages for production        |
| `npm run lint`       | Lint all TypeScript files                |
| `npm run format`     | Format all files with Prettier           |
| `npm run format:check` | Check formatting without writing       |

## Environment Variables

All backend configuration is controlled via `backend/.env`. Copy `backend/.env.example` and fill in the values described below.

### `NODE_ENV` / `PORT`

| Variable   | Default       | Description                          |
|------------|---------------|--------------------------------------|
| `NODE_ENV` | `development` | `development`, `test`, or `production` |
| `PORT`     | `4000`        | Port the Express server listens on   |

### Database

| Variable       | Example                                                          | Description                                    |
|----------------|------------------------------------------------------------------|------------------------------------------------|
| `DATABASE_URL` | `postgresql://postgres:secret@localhost:5432/bank_statement_ocr` | Full PostgreSQL connection string (required)   |

> The app uses `DATABASE_URL` exclusively. Individual `DB_HOST` / `DB_PORT` / … variables are **not** read.

To create the database locally:
```bash
psql -U postgres -c "CREATE DATABASE bank_statement_ocr;"
```

### JWT

| Variable         | Example                    | Description                                        |
|------------------|----------------------------|----------------------------------------------------|
| `JWT_SECRET`     | _(64-char hex string)_     | Secret used to sign tokens — **must be changed in production** |
| `JWT_EXPIRES_IN` | `7d`                       | Token lifetime (ms / s / m / h / d suffix)         |

Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### SMTP (Email)

| Variable    | Example                  | Description                                                 |
|-------------|--------------------------|-------------------------------------------------------------|
| `SMTP_HOST` | `smtp.gmail.com`         | SMTP server hostname                                        |
| `SMTP_PORT` | `587`                    | `587` for STARTTLS, `465` for SMTPS                         |
| `SMTP_SECURE` | `false`                | Set `true` when using port 465                              |
| `SMTP_USER` | `you@gmail.com`          | SMTP login username                                         |
| `SMTP_PASS` | `abcd efgh ijkl mnop`    | SMTP password or [Gmail App Password](https://myaccount.google.com/apppasswords) |
| `SMTP_FROM` | `"App <noreply@x.com>"`  | Sender address shown in outgoing emails                     |

> **Gmail users:** enable 2FA on your Google account and generate an App Password. Do not use your regular account password.

### CORS

| Variable          | Example                                             | Description                                               |
|-------------------|-----------------------------------------------------|-----------------------------------------------------------|
| `ALLOWED_ORIGINS` | `http://localhost:3000,https://app.example.com`     | Comma-separated list of origins Express will accept       |

### File Upload

| Variable          | Default      | Description                                   |
|-------------------|--------------|-----------------------------------------------|
| `MAX_FILE_SIZE_MB`| `10`         | Maximum upload size in megabytes              |
| `UPLOAD_DIR`      | `./uploads`  | Directory where uploaded files are stored temporarily |

---

## Deployment

The application is configured for one-click deployment to **Vercel** with a **Neon** PostgreSQL database.

```
Browser ──► Vercel CDN (React SPA)
              └── /api/* ──► Vercel Serverless Function (Express)
                                  └── Neon PostgreSQL (pooled)
```

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for the full step-by-step guide, including:

- Setting up a Neon database and running migrations
- Configuring SMTP for magic-link emails
- Setting environment variables in the Vercel dashboard
- Post-deployment verification and troubleshooting

### Quick environment setup

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env — fill in DATABASE_URL, JWT_SECRET, SMTP_*, ALLOWED_ORIGINS

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env — set VITE_API_URL=http://localhost:4000/api for local dev
```

---

## API Endpoints

| Method | Endpoint                       | Description               |
|--------|-------------------------------|---------------------------|
| POST   | `/api/auth/register`          | Register a new user        |
| POST   | `/api/auth/login`             | Login and receive JWT      |
| POST   | `/api/statements/upload`      | Upload a bank statement    |
| GET    | `/api/statements`             | List all statements        |
| GET    | `/api/statements/:id`         | Get a single statement     |
| GET    | `/api/statements/:id/export`  | Export transactions as CSV |
| GET    | `/health`                     | Health check               |
