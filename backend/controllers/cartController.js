'use strict';

/**
 * Cart Controller — Express route handlers for cart management.
 *
 * Identity resolution:
 *   Authenticated users  → req.user.id     (set by optionalAuth / requireAuth)
 *   Guest users          → X-Session-ID    request header (UUID, client-generated)
 *
 * Every handler returns a consistent JSON shape:
 *   Success  →  { data: ... }         (2xx)
 *   Error    →  { error: "message" }  (4xx / 5xx)
 */

const cartService = require('../services/cartService');

// ─── Identity helper ──────────────────────────────────────────────────────────

/**
 * Extract userId + sessionId from the request.
 * At least one must be present; throws 400 otherwise.
 */
function identity(req) {
  const userId    = req.user?.id    ?? null;
  const sessionId = req.headers['x-session-id'] ?? null;

  if (!userId && !sessionId) {
    const err = new Error(
      'Provide an X-Session-ID header for guest cart access, or authenticate.'
    );
    err.status = 400;
    throw err;
  }
  return { userId, sessionId };
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /api/cart
 * Returns the cart items (with product details) for the current identity.
 * Creates an empty cart silently if none exists.
 */
async function getCart(req, res) {
  try {
    const { userId, sessionId } = identity(req);
    const items = await cartService.getCartItems({ userId, sessionId });
    res.json({ data: items });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

/**
 * POST /api/cart/items
 * Add a variant to the cart or increase its quantity.
 *
 * Body: { variantId: string, quantity?: number }
 *
 * Response includes a `capped` flag when the requested qty was reduced
 * because it exceeded available stock.
 */
async function addItem(req, res) {
  try {
    const { userId, sessionId } = identity(req);
    const { variantId, quantity = 1 } = req.body;

    if (!variantId) {
      return res.status(400).json({ error: 'variantId is required' });
    }

    const result = await cartService.addToCart({
      userId, sessionId,
      variantId,
      quantity: parseInt(quantity, 10),
    });

    const status = result.capped ? 207 : 201;
    res.status(status).json({ data: result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

/**
 * PUT /api/cart/items/:variantId
 * Set the absolute quantity for a cart item.
 * Pass quantity=0 to remove the item.
 *
 * Body: { quantity: number }
 */
async function updateItem(req, res) {
  try {
    const { userId, sessionId } = identity(req);
    const { variantId }         = req.params;
    const { quantity }          = req.body;

    if (quantity === undefined || quantity === null) {
      return res.status(400).json({ error: 'quantity is required' });
    }

    const result = await cartService.setQuantity({
      userId, sessionId,
      variantId,
      quantity: parseInt(quantity, 10),
    });

    // null means the item was removed (quantity was 0)
    res.json({ data: result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

/**
 * DELETE /api/cart/items/:variantId
 * Remove a specific variant from the cart entirely.
 */
async function removeItem(req, res) {
  try {
    const { userId, sessionId } = identity(req);
    const { variantId }         = req.params;

    await cartService.removeFromCart({ userId, sessionId, variantId });
    res.status(204).send();
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

/**
 * POST /api/cart/merge
 * Merge a guest session cart into the authenticated user's cart.
 * Called by the frontend immediately after login / registration.
 *
 * Requires: requireAuth middleware (user must be logged in).
 * Body: { sessionId: string }  — the guest session to merge from
 */
async function mergeCart(req, res) {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    await cartService.mergeCart({ sessionId, userId: req.user.id });
    res.json({ data: { merged: true } });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { getCart, addItem, updateItem, removeItem, mergeCart };
