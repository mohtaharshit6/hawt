'use strict';

/**
 * Cart Service — business logic for cart management.
 *
 * Sits between the HTTP controllers and the Cart / Inventory repositories.
 * All stock-cap logic lives here; the repository only does DB I/O.
 *
 * Guest vs authenticated carts:
 *   - A guest cart is identified by a session_id (UUID generated on the client).
 *   - On login, the frontend calls POST /cart/merge which triggers mergeCart().
 *   - After merge the guest cart is deleted and all future requests use userId.
 */

const cartRepo          = require('../repositories/cartRepository');
const inventoryRepo     = require('../repositories/inventoryRepository');
const { serviceError }  = require('../utils/errors');

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/** Available-to-sell stock for a variant row. */
function ats(variant) {
  return Math.max(0, variant.stock_qty - variant.reserved_qty);
}

// ─── Cart Resolution ──────────────────────────────────────────────────────────

/**
 * Return the cart for the given identity, creating one if it doesn't exist.
 * Pass a transaction `client` when this is called inside a larger transaction.
 *
 * @param {{ userId?: string, sessionId?: string }} identity
 * @param {import('pg').PoolClient} [client]
 */
async function resolveCart({ userId, sessionId }, client) {
  if (userId) {
    const existing = await cartRepo.findByUserId(userId, client);
    return existing ?? cartRepo.create({ userId }, client);
  }
  if (sessionId) {
    const existing = await cartRepo.findBySessionId(sessionId, client);
    return existing ?? cartRepo.create({ sessionId }, client);
  }
  throw serviceError('userId or sessionId is required', 400);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch all items in a cart enriched with product + variant data.
 * Creates an empty cart if none exists yet (idempotent).
 *
 * @returns {Promise<object[]>}  array of enriched cart item rows
 */
async function getCartItems({ userId, sessionId }) {
  const cart = await resolveCart({ userId, sessionId });
  return cartRepo.getItemsWithDetails(cart.id);
}

/**
 * Add a variant to the cart or increase its quantity.
 *
 * - If the item is already in the cart its quantity is incremented.
 * - The final stored quantity is capped at available-to-sell stock.
 * - Throws 404 if the variant doesn't exist.
 * - Throws 409 if the variant is completely out of stock.
 *
 * @param {{ userId?, sessionId?, variantId, quantity }} params
 * @returns {{ item: object, capped: boolean }}
 *   `capped` is true when the requested qty exceeded available stock.
 */
async function addToCart({ userId, sessionId, variantId, quantity = 1 }) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw serviceError('quantity must be a positive integer', 400);
  }

  const variant = await inventoryRepo.findVariantById(variantId);
  if (!variant) throw serviceError('Variant not found', 404);

  const available = ats(variant);
  if (available === 0) throw serviceError('This item is out of stock', 409);

  const cart     = await resolveCart({ userId, sessionId });
  const existing = await cartRepo.findItem(cart.id, variantId);
  const current  = existing ? existing.quantity : 0;

  const desired  = current + quantity;
  const finalQty = Math.min(desired, available);
  const item     = await cartRepo.upsertItem(cart.id, variantId, finalQty);

  return { item, capped: finalQty < desired };
}

/**
 * Set the absolute quantity of a cart item.
 *
 * Pass quantity = 0 to remove the item entirely.
 * The stored value is capped at available-to-sell stock.
 *
 * @param {{ userId?, sessionId?, variantId, quantity }} params
 * @returns {{ item: object, capped: boolean } | null}  null when item removed
 */
async function setQuantity({ userId, sessionId, variantId, quantity }) {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw serviceError('quantity must be a non-negative integer', 400);
  }

  const cart = await resolveCart({ userId, sessionId });

  if (quantity === 0) {
    await cartRepo.removeItem(cart.id, variantId);
    return null;
  }

  const variant  = await inventoryRepo.findVariantById(variantId);
  if (!variant) throw serviceError('Variant not found', 404);

  const finalQty = Math.min(quantity, ats(variant));
  const item     = await cartRepo.upsertItem(cart.id, variantId, finalQty);
  return { item, capped: finalQty < quantity };
}

/**
 * Remove a single variant from the cart.
 */
async function removeFromCart({ userId, sessionId, variantId }) {
  const cart = await resolveCart({ userId, sessionId });
  await cartRepo.removeItem(cart.id, variantId);
}

/**
 * Merge a guest session cart into the authenticated user's cart.
 *
 * Merge rules (blueprint):
 *  1. For each guest item, find the variant's current available stock.
 *  2. If the user's cart already has that variant, SUM the quantities.
 *  3. Cap the result at available-to-sell stock.
 *  4. Silently drop items that are now out of stock.
 *  5. Delete the guest cart (cart_items cascade automatically).
 *
 * This is intentionally NOT wrapped in a transaction — it is called
 * once on login and any partial state is self-correcting on the next
 * getCartItems call. Locking is handled during checkout, not here.
 *
 * @param {{ sessionId: string, userId: string }} params
 */
async function mergeCart({ sessionId, userId }) {
  const guestCart = await cartRepo.findBySessionId(sessionId);
  if (!guestCart) return; // nothing to merge

  const userCart   = await resolveCart({ userId });
  const guestItems = await cartRepo.getItemsWithDetails(guestCart.id);

  for (const gi of guestItems) {
    // gi has stock_qty / reserved_qty from the repository JOIN
    const available = ats(gi);
    if (available <= 0) continue; // item is OOS — drop silently

    const inUserCart = await cartRepo.findItem(userCart.id, gi.variant_id);
    const userQty    = inUserCart ? inUserCart.quantity : 0;
    const merged     = Math.min(userQty + gi.quantity, available);

    if (merged > 0) {
      await cartRepo.upsertItem(userCart.id, gi.variant_id, merged);
    }
  }

  // Destroy guest cart; cart_items cascade
  await cartRepo.deleteById(guestCart.id);
}

module.exports = {
  resolveCart,   // exported for use by checkoutService in Phase 3B
  getCartItems,
  addToCart,
  setQuantity,
  removeFromCart,
  mergeCart,
};
