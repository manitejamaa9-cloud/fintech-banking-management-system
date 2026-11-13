import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import { initDb, q, closeDb } from './db/index.js';

import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import analyticsRoutes from './routes/analytics.js';
import customerRoutes from './routes/customers.js';
import accountRoutes from './routes/accounts.js';
import loanRoutes from './routes/loans.js';
import transactionRoutes from './routes/transactions.js';
import schemeRoutes from './routes/schemes.js';
import branchRoutes from './routes/branches.js';
import alertRoutes from './routes/alerts.js';
import reportRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.disable('x-powered-by');
app.use(
  cors({
    origin: [config.clientOrigin, 'http://127.0.0.1:5173', 'http://localhost:5173'],
    credentials: false,
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (req, res) => {
  try {
    await q('SELECT 1');
    res.json({ status: 'ok', database: 'connected', time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'unavailable', error: 'Database is not reachable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/schemes', schemeRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Serve the built client when it exists (npm run build).
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Centralized error handler. Never leaks stack traces or secrets.
app.use((err, req, res, next) => {
  console.error(`[server] ${req.method} ${req.originalUrl}:`, err.message);
  if (err.code === '23505') return res.status(409).json({ error: 'A record with these details already exists' });
  if (err.code === '23503') return res.status(400).json({ error: 'A referenced record does not exist' });
  if (err.code === '22P02') return res.status(400).json({ error: 'Invalid input value' });
  const status = Number(err.status) || 500;
  const message =
    status >= 500 && config.isProduction ? 'Internal server error' : err.message || 'Internal server error';
  res.status(status).json({ error: message });
});

async function start() {
  await initDb();
  const server = app.listen(config.port, () => {
    console.log('');
    console.log(`[server] FinTech Banking API: http://localhost:${config.port}`);
    console.log(`[server] Health check:        http://localhost:${config.port}/api/health`);
    console.log(`[server] Frontend (dev):      ${config.clientOrigin}`);
    console.log('');
  });

  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received, shutting down...`);
    server.close(async () => {
      await closeDb().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((e) => {
  console.error('\n[server] FAILED TO START\n');
  console.error(e.message);
  console.error('\nFix the issue above, then run:  npm run db:init\n');
  process.exit(1);
});
