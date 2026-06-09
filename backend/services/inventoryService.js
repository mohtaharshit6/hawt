'use strict';

/**
 * Inventory Service — stock availability checks and transactional reservation.
 *
 * The three mutating functions (lockAndReserve, releaseReservations,
 * fulfillOrder) do NOT manage transactions themselves. The caller
 * (checkoutService / webhookService) owns the BEGIN / COMMIT / ROLLBACK
 * and passes an open PoolClient.
 *
 * This keeps the inventory service a pure domain layer with no
 * knowledge of how its caller structures the surrounding transaction.
 */

const inventoryRepo    = require('../repositories/inventoryRepository');
const { serviceError } = require('../utils/errors');

// ─── Non-locking Read ─────────────────────────────────────────────────────────

/**
 * Optimistic availability check — no lock, safe to call outside a transaction.
 * Use for PDP "X left" banners and pre-checkout client-side validation.
 * Do NOT rely on this result for stock reservation; use lockAndReserve instead.
 *
 * @param {string} variantId
 * @param {number} quantity
 * @returns {Promise<boolean>}
 */
async function isAvailable(variantId, quantity) {
  const v = await inventoryRepo.findVariantById(variantId);
  if (!v) return false;
  return (v.stock_qty - v.reserved_qty) >= quantity;
}

// ─── Transactional Reservation ────────────────────────────────────────────────

/**
 * Lock each variant row in `items` and reserve the requested quantity.
 *
 * How it works:
 *  1. FOR UPDATE acquires a row-level lock, serialising concurrent checkouts
 *     that touch the same variant. A second checkout touching the same SKU
 *     will block at this step until this transaction commits or rolls back.
 *  2. After the lock is held, available = stock_qty - reserved_qty is checked.
 *  3. If sufficient, reserved_qty is incremented immediately.
 *  4. If ANY item fails the check, an error is thrown — the caller must
 *     ROLLBACK, which also releases all locks acquired so far in the loop.
 *
 * @param {{ variantId: string, quantity: number }[]} items
 * @param {import('pg').PoolClient} client  — REQUIRED: open transaction client
 * @throws {Error} status 404 if variant missing, 409 if insufficient stock
 */
async function lockAndReserve(items, client) {
  for (const { variantId, quantity } of items) {
    const variant = await inventoryRepo.lockVariant(variantId, client);

    if (!variant) {
      throw serviceError(`Variant ${variantId} not found`, 404);
    }

    const available = variant.stock_qty - variant.reserved_qty;
    if (available < quantity) {
      throw serviceError(
        `Not enough stock for variant ${variantId} ` +
        `(available: ${available}, requested: ${quantity})`,
        409
      );
    }

    await inventoryRepo.incrementReserved(variantId, quantity, client);
  }
}

/**
 * Release reservations previously created by lockAndReserve.
 *
 * Called when payment fails (webhook FAILED event) or the checkout
 * transaction itself rolls back for any reason.
 *
 * Safe to call with a partial list — the repository uses GREATEST(0, ...)
 * so duplicate decrements or OOO calls cannot push reserved_qty negative.
 *
 * @param {{ variantId: string, quantity: number }[]} items
 * @param {import('pg').PoolClient} client  — REQUIRED: open transaction client
 */
async function releaseReservations(items, client) {
  for (const { variantId, quantity } of items) {
    await inventoryRepo.decrementReserved(variantId, quantity, client);
  }
}

/**
 * Permanently deduct stock when an order transitions to PAID.
 *
 * Decrements BOTH stock_qty (permanent physical deduction) and
 * reserved_qty (consumes the reservation made at checkout) in one
 * atomic UPDATE per row, so no stock is ever double-counted.
 *
 * @param {{ variantId: string, quantity: number }[]} items
 * @param {import('pg').PoolClient} client  — REQUIRED: open transaction client
 * @throws {Error} status 409 on stock underflow (should be impossible if
 *   the checkout lock was honoured, but acts as a final safety net)
 */
async function fulfillOrder(items, client) {
  for (const { variantId, quantity } of items) {
    const updated = await inventoryRepo.deductStock(variantId, quantity, client);

    if (!updated || updated.stock_qty < 0) {
      throw serviceError(
        `Stock underflow on fulfillment for variant ${variantId}`,
        409
      );
    }
  }
}

module.exports = {
  isAvailable,
  lockAndReserve,
  releaseReservations,
  fulfillOrder,
};
