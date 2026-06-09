'use strict';

// Legacy redirect — GET /api/orders/me → 301 → /api/checkout/orders
const router = require('express').Router();

router.get('/me', (req, res) => {
  res.redirect(301, '/api/checkout/orders');
});

module.exports = router;
