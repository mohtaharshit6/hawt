'use strict';

/**
 * Cart Repository — raw DB access for carts and cart_items.
 *
 * Every method accepts an optional `client` argument.
 * Pass a transaction PoolClient when the call must be part of an
 * atomic unit (e.g. mergeCart, checkout lock phase). Omit it for
 * standalone reads and writes that don't need a transaction.
 */

const { q } = require('../utils/dbQuery');

// ─── Cart ─────────────────────────────────────────────────────────────────────

/** Find the cart that belongs to an authenticated user. */
async function findByUserId(userId, client) {
  const { rows } = await q(
    client,
    'SELECT * FROM carts WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return rows[0] ?? null;
}

/** Find the cart that belongs to a guest session. */
async function findBySessionId(sessionId, client) {
  const { rows } = await q(
    client,
    'SELECT * FROM carts WHERE session_id = $1 LIMIT 1',
    [sessionId]
  );
  return rows[0] ?? null;
}

/**
 * Create a new cart.
 * At least one of userId / sessionId must be non-null
 * (enforced by cart_owner_check constraint).
 */
async function create({ userId = null, sessionId = null }, client) {
  const { rows } = await q(
    client,
    `INSERT INTO carts (user_id, session_id)
     VALUES ($1, $2)
     RETURNING *`,
    [userId, sessionId]
  );
  return rows[0];
}

/** Hard-delete a cart row (cart_items cascade automatically). */
async function deleteById(cartId, client) {
  await q(client, 'DELETE FROM carts WHERE id = $1', [cartId]);
}

// ─── Cart Items ───────────────────────────────────────────────────────────────

/**
 * Return all items in a cart, enriched with variant + product data.
 * This is the primary read path for the cart UI and checkout.
 *
 * Returned columns of note:
 *   quantity, variant_id, size, sku, stock_qty, reserved_qty,
 *   product_id, name, slug, image_url, base_price, sale_price, sub, badge
 */
async function getItemsWithDetails(cartId, client) {
  const { rows } = await q(
    client,
    `SELECT
       ci.id              AS cart_item_id,
       ci.quantity,
       ci.updated_at      AS item_updated_at,
       pv.id              AS variant_id,
       pv.size,
       pv.sku,
       pv.stock_qty,
       pv.reserved_qty,
       p.id               AS product_id,
       p.name,
       p.slug,
       p.image_url,
       p.alt_image_url,
       p.base_price,
       p.sale_price,
       p.sub,
       p.badge,
       p.category
     FROM cart_items ci
     JOIN product_variants pv ON pv.id = ci.variant_id
     JOIN products         p  ON p.id  = pv.product_id
     WHERE ci.cart_id = $1
     ORDER BY ci.created_at ASC`,
    [cartId]
  );
  return rows;
}

/** Find a single cart_items row (used to check whether an item already exists). */
async function findItem(cartId, variantId, client) {
  const { rows } = await q(
    client,
    'SELECT * FROM cart_items WHERE cart_id = $1 AND variant_id = $2',
    [cartId, variantId]
  );
  return rows[0] ?? null;
}

/**
 * Upsert a cart item, setting `quantity` to the supplied value.
 *
 * The calling service is always responsible for computing the final
 * quantity (adding deltas, capping at stock, etc.). This method
 * blindly stores whatever it receives.
 */
async function upsertItem(cartId, variantId, quantity, client) {
  const { rows } = await q(
    client,
    `INSERT INTO cart_items (cart_id, variant_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (cart_id, variant_id)
     DO UPDATE SET quantity = $3, updated_at = NOW()
     RETURNING *`,
    [cartId, variantId, quantity]
  );
  return rows[0];
}

/** Remove a single item from the cart. */
async function removeItem(cartId, variantId, client) {
  await q(
    client,
    'DELETE FROM cart_items WHERE cart_id = $1 AND variant_id = $2',
    [cartId, variantId]
  );
}

/** Remove all items from a cart (keeps the cart row itself). */
async function clearItems(cartId, client) {
  await q(client, 'DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
}

module.exports = {
  findByUserId,
  findBySessionId,
  create,
  deleteById,
  getItemsWithDetails,
  findItem,
  upsertItem,
  removeItem,
  clearItems,
};
