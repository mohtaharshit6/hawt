require('dotenv').config();

['JWT_SECRET', 'DATABASE_URL'].forEach(k => {
  if (!process.env[k]) { console.error(`FATAL: ${k} is not set`); process.exit(1); }
});

const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const pinoHttp = require('pino-http');
const path     = require('path');
const logger   = require('./utils/logger');

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'script-src': ["'self'", "'unsafe-inline'"],
      'script-src-attr': ["'unsafe-inline'"],
      // Yahan humne plus.unsplash aur wildcard (*) add kar diya hai
      'img-src': ["'self'", "data:", "blob:", "https://images.unsplash.com", "https://plus.unsplash.com", "*"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
app.use(pinoHttp({ logger }));

// ── Static frontend ───────────────────────────────────────────────────────────
// In production: cache assets for 7 days (immutable = skip revalidation).
// In development: no caching so file changes are picked up on every refresh.
const isProd = process.env.NODE_ENV === 'production';
app.use(express.static(path.join(__dirname, '../frontend'), isProd ? {
  maxAge: '7d',
  immutable: true,
} : {}));

// ── Webhook routes — mounted BEFORE express.json() ───────────────────────────
//
// Razorpay webhook signature verification requires the raw request body.
// Mounting /api/webhooks first ensures those routes receive the raw body
// via their own express.raw() middleware.
app.use('/api/webhooks', require('./routes/webhooks'));

// ── Global JSON body parser (all other routes) ────────────────────────────────
app.use(express.json());

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/admin',    require('./routes/admin'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart',     require('./routes/cart'));
app.use('/api/checkout', require('./routes/checkout'));
app.use('/api/orders',   require('./routes/orders'));

// ── SPA fallback — serve index.html for any non-API route ────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  logger.error({ err, method: req.method, path: req.path }, err.message);
  res.status(status).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`hawt server running → http://localhost:${PORT}`);
}).on('error', err => {
  logger.error(err, 'Server failed to start');
  process.exit(1);
});

// ── Background workers ────────────────────────────────────────────────────────
require('./workers/outboxWorker').start();
require('./workers/staleOrderWorker').start();
