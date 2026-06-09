'use strict';

/**
 * Optional JWT middleware.
 *
 * Unlike requireAuth, this never rejects the request.
 * If a valid Bearer token is present, req.user is populated.
 * If the token is absent, invalid, or expired, req.user stays undefined
 * and the request continues as a guest.
 *
 * Used on cart endpoints so both guests (session_id) and authenticated
 * users (JWT → userId) can read and modify their cart.
 */

const jwt = require('jsonwebtoken');

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    } catch {
      // Silently ignore — expired / malformed tokens are treated as guest
    }
  }
  next();
}

module.exports = optionalAuth;
