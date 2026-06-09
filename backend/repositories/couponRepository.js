'use strict';

/**
 * Coupon Repository — raw DB access for coupons and coupon_usage.
 *
 * coupon_usage rows are written during checkout (PENDING_PAYMENT) and
 * either finalized (order moves to PAID) or deleted (payment fails).
 * The coupon is therefore never "permanently consumed" until PAID.
 */

const { q } = require('../utils/dbQuery');

// ─── Coupon Reads ─────────────────────────────────────────────────────────────

/**
 * Fetch an active, non-expired coupon by code (case-insensitive).
 * Returns null if the coupon doesn't exist, is inactive, or has expired.
 */
async function findByCode(code, client) {
  const { rows } = await q(
    client,
    `SELECT *
     FROM coupons
     WHERE UPPER(code) = UPPER($1)
       AND is_active = TRUE
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [code]
  );
  return rows[0] ?? null;
}

/**
 * Total number of times a coupon has been used across all users.
 * Compared against coupons.usage_limit.
 */
async function countTotalUsage(couponId, client) {
  const { rows } = await q(
    client,
    'SELECT COUNT(*) AS total FROM coupon_usage WHERE coupon_id = $1',
    [couponId]
  );
  return parseInt(rows[0].total, 10);
}

/**
 * Number of times a specific user has used a coupon.
 * Compared against coupons.user_usage_limit.
 */
async function countUserUsage(couponId, userId, client) {
  const { rows } = await q(
    client,
    'SELECT COUNT(*) AS total FROM coupon_usage WHERE coupon_id = $1 AND user_id = $2',
    [couponId, userId]
  );
  return parseInt(rows[0].total, 10);
}

// ─── Coupon Usage Lifecycle ───────────────────────────────────────────────────

/**
 * Insert a usage record at PENDING_PAYMENT time.
 * orderId is supplied immediately (we create the order before recording usage).
 *
 * The record is considered "soft" — it will be deleted if payment fails.
 * Only once the order reaches PAID is it treated as permanent.
 */
async function recordUsage({ couponId, userId, orderId }, client) {
  const { rows } = await q(
    client,
    `INSERT INTO coupon_usage (coupon_id, user_id, order_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [couponId, userId, orderId]
  );
  return rows[0];
}

/**
 * Delete the usage record for an order that failed payment.
 * This "un-consumes" the coupon so the user can retry with it.
 */
async function releaseUsage(couponId, orderId, client) {
  await q(
    client,
    'DELETE FROM coupon_usage WHERE coupon_id = $1 AND order_id = $2',
    [couponId, orderId]
  );
}

module.exports = {
  findByCode,
  countTotalUsage,
  countUserUsage,
  recordUsage,
  releaseUsage,
};
