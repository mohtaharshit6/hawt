'use strict';
const requireAuth = require('./auth');

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user?.is_admin) {
      return res.status(403).json({ error: 'admin access required' });
    }
    next();
  });
}

module.exports = { requireAdmin };
