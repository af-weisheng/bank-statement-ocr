// dotenv must be loaded before any other module reads process.env.
import dotenv from 'dotenv';
dotenv.config();

import { createApp }          from './app';
import { pool }               from './database/connection';
import { terminateOcrWorker } from './ocr/imageProcessor';

const PORT   = process.env.PORT || 5000;
const app    = createApp();
const server = app.listen(PORT, () => {
  console.log(`[server] Running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[server] ${signal} received — shutting down…`);
  server.close(async () => {
    try   { await terminateOcrWorker(); }
    catch (err) { console.error('[server] Error terminating Tesseract worker:', err); }
    try   { await pool.end(); }
    catch (err) { console.error('[server] Error closing PostgreSQL pool:', err); }
    console.log('[server] Shutdown complete.');
    process.exit(0);
  });
  setTimeout(() => { console.error('[server] Graceful shutdown timed out.'); process.exit(1); }, 10_000).unref();
}

process.on('SIGTERM',            () => void shutdown('SIGTERM'));
process.on('SIGINT',             () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => { console.error('[server] Unhandled rejection:', reason); void shutdown('unhandledRejection'); });
process.on('uncaughtException',  (err)    => { console.error('[server] Uncaught exception:', err);    void shutdown('uncaughtException'); });
