'use strict';

/**
 * Webhook Service — idempotent payment event handler.
 *
 * Entry point: handlePaymentEvent()
 *
 * Supported Razorpay webhook events:
 *   payment.captured  → SUCCESS path → mark PAID, deduct stock, clear cart
 *   payment.failed    → FAILURE path → release reservations, cancel order
 *
 * Idempotency:
 *   The handler checks the current order status before doing any work.
 *   If the order is already in a terminal state (PAID / CANCELLED) the
 *   entire handler is a no-op. This means Razorpay retries are safe.
 *
 * Transaction scope:
 *   Each path (success / failure) runs inside its own ACID transaction.
 *   All mutations — status update, stock deduction, outbox inserts, cart
 *   clear — are committed atomically. A failure mid-way rolls everything
 *   back so the webhook can be retried cleanly.
 */

const pool                  = require('../db');
const orderRepo             = require('../repositories/orderRepository');
const outboxRepo            = require('../repositories/outboxRepository');
const cartRepo              = require('../repositories/cartRepository');
const couponRepo            = require('../repositories/couponRepository');
const inventoryService      = require('./inventoryService');
const paymentGatewayService = require('./paymentGatewayService');
const { serviceError }      = require('../utils/errors');
const logger                = require('../utils/logger');

// ─── Entry Point ──────────────────────────────────────────────────────────────

/**
 * Validate the webhook signature and dispatch to the correct handler.
 *
 * @param {{
 *   eventName:  string,          — e.g. 'payment.captured'
 *   payload:    object,          — parsed webhook JSON body
 *   rawBody:    Buffer|string,   — original raw body for HMAC verification
 *   signature:  string,          — x-razorpay-signature header value
 * }} params
 */
async function handlePaymentEvent({ eventName, payload, rawBody, signature }) {
  // 1. Verify HMAC signature before touching the DB
  paymentGatewayService.verifyWebhookSignature(rawBody, signature);

  // 2. Extract payment entity from Razorpay webhook envelope
  const paymentEntity    = payload?.payload?.payment?.entity;
  const gatewayOrderId   = paymentEntity?.order_id;
  const gatewayPaymentId = paymentEntity?.id;

  if (!gatewayOrderId) {
    throw serviceError('Webhook payload missing payment.entity.order_id', 400);
  }

  // 3. Resolve the internal order from the gateway order ID
  const result = await orderRepo.findOrderByGatewayOrderId(gatewayOrderId);
  if (!result) {
    throw serviceError(`No order found for gateway order ID: ${gatewayOrderId}`, 404);
  }

  const { order, payment } = result;

  // 4. Dispatch
  if (eventName === 'payment.captured') {
    await handleSuccess({ order, payment, gatewayOrderId, gatewayPaymentId });
  } else if (eventName === 'payment.failed') {
    await handleFailure({ order, payment, gatewayOrderId });
  } else {
    // Unknown event type — acknowledge without error so Razorpay stops retrying
    logger.info(`[webhook] Unhandled event type: ${eventName} — acknowledged`);
  }
}

// ─── SUCCESS Path ─────────────────────────────────────────────────────────────

/**
 * Handle a successful payment capture.
 *
 * Within a single transaction:
 *  1. Transition order → PAID
 *  2. Permanently deduct stock (stock_qty - qty, reserved_qty - qty)
 *  3. Update payment_transactions row → CAPTURED
 *  4. Clear the user's cart
 *  5. Queue three outbox events: order.paid / confirmation email / fulfillment sync
 */
async function handleSuccess({ order, payment, gatewayOrderId, gatewayPaymentId }) {
  // Idempotency guard — already processed
  if (order.status === 'PAID') {
    logger.info(`[webhook] Order ${order.id} already PAID — skipping`);
    return;
  }

  if (!['PENDING_PAYMENT', 'PROCESSING'].includes(order.status)) {
    logger.warn(`[webhook] Order ${order.id} in unexpected status '${order.status}' for SUCCESS event`);
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Mark order PAID
    await orderRepo.updateStatus(order.id, 'PAID', client);

    // 2. Fetch line items and permanently deduct stock
    const items = await orderRepo.getOrderItems(order.id, client);
    await inventoryService.fulfillOrder(
      items.map(i => ({ variantId: i.variant_id, quantity: i.quantity })),
      client
    );

    // 3. Update payment transaction → CAPTURED
    await orderRepo.updatePaymentTransaction(
      gatewayOrderId,
      { gatewayPaymentId, status: 'CAPTURED' },
      client
    );

    // 4. Clear the user's cart so they start fresh
    const cart = await cartRepo.findByUserId(order.user_id, client);
    if (cart) await cartRepo.clearItems(cart.id, client);

    // 5. Queue outbox events (processed by a background worker)
    await outboxRepo.insert(
      {
        aggregateType: 'order',
        aggregateId:   order.id,
        eventType:     'order.paid',
        payload: {
          orderId:  order.id,
          userId:   order.user_id,
          total:    order.total_amount,
          currency: 'INR',
        },
      },
      client
    );

    await outboxRepo.insert(
      {
        aggregateType: 'order',
        aggregateId:   order.id,
        eventType:     'send_confirmation_email',
        payload: {
          orderId: order.id,
          userId:  order.user_id,
        },
      },
      client
    );

    await outboxRepo.insert(
      {
        aggregateType: 'order',
        aggregateId:   order.id,
        eventType:     'sync_fulfillment',
        payload: {
          orderId: order.id,
          items:   items.map(i => ({
            sku:      i.sku,
            variantId: i.variant_id,
            quantity: i.quantity,
          })),
        },
      },
      client
    );

    await client.query('COMMIT');
    logger.info(`[webhook] Order ${order.id} → PAID. Stock deducted, outbox queued.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── FAILURE Path ─────────────────────────────────────────────────────────────

/**
 * Handle a failed payment.
 *
 * Within a single transaction:
 *  1. Transition order → CANCELLED
 *  2. Release all stock reservations (reserved_qty - qty)
 *  3. Delete the coupon_usage record so the user can retry with the same coupon
 *  4. Update payment_transactions row → FAILED
 */
async function handleFailure({ order, payment, gatewayOrderId }) {
  // Idempotency guard — already cancelled
  if (order.status === 'CANCELLED') {
    logger.info(`[webhook] Order ${order.id} already CANCELLED — skipping`);
    return;
  }

  if (order.status === 'PAID') {
    logger.warn(`[webhook] FAILURE event received for already-PAID order ${order.id} — ignoring`);
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Cancel the order
    await orderRepo.updateStatus(order.id, 'CANCELLED', client);

    // 2. Release stock reservations
    const items = await orderRepo.getOrderItems(order.id, client);
    await inventoryService.releaseReservations(
      items.map(i => ({ variantId: i.variant_id, quantity: i.quantity })),
      client
    );

    // 3. Release coupon usage so the user can reuse it on the next attempt
    if (order.coupon_id) {
      await couponRepo.releaseUsage(order.coupon_id, order.id, client);
    }

    // 4. Mark payment transaction FAILED
    await orderRepo.updatePaymentTransaction(
      gatewayOrderId,
      { status: 'FAILED' },
      client
    );

    await client.query('COMMIT');
    logger.info(`[webhook] Order ${order.id} → CANCELLED. Reservations released.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Finalize a successful payment — called by both the webhook handler and
 * the client-side verify endpoint.
 *
 * Idempotent: if the order is already PAID it returns immediately.
 * Performs the lookup internally so callers only need gateway IDs.
 */
async function finalizeSuccessfulPayment({ gatewayOrderId, gatewayPaymentId }) {
  const result = await orderRepo.findOrderByGatewayOrderId(gatewayOrderId);
  if (!result) throw serviceError(`No order found for gateway order ID: ${gatewayOrderId}`, 404);

  const { order, payment } = result;
  if (order.status === 'PAID') return { order }; // already done — idempotent

  await handleSuccess({ order, payment, gatewayOrderId, gatewayPaymentId });
  return { order: { ...order, status: 'PAID' } };
}

module.exports = { handlePaymentEvent, finalizeSuccessfulPayment };
