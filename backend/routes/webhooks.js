'use strict';

/**
 * Webhook routes.
 *
 * CRITICAL: express.raw() is applied per-route here, NOT globally.
 * This gives the Razorpay controller a raw Buffer in req.body so
 * the HMAC signature can be verified against the original bytes.
 *
 * This router must be mounted in server.js BEFORE app.use(express.json())
 * to prevent the global JSON parser from consuming the body first.
 * See server.js for the correct mount order.
 */

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/webhookController');

router.post(
  '/razorpay',
  express.raw({ type: '*/*' }),   // parse body as Buffer, not JSON
  ctrl.razorpayWebhook
);

module.exports = router;
