/**
 * Vercel Serverless Function entry-point.
 *
 * Wraps the Express application so Vercel's @vercel/node runtime can invoke it
 * as a serverless handler. The module — and therefore the Express app instance
 * — is reused across warm invocations within the same Lambda execution context,
 * so the setup cost (CORS config, route registration, etc.) is only paid on
 * cold starts.
 *
 * Environment variables are injected by the Vercel platform in production and
 * by `vercel dev` during local development (reads .env from the project root).
 * Do NOT call dotenv.config() here; it conflicts with Vercel's env var injection
 * and would run too late to be seen by eagerly-evaluated modules like
 * backend/src/database/connection.ts.
 *
 * ── Operational notes ────────────────────────────────────────────────────────
 *
 * Database connections
 *   Use Neon's pooled connection string (the one containing "pooler" in the
 *   hostname) as DATABASE_URL. Standard PostgreSQL pools hold one connection
 *   per process; with serverless you can have many concurrent Lambda instances,
 *   each holding a connection. Neon's PgBouncer proxy prevents exhaustion.
 *
 * Tesseract.js / OCR cold starts
 *   The Tesseract worker is initialised lazily on the first image-based request
 *   and reused within the same warm instance. Each cold start re-initialises
 *   the worker and downloads the English language data to /tmp (~30 MB), which
 *   can add 10–30 s to the first OCR request after a cold start. Text-layer
 *   PDFs (the common case) are unaffected — they go through pdf-parse only and
 *   are fast on every call.
 *
 * Function timeout
 *   maxDuration is set to 60 s in vercel.json. Scanned, image-based PDFs may
 *   approach this limit on cold starts. Consider bumping to 300 s (Pro plan)
 *   if you expect heavy scanned-PDF workloads.
 */
import { createApp } from '../backend/src/app';

const app = createApp();

export default app;
