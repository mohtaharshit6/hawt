'use strict';

/**
 * Pricing Service — coupon validation and full price breakdown calculation.
 *
 * Design principles:
 *  - calculatePricing() is a PURE function: no DB calls, deterministic,
 *    trivially unit-testable. Feed it validated data, get a breakdown out.
 *  - validateCoupon() owns all the DB-level checks (expiry, limits) and
 *    returns the coupon row ready for calculatePricing().
 *  - All arithmetic uses r2() to stay at 2 decimal places throughout,
 *    preventing floating-point drift on repeated addition/subtraction.
 *
 * Discount precedence (from architecture blueprint):
 *   Subtotal → Generic Coupon → Payment-Method Offer → Taxes → Shipping → clamp(0)
 */

const couponRepo       = require('../repositories/couponRepository');
const { serviceError } = require('../utils/errors');

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Indian GST on apparel:
 *   < ₹1,000 per piece → 5%
 *   ≥ ₹1,000 per piece → 12%
 *
 * We apply a flat 5% here on the cart total (post-discount) as a
 * simplification. Adjust to a tiered calc if per-item GST is required.
 */
const TAX_RATE                = 0.05;
const FREE_SHIPPING_THRESHOLD = 2499;    // INR — free above this subtotal
const SHIPPING_FEE            = 199;     // INR flat rate below threshold

// ─── Math Helpers ─────────────────────────────────────────────────────────────

/** Round to 2 decimal places — eliminates floating-point drift. */
function r2(n) {
  return Math.round(n * 100) / 100;
}

// ─── Discount Calculators ─────────────────────────────────────────────────────

/**
 * Compute the rupee discount a coupon gives against a subtotal.
 *
 * Handles both coupon types:
 *  - 'flat'    → fixed INR amount off (e.g. ₹200 off)
 *  - 'percent' → percentage of subtotal (e.g. 10% off)
 *
 * Caps:
 *  - max_discount:  hard ceiling set on the coupon row
 *  - subtotal:      discount can never exceed what the customer owes
 *
 * @param {object} coupon   — coupon DB row
 * @param {number} subtotal — pre-discount cart total in INR
 * @returns {number}        — discount amount in INR (≥ 0)
 */
function applyCoupon(coupon, subtotal) {
  let discount = 0;

  if (coupon.type === 'flat') {
    discount = parseFloat(coupon.value);
  } else if (coupon.type === 'percent') {
    discount = subtotal * (parseFloat(coupon.value) / 100);
  }

  // Apply max_discount ceiling if the coupon defines one
  if (coupon.max_discount != null) {
    discount = Math.min(discount, parseFloat(coupon.max_discount));
  }

  // A discount can never exceed the amount being discounted
  return r2(Math.min(discount, subtotal));
}

/**
 * Compute the rupee discount a payment-method offer gives against the
 * amount AFTER coupons have been applied.
 *
 * Payment offers are percentage-based (e.g. 5% off on UPI).
 *
 * @param {object} offer           — payment_offers DB row
 * @param {number} amountAfterCoupons
 * @returns {number}               — discount amount in INR (≥ 0)
 */
function applyPaymentOffer(offer, amountAfterCoupons) {
  let discount = amountAfterCoupons * (parseFloat(offer.discount_percent) / 100);

  if (offer.max_discount != null) {
    discount = Math.min(discount, parseFloat(offer.max_discount));
  }

  return r2(Math.max(0, discount));
}

// ─── Coupon Validation ────────────────────────────────────────────────────────

/**
 * Validate a coupon code against DB rules and the current cart state.
 * Returns the coupon row on success; throws a descriptive serviceError
 * with an HTTP status on any failure.
 *
 * Checks performed (in order):
 *  1. Coupon exists, is active, and has not expired          → 404
 *  2. Cart subtotal meets the coupon's minimum cart value    → 422
 *  3. Global usage_limit has not been reached (if set)       → 409
 *  4. This user has not exceeded user_usage_limit            → 409
 *
 * NOTE: This does NOT record the usage — that happens inside the
 * checkout transaction via couponRepo.recordUsage().
 *
 * @param {{ code: string, subtotal: number, userId: string }} params
 * @returns {Promise<object>}  the validated coupon DB row
 */
async function validateCoupon({ code, subtotal, userId }) {
  const coupon = await couponRepo.findByCode(code);
  if (!coupon) {
    throw serviceError('Coupon not found or has expired', 404);
  }

  if (subtotal < parseFloat(coupon.min_cart_value)) {
    throw serviceError(
      `Minimum order value for this coupon is ₹${coupon.min_cart_value}`,
      422
    );
  }

  if (coupon.usage_limit != null) {
    const totalUsed = await couponRepo.countTotalUsage(coupon.id);
    if (totalUsed >= coupon.usage_limit) {
      throw serviceError('This coupon has reached its usage limit', 409);
    }
  }

  const userUsed = await couponRepo.countUserUsage(coupon.id, userId);
  if (userUsed >= coupon.user_usage_limit) {
    throw serviceError('You have already used this coupon', 409);
  }

  return coupon;
}

// ─── Pricing Engine ───────────────────────────────────────────────────────────

/**
 * Calculate the complete price breakdown for a checkout session.
 *
 * This is a PURE function — all inputs must be pre-validated by the caller.
 * It performs no DB calls and can be called multiple times safely.
 *
 * Pipeline (matches blueprint precedence):
 *
 *   subtotal
 *     └─ couponDiscount    (applied to raw subtotal)
 *        └─ afterCoupon    = max(0, subtotal - couponDiscount)
 *           └─ paymentDiscount  (applied to afterCoupon)
 *              └─ taxableBase   = max(0, afterCoupon - paymentDiscount)
 *                 └─ taxAmount  = taxableBase × TAX_RATE
 *                    └─ shippingAmount  (based on original subtotal threshold)
 *                       └─ total = max(0, taxableBase + taxAmount + shippingAmount)
 *
 * Why taxableBase is clamped before tax:
 *   Discounts should never produce a negative taxable value. Without the
 *   clamp, a 100%-off coupon could yield negative tax, which is nonsensical.
 *
 * Why shipping is based on the original subtotal (not discounted):
 *   The free-shipping threshold reflects the value of goods ordered, not
 *   the price paid after promotional discounts. This matches standard
 *   e-commerce practice (e.g. Myntra, AJIO).
 *
 * @param {{
 *   subtotal:      number,        — sum of (effectivePrice × qty) for all items
 *   coupon?:       object|null,   — validated coupon DB row, or null
 *   paymentOffer?: object|null,   — payment_offers DB row, or null
 * }} params
 *
 * @returns {{
 *   subtotal:        number,
 *   couponDiscount:  number,
 *   afterCoupon:     number,
 *   paymentDiscount: number,
 *   taxableBase:     number,
 *   taxAmount:       number,
 *   shippingAmount:  number,
 *   total:           number,
 * }}
 */
function calculatePricing({ subtotal, coupon = null, paymentOffer = null }) {
  subtotal = r2(Math.max(0, parseFloat(subtotal) || 0));

  // Step 1 — Generic coupon (off the raw subtotal)
  const couponDiscount = coupon ? applyCoupon(coupon, subtotal) : 0;

  // Step 2 — Amount after coupon (non-negative)
  const afterCoupon = r2(Math.max(0, subtotal - couponDiscount));

  // Step 3 — Payment-method offer (off afterCoupon)
  const paymentDiscount = paymentOffer
    ? applyPaymentOffer(paymentOffer, afterCoupon)
    : 0;

  // Step 4 — Taxable base (non-negative)
  const taxableBase = r2(Math.max(0, afterCoupon - paymentDiscount));

  // Step 5 — GST on taxable base
  const taxAmount = r2(taxableBase * TAX_RATE);

  // Step 6 — Shipping (threshold is pre-discount subtotal)
  const shippingAmount = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

  // Step 7 — Final total, clamped to zero (prevents edge cases on extreme discounts)
  const total = r2(Math.max(0, taxableBase + taxAmount + shippingAmount));

  return {
    subtotal,
    couponDiscount,
    afterCoupon,
    paymentDiscount,
    taxableBase,
    taxAmount,
    shippingAmount,
    total,
  };
}

module.exports = {
  validateCoupon,
  calculatePricing,
  // Exported for unit testing
  _applyCoupon:        applyCoupon,
  _applyPaymentOffer:  applyPaymentOffer,
  // Exported so checkoutService can reference these without magic numbers
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
  TAX_RATE,
};
