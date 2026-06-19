'use strict';

/**
 * Order Service — checkout brain.
 *
 * The `checkout` method is the centrepiece of the entire payment flow.
 * It coordinates four distinct phases:
 *
 *   Phase 1 — Pre-flight (reads only, no locks)
 *     Fetch cart, compute subtotal, validate coupon.
 *
 *   Phase 2 — ACID Transaction (BEGIN … COMMIT/ROLLBACK)
 *     Lock variants → reserve stock → create order → insert items
 *     → record coupon usage. All-or-nothing.
 *
 *   Phase 3 — Gateway call (outside the transaction)
 *     Create a Razorpay order. If this fails the DB order is stuck at
 *     PENDING_PAYMENT with stock reserved but no gateway ID. A nightly
 *     cleanup job should cancel stale PENDING_PAYMENT orders and release
 *     reservations.
 *
 *   Phase 4 — Record payment transaction
 *     Persist the gateway order ID so the webhook handler can look up
 *     the internal order from the Razorpay event.
 */

const pool                  = require('../db');
const cartRepo              = require('../repositories/cartRepository');
const orderRepo             = require('../repositories/orderRepository');
const couponRepo            = require('../repositories/couponRepository');
const outboxRepo            = require('../repositories/outboxRepository');
const inventoryService      = require('./inventoryService');
const pricingService        = require('./pricingService');
const paymentGatewayService = require('./paymentGatewayService');
const { serviceError }      = require('../utils/errors');

/**
 * Supersede any open (PENDING_PAYMENT) orders the user has before creating a
 * new one. This is the fix for the "duplicate order" bug: a shopper who
 * abandons a UPI payment (modal dismissed / verification failed) and then
 * retries — often switching to COD — used to end up with TWO orders in their
 * history (one stuck at PENDING_PAYMENT, one PROCESSING). By cancelling the
 * prior pending attempt and releasing its stock + coupon at the start of every
 * checkout, a retry always replaces the old order instead of stacking a new one.
 *
 * Runs inside the caller's transaction; the rows are locked FOR UPDATE.
 */
async function supersedePendingOrders(userId, client) {
  const pending = await orderRepo.findOpenPendingOrders(userId, client);
  for (const { id, coupon_id } of pending) {
    const items = await orderRepo.getOrderItems(id, client);
    if (items.length) {
      await inventoryService.releaseReservations(
        items.map(i => ({ variantId: i.variant_id, quantity: i.quantity })),
        client
      );
    }
    if (coupon_id) {
      await couponRepo.releaseUsage(coupon_id, id, client);
    }
    await orderRepo.updateStatus(id, 'CANCELLED', client);
  }
}

/** INR subtotal from cart items, using sale_price when available. */
function computeSubtotal(cartItems) {
  return cartItems.reduce((sum, item) => {
    const price = parseFloat(item.sale_price ?? item.base_price);
    return Math.round((sum + price * item.quantity) * 100) / 100;
  }, 0);
}

// ─── Checkout ─────────────────────────────────────────────────────────────────

/**
 * Initiate a checkout session for an authenticated user.
 *
 * @param {{
 *   userId:           string,
 *   couponCode?:      string|null,
 *   shippingAddress?: object|null,
 * }} params
 *
 * @returns {{
 *   order:   { id, status },
 *   pricing: PricingBreakdown,
 *   gateway: { orderId, amount, currency, keyId },
 * }}
 *
 * @throws {Error} status 400 — empty cart
 * @throws {Error} status 404 — coupon not found
 * @throws {Error} status 409 — insufficient stock or coupon limit reached
 * @throws {Error} status 422 — cart value below coupon minimum
 * @throws {Error} status 502 — payment gateway unavailable
 */
async function checkout({ userId, couponCode = null, shippingAddress = null, paymentMethod = 'online' }) {
  // ── Phase 1: Pre-flight ────────────────────────────────────────────────────

  const cart = await cartRepo.findByUserId(userId);
  if (!cart) throw serviceError('Your cart is empty', 400);

  const cartItems = await cartRepo.getItemsWithDetails(cart.id);
  if (!cartItems.length) throw serviceError('Your cart is empty', 400);

  const subtotal = computeSubtotal(cartItems);

  // Validate coupon outside the transaction (read-only, no locks needed)
  let coupon = null;
  if (couponCode) {
    coupon = await pricingService.validateCoupon({ code: couponCode, subtotal, userId });
  }

  const pricing = pricingService.calculatePricing({ subtotal, coupon });

  // Items shaped for the inventory lock loop
  const lockItems = cartItems.map(item => ({
    variantId: item.variant_id,
    quantity:  item.quantity,
  }));

  // ── Phase 3-COD: Cash on delivery — no gateway required ───────────────────

  if (paymentMethod === 'cod') {
    const codClient = await pool.connect();
    let codOrder;
    try {
      await codClient.query('BEGIN');

      // Cancel any abandoned pending order first so a retry never duplicates.
      await supersedePendingOrders(userId, codClient);

      await inventoryService.lockAndReserve(lockItems, codClient);

      codOrder = await orderRepo.create(
        {
          userId,
          subtotal:        pricing.subtotal,
          couponDiscount:  pricing.couponDiscount,
          paymentDiscount: pricing.paymentDiscount,
          taxAmount:       pricing.taxAmount,
          shippingAmount:  pricing.shippingAmount,
          totalAmount:     pricing.total,
          couponId:        coupon?.id ?? null,
          shippingAddress,
        },
        codClient
      );

      await orderRepo.insertItems(
        cartItems.map(item => ({
          orderId:          codOrder.id,
          variantId:        item.variant_id,
          productId:        item.product_id,
          productName:      item.name,
          size:             item.size,
          quantity:         item.quantity,
          priceAtPurchase:  parseFloat(item.sale_price ?? item.base_price),
        })),
        codClient
      );

      if (coupon) {
        await couponRepo.recordUsage(
          { couponId: coupon.id, userId, orderId: codOrder.id },
          codClient
        );
      }

      await inventoryService.fulfillOrder(
        cartItems.map(item => ({ variantId: item.variant_id, quantity: item.quantity })),
        codClient
      );
      await orderRepo.updateStatus(codOrder.id, 'PROCESSING', codClient);

      const userCart = await cartRepo.findByUserId(userId, codClient);
      if (userCart) await cartRepo.clearItems(userCart.id, codClient);

      await outboxRepo.insert(
        {
          aggregateType: 'order',
          aggregateId:   codOrder.id,
          eventType:     'order.cod_placed',
          payload:       { orderId: codOrder.id, userId, total: pricing.total, currency: 'INR' },
        },
        codClient
      );

      await codClient.query('COMMIT');
    } catch (err) {
      await codClient.query('ROLLBACK');
      throw err;
    } finally {
      codClient.release();
    }

    return {
      order:   { id: codOrder.id, status: 'PROCESSING' },
      pricing,
      gateway: null,
    };
  }

  // ── Phase 3: Gateway call — done BEFORE opening the DB transaction so the
  //    gateway order ID is available to insert atomically with the order row.

  const amountPaise = Math.round(pricing.total * 100);
  let gatewayOrder;

  try {
    gatewayOrder = await paymentGatewayService.createOrderIntent({
      orderId:     'pending',
      amountPaise,
      currency:    'INR',
      notes:       { coupon: coupon?.code ?? null },
    });
  } catch (err) {
    throw Object.assign(
      new Error('Payment gateway unavailable — please try again in a moment.'),
      { status: 502 }
    );
  }

  // ── Phase 2: ACID Transaction — gateway ID in hand, everything in one atomic block

  const client = await pool.connect();
  let order;

  try {
    await client.query('BEGIN');

    // 0. Supersede any abandoned PENDING_PAYMENT order from a prior attempt,
    //    releasing its stock/coupon — prevents duplicate orders on retry.
    await supersedePendingOrders(userId, client);

    // 1. Acquire row-level locks + reserve stock
    await inventoryService.lockAndReserve(lockItems, client);

    // 2. Create the order row
    order = await orderRepo.create(
      {
        userId,
        subtotal:        pricing.subtotal,
        couponDiscount:  pricing.couponDiscount,
        paymentDiscount: pricing.paymentDiscount,
        taxAmount:       pricing.taxAmount,
        shippingAmount:  pricing.shippingAmount,
        totalAmount:     pricing.total,
        couponId:        coupon?.id ?? null,
        shippingAddress,
      },
      client
    );

    // 3. Insert denormalised line items
    await orderRepo.insertItems(
      cartItems.map(item => ({
        orderId:          order.id,
        variantId:        item.variant_id,
        productId:        item.product_id,
        productName:      item.name,
        size:             item.size,
        quantity:         item.quantity,
        priceAtPurchase:  parseFloat(item.sale_price ?? item.base_price),
      })),
      client
    );

    // 4. Record coupon usage
    if (coupon) {
      await couponRepo.recordUsage(
        { couponId: coupon.id, userId, orderId: order.id },
        client
      );
    }

    // 5. Persist gateway order — now inside the transaction (no orphan risk)
    await orderRepo.insertPaymentTransaction({
      orderId:        order.id,
      gatewayOrderId: gatewayOrder.id,
      gateway:        'razorpay',
      amountPaise,
    }, client);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return {
    order: { id: order.id, status: order.status },
    pricing,
    gateway: {
      orderId:  gatewayOrder.id,
      amount:   amountPaise,
      currency: 'INR',
      keyId:    process.env.RAZORPAY_KEY_ID ?? 'rzp_test_mock',
    },
  };
}

// ─── Order History ────────────────────────────────────────────────────────────

/**
 * Fetch a user's complete order history (newest first), each order with
 * its line items. Used by the My Orders page.
 */
async function getOrdersForUser(userId) {
  return orderRepo.findByUserId(userId);
}

/**
 * Fetch a single order by ID, verifying it belongs to the requesting user.
 * Throws 403 if the order exists but belongs to a different user.
 */
async function getOrderForUser(orderId, userId) {
  const order = await orderRepo.findById(orderId);
  if (!order) throw serviceError('Order not found', 404);
  if (order.user_id !== userId) throw serviceError('Forbidden', 403);
  return order;
}

module.exports = {
  checkout,
  getOrdersForUser,
  getOrderForUser,
};
