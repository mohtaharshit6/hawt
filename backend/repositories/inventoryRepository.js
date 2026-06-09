'use strict';

/**
 * Inventory Repository — raw DB access for product_variants stock fields.
 *
 * The four mutating methods (lockVariant, incrementReserved,
 * decrementReserved, deductStock) MUST be called with a transaction
 * PoolClient. They do not open their own transactions; the caller
 * controls the BEGIN / COMMIT / ROLLBACK lifecycle.
 */

const { q } = require('../utils/dbQuery');

/**
 * Plain read — no lock, no transaction required.
 * Use for stock-level display (PDP "X left") or pre-checkout UI checks.
 */
async function findVariantById(variantId, client) {
  const { rows } = await q(
    client,
    'SELECT * FROM product_variants WHERE id = $1',
    [variantId]
  );
  return rows[0] ?? null;
}

/**
 * Acquire a pessimistic row-level lock on a variant for the duration
 * of the surrounding transaction.
 *
 * FOR UPDATE blocks any other transaction that tries to lock or
 * modify the same row until the current transaction commits or rolls back.
 * This prevents double-reservations on the last unit of stock.
 *
 * Returns the locked row (id, stock_qty, reserved_qty) or null if the
 * variant does not exist.
 *
 * @param {string}              variantId
 * @param {import('pg').PoolClient} client  — REQUIRED: open transaction client
 */
async function lockVariant(variantId, client) {
  const { rows } = await client.query(
    `SELECT id, stock_qty, reserved_qty
     FROM product_variants
     WHERE id = $1
     FOR UPDATE`,
    [variantId]
  );
  return rows[0] ?? null;
}

/**
 * Atomically add `qty` to reserved_qty.
 * Call this AFTER lockVariant has confirmed sufficient availability.
 *
 * @param {string}              variantId
 * @param {number}              qty
 * @param {import('pg').PoolClient} client  — REQUIRED: open transaction client
 */
async function incrementReserved(variantId, qty, client) {
  const { rows } = await client.query(
    `UPDATE product_variants
     SET reserved_qty = reserved_qty + $2,
         updated_at   = NOW()
     WHERE id = $1
     RETURNING id, stock_qty, reserved_qty`,
    [variantId, qty]
  );
  return rows[0];
}

/**
 * Release a reservation — subtract `qty` from reserved_qty.
 * GREATEST(0, ...) prevents reserved_qty from going negative due to
 * duplicate or out-of-order webhook retries.
 *
 * Used on: payment failure, checkout timeout, webhook FAILED event.
 *
 * @param {string}              variantId
 * @param {number}              qty
 * @param {import('pg').PoolClient} client  — REQUIRED: open transaction client
 */
async function decrementReserved(variantId, qty, client) {
  const { rows } = await client.query(
    `UPDATE product_variants
     SET reserved_qty = GREATEST(0, reserved_qty - $2),
         updated_at   = NOW()
     WHERE id = $1
     RETURNING id, stock_qty, reserved_qty`,
    [variantId, qty]
  );
  return rows[0];
}

/**
 * Permanently deduct stock when an order moves to PAID.
 * Decrements stock_qty AND reserved_qty in one atomic UPDATE so the
 * reservation is consumed rather than merely released.
 *
 * The CHECK (stock_qty >= 0) in the schema acts as a final guard;
 * inventoryService.fulfillOrder checks the result independently.
 *
 * @param {string}              variantId
 * @param {number}              qty
 * @param {import('pg').PoolClient} client  — REQUIRED: open transaction client
 */
async function deductStock(variantId, qty, client) {
  const { rows } = await client.query(
    `UPDATE product_variants
     SET stock_qty    = stock_qty    - $2,
         reserved_qty = GREATEST(0, reserved_qty - $2),
         updated_at   = NOW()
     WHERE id = $1
     RETURNING id, stock_qty, reserved_qty`,
    [variantId, qty]
  );
  return rows[0];
}

module.exports = {
  findVariantById,
  lockVariant,
  incrementReserved,
  decrementReserved,
  deductStock,
};
