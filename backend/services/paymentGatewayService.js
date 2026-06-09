'use strict';

/**
 * Payment Gateway Service — Razorpay facade.
 *
 * Two operating modes selected at startup:
 *
 *   LIVE  — RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are set.
 *           Calls the real Razorpay REST API using Node 22 fetch().
 *
 *   MOCK  — Credentials absent (local dev / CI without a Razorpay account).
 *           Returns plausible-looking fake responses so the full checkout
 *           flow can be exercised end-to-end without a gateway account.
 *
 * Razorpay API reference:
 *   https://razorpay.com/docs/api/orders/
 *   https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
 *
 * Required .env keys:
 *   RAZORPAY_KEY_ID          — rzp_live_xxx  or  rzp_test_xxx
 *   RAZORPAY_KEY_SECRET      — your API key secret
 *   RAZORPAY_WEBHOOK_SECRET  — set in Razorpay dashboard → Webhooks
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

const KEY_ID         = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET     = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

const LIVE_MODE = !!(KEY_ID && KEY_SECRET);

if (!LIVE_MODE) {
  logger.warn('[paymentGateway] RAZORPAY credentials not set — running in MOCK mode');
}

// ─── Razorpay REST helpers ────────────────────────────────────────────────────

/** Basic-auth header for Razorpay API calls. */
function razorpayAuth() {
  return 'Basic ' + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');
}

/**
 * Thin fetch wrapper for the Razorpay REST API.
 * Throws on non-2xx responses with the Razorpay error description.
 */
async function razorpayPost(path, body) {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization:  razorpayAuth(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.description ?? `Razorpay API error ${res.status}`;
    throw Object.assign(new Error(msg), { status: 502, razorpayError: data });
  }
  return data;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a payment order on the gateway.
 *
 * LIVE:  Calls POST /v1/orders on Razorpay.
 * MOCK:  Returns a mock object with a fake order ID.
 *
 * @param {{
 *   orderId:     string,  — internal Hawt order UUID (used as receipt)
 *   amountPaise: number,  — total in paise (INR × 100)
 *   currency?:   string,  — default 'INR'
 *   notes?:      object,  — arbitrary key/value metadata stored on Razorpay
 * }} params
 *
 * @returns {{ id, amount, currency, receipt, status }}
 */
async function createOrderIntent({ orderId, amountPaise, currency = 'INR', notes = {} }) {
  if (LIVE_MODE) {
    return razorpayPost('/orders', {
      amount:   amountPaise,
      currency,
      receipt:  orderId,
      notes:    { ...notes, internalOrderId: orderId },
    });
  }

  // ── Mock response ──────────────────────────────────────────────────────────
  const mockId = `order_mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id:       mockId,
    amount:   amountPaise,
    currency,
    receipt:  orderId,
    status:   'created',
    _mock:    true,
  };
}

/**
 * Verify the HMAC signature Razorpay sends on standard checkout success.
 *
 * The frontend receives razorpay_order_id, razorpay_payment_id, and
 * razorpay_signature after a successful in-page payment. Call this
 * before treating a client-side success as genuine.
 *
 * HMAC input: `${gatewayOrderId}|${gatewayPaymentId}`
 * Key:        RAZORPAY_KEY_SECRET
 *
 * @throws {Error} status 401 when signature is invalid
 */
function verifyPaymentSignature({ gatewayOrderId, gatewayPaymentId, signature }) {
  if (!LIVE_MODE) return true; // skip in mock mode

  const expected = crypto
    .createHmac('sha256', KEY_SECRET)
    .update(`${gatewayOrderId}|${gatewayPaymentId}`)
    .digest('hex');

  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))) {
      throw Object.assign(new Error('Invalid payment signature'), { status: 401 });
    }
  } catch (e) {
    throw Object.assign(new Error('Invalid payment signature'), { status: 401 });
  }
  return true;
}

/**
 * Verify the HMAC signature Razorpay attaches to every webhook POST.
 *
 * HMAC input: raw request body (Buffer/string — before JSON.parse)
 * Key:        RAZORPAY_WEBHOOK_SECRET
 *
 * MUST be called with the raw body — JSON-parsed objects will not
 * produce the correct hash. Use express.raw() on the webhook route.
 *
 * @param {Buffer|string} rawBody
 * @param {string}        signature   — value of x-razorpay-signature header
 * @throws {Error} status 401 when signature is invalid or secret is missing
 */
function verifyWebhookSignature(rawBody, signature) {
  if (!LIVE_MODE) {
    // In mock mode, accept any request that carries the header at all
    if (!signature) {
      throw Object.assign(new Error('Missing x-razorpay-signature header'), { status: 401 });
    }
    return true;
  }

  if (!WEBHOOK_SECRET) {
    throw Object.assign(
      new Error('RAZORPAY_WEBHOOK_SECRET is not configured'),
      { status: 500 }
    );
  }

  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))) {
      throw Object.assign(new Error('Invalid webhook signature'), { status: 401 });
    }
  } catch (e) {
    throw Object.assign(new Error('Invalid webhook signature'), { status: 401 });
  }
  return true;
}

module.exports = {
  createOrderIntent,
  verifyPaymentSignature,
  verifyWebhookSignature,
  get isLiveMode() { return LIVE_MODE; },
};
