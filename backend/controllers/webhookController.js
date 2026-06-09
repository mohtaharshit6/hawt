'use strict';

/**
 * Webhook Controller — Razorpay event receiver.
 *
 * IMPORTANT — raw body requirement:
 *   Razorpay signs the raw request body with HMAC-SHA256. If the body
 *   has been JSON-parsed before signature verification the hash will not
 *   match. The route for this controller MUST use express.raw() middleware
 *   (not express.json()) so req.body arrives as a Buffer.
 *   See backend/routes/webhooks.js for the correct route definition.
 *
 * Supported events:
 *   payment.captured  → orderPaid, stock deducted, cart cleared, outbox queued
 *   payment.failed    → reservations released, order cancelled
 *   (all others)      → acknowledged with 200, no action taken
 *
 * Idempotency:
 *   The webhook service performs a status check before any writes, so
 *   Razorpay retries (which Razorpay sends for up to 24 hours) are safe.
 *
 * Response contract:
 *   Always return HTTP 200 when the event is understood, even on a
 *   non-actionable status. Razorpay retries until it receives 200.
 *   Return 4xx only for genuinely bad requests (missing signature, bad JSON).
 */

const webhookService = require('../services/webhookService');
const logger         = require('../utils/logger');

/**
 * POST /api/webhooks/razorpay
 *
 * Headers expected:
 *   x-razorpay-signature  — HMAC-SHA256 of raw body
 *
 * Body: raw Buffer (parsed by express.raw in the route file)
 */
async function razorpayWebhook(req, res) {
  const signature = req.headers['x-razorpay-signature'];

  if (!signature) {
    return res.status(400).json({ error: 'Missing x-razorpay-signature header' });
  }

  // req.body is a Buffer when the route uses express.raw()
  const rawBody = req.body;

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  try {
    await webhookService.handlePaymentEvent({
      eventName: event.event,
      payload:   event,
      rawBody,
      signature,
    });

    // 200 tells Razorpay the event was received and processed successfully
    res.status(200).json({ received: true });
  } catch (err) {
    logger.error({ err }, 'webhookController: error processing event');

    // 401 for bad signature — Razorpay should NOT retry with the same payload
    // 5xx for unexpected errors — Razorpay will retry later
    res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { razorpayWebhook };
