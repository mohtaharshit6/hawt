'use strict';

/**
 * Checkout Controller — Express route handlers for checkout and coupon
 * validation.
 *
 * All routes require authentication (requireAuth middleware on the router).
 *
 * POST /api/checkout
 *   Runs the full checkout flow (cart → lock → price → gateway order).
 *   Returns the Razorpay payload the frontend needs to open the payment
 *   modal, plus the price breakdown.
 *
 * POST /api/checkout/validate-coupon
 *   Validates a coupon code against the current cart subtotal without
 *   committing anything. Lets the frontend show a live discount preview
 *   before the user clicks "Place Order".
 *
 * GET /api/checkout/orders
 *   Returns the authenticated user's order history.
 *
 * GET /api/checkout/orders/:orderId
 *   Returns a single order (verifies ownership).
 */

const orderService          = require('../services/orderService');
const pricingService        = require('../services/pricingService');
const paymentGatewayService = require('../services/paymentGatewayService');
const webhookService        = require('../services/webhookService');
const orderRepo             = require('../repositories/orderRepository');

// ─── Checkout ─────────────────────────────────────────────────────────────────

/**
 * POST /api/checkout
 *
 * Body (all optional):
 *   couponCode?:      string   — discount code to apply
 *   shippingAddress?: object   — { name, line1, line2, city, state, pincode, phone }
 *
 * Response 201:
 *   {
 *     order:   { id, status },
 *     pricing: { subtotal, couponDiscount, paymentDiscount, taxAmount,
 *                shippingAmount, total },
 *     gateway: { orderId, amount, currency, keyId }
 *   }
 */
async function initCheckout(req, res) {
  try {
    const { couponCode = null, shippingAddress = null, paymentMethod = 'online' } = req.body;

    const result = await orderService.checkout({
      userId:          req.user.id,
      couponCode:      couponCode     || null,
      shippingAddress: shippingAddress || null,
      paymentMethod:   paymentMethod,
    });

    res.status(201).json({ data: result });
  } catch (err) {
    // Surface the internal orderId on gateway timeout (502) so the
    // client can retry the gateway step without re-locking stock
    const body = { error: err.message };
    if (err.orderId) body.orderId = err.orderId;
    res.status(err.status || 500).json(body);
  }
}

// ─── Coupon Preview ───────────────────────────────────────────────────────────

/**
 * POST /api/checkout/validate-coupon
 *
 * Body: { code: string, subtotal: number }
 *
 * Response 200:
 *   {
 *     coupon:  { code, type, value, max_discount },
 *     pricing: { subtotal, couponDiscount, taxAmount, shippingAmount, total, … }
 *   }
 */
async function validateCoupon(req, res) {
  try {
    const { code, subtotal } = req.body;

    if (!code || subtotal === undefined) {
      return res.status(400).json({ error: 'code and subtotal are required' });
    }

    const parsedSubtotal = parseFloat(subtotal);
    if (isNaN(parsedSubtotal) || parsedSubtotal < 0) {
      return res.status(400).json({ error: 'subtotal must be a non-negative number' });
    }

    const coupon  = await pricingService.validateCoupon({
      code,
      subtotal: parsedSubtotal,
      userId:   req.user.id,
    });

    const pricing = pricingService.calculatePricing({
      subtotal: parsedSubtotal,
      coupon,
    });

    res.json({
      data: {
        coupon: {
          code:         coupon.code,
          type:         coupon.type,
          value:        coupon.value,
          max_discount: coupon.max_discount,
        },
        pricing,
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

// ─── Order History ────────────────────────────────────────────────────────────

/**
 * GET /api/checkout/orders
 * Returns all orders for the authenticated user (newest first).
 */
async function listOrders(req, res) {
  try {
    const orders = await orderService.getOrdersForUser(req.user.id);
    res.json({ data: orders });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

/**
 * GET /api/checkout/orders/:orderId
 * Returns a single order. Throws 403 if the order belongs to another user.
 */
async function getOrder(req, res) {
  try {
    const order = await orderService.getOrderForUser(req.params.orderId, req.user.id);
    res.json({ data: order });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

// ─── Payment Verification ─────────────────────────────────────────────────────

/**
 * POST /api/checkout/verify-payment
 *
 * Called by the frontend immediately after Razorpay's onSuccess callback.
 * Verifies the HMAC signature, then runs the same finalization path as the
 * webhook (mark PAID, deduct stock, clear cart, queue outbox).
 *
 * This is intentionally idempotent — if the webhook already ran first,
 * the order will be PAID and the handler returns success immediately.
 *
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * Response 200: { data: { orderId, status: 'PAID' } }
 */
async function verifyPayment(req, res) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        error: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required',
      });
    }

    // 1. Verify HMAC signature (no-op in mock mode)
    paymentGatewayService.verifyPaymentSignature({
      gatewayOrderId:   razorpay_order_id,
      gatewayPaymentId: razorpay_payment_id,
      signature:        razorpay_signature,
    });

    // 2. Ownership check — resolve the order before finalizing
    const result = await orderRepo.findOrderByGatewayOrderId(razorpay_order_id);
    if (!result) return res.status(404).json({ error: 'Order not found' });
    if (result.order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 3. Finalize payment (idempotent — safe if webhook already ran)
    const { order } = await webhookService.finalizeSuccessfulPayment({
      gatewayOrderId:   razorpay_order_id,
      gatewayPaymentId: razorpay_payment_id,
    });

    res.json({ data: { orderId: order.id, status: order.status } });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { initCheckout, validateCoupon, listOrders, getOrder, verifyPayment };
