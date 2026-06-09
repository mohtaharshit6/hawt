const router    = require('express').Router();
const bcrypt    = require('bcrypt');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const rateLimit = require('express-rate-limit');
const db        = require('../db');
const logger    = require('../utils/logger');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too many attempts, please try again later' },
});

router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'invalid email format' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }
  try {
    const exists = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (exists.rows.length) {
      return res.status(409).json({ error: 'an account with this email already exists' });
    }
    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, is_admin',
      [name.trim(), email.toLowerCase(), hash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, is_admin: user.is_admin }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'something went wrong' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'no account found with that email' });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'incorrect password' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, is_admin: user.is_admin }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, is_admin: user.is_admin } });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'something went wrong' });
  }
});

router.post('/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'valid email is required' });
  }
  try {
    const result = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (!result.rows.length) {
      // Don't reveal whether account exists
      return res.json({ message: 'if that email is registered, a reset link has been generated' });
    }
    const userId = result.rows[0].id;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any existing unused tokens for this user
    await db.query('UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE', [userId]);
    await db.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, token, expiresAt]
    );

    // In production this link would be sent via email (SendGrid, SES, etc.)
    // Log it in dev so the flow is testable without an email provider
    const resetLink = `${req.protocol}://${req.get('host')}/auth.html?reset_token=${token}`;
    if (process.env.NODE_ENV !== 'production') {
      logger.info({ resetLink }, 'password reset link (dev only — send via email in prod)');
    }
    res.json({ message: 'if that email is registered, a reset link has been sent' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'something went wrong' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'token and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }
  try {
    const result = await db.query(
      'SELECT * FROM password_reset_tokens WHERE token = $1 AND used = FALSE AND expires_at > NOW()',
      [token]
    );
    if (!result.rows.length) {
      return res.status(400).json({ error: 'reset link is invalid or has expired' });
    }
    const { id: tokenId, user_id: userId } = result.rows[0];
    const hash = await bcrypt.hash(password, 12);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
    await db.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [tokenId]);
    res.json({ message: 'password updated successfully' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'something went wrong' });
  }
});

router.post('/refresh', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing token' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    if (payload.exp && Date.now() / 1000 > payload.exp + 86400) {
      return res.status(401).json({ error: 'token too old to refresh' });
    }
    // Re-read is_admin from DB so a role change takes effect on next refresh
    const userRow = await db.query('SELECT is_admin FROM users WHERE id = $1', [payload.id]);
    const is_admin = userRow.rows[0]?.is_admin ?? false;
    const newToken = jwt.sign(
      { id: payload.id, email: payload.email, name: payload.name, is_admin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token: newToken });
  } catch (err) {
    res.status(401).json({ error: 'invalid token' });
  }
});

module.exports = router;
