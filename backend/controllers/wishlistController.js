'use strict';

/**
 * Wishlist Controller — products a logged-in user saves to buy later.
 *
 * All routes require authentication (requireAuth), so req.user.id is always set.
 * Wishlist is per-product (not per-variant): size is chosen later when the user
 * moves the item into their bag.
 *
 * Response shape mirrors the rest of the API:
 *   Success  →  { data: ... }
 *   Error    →  { error: "message" }
 */

const db = require('../db');

/**
 * GET /api/wishlist
 * Returns the user's saved products (newest first), with the fields the
 * frontend needs to render a tile and to "move to bag".
 */
async function getWishlist(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT p.id,
              p.name,
              p.sub,
              p.base_price,
              p.sale_price,
              p.image_url,
              p.alt_image_url,
              p.badge,
              p.discount_percentage,
              p.is_active,
              w.created_at AS saved_at
         FROM wishlist_items w
         JOIN products p ON p.id = w.product_id
        WHERE w.user_id = $1
        ORDER BY w.created_at DESC`,
      [req.user.id]
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

/**
 * POST /api/wishlist
 * Body: { productId: string }
 * Idempotent — saving an already-saved product is a no-op.
 */
async function addItem(req, res) {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ error: 'productId is required' });
    }

    const { rows } = await db.query(
      `INSERT INTO wishlist_items (user_id, product_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, product_id) DO NOTHING
       RETURNING id`,
      [req.user.id, productId]
    );

    res.status(201).json({ data: { productId, added: rows.length > 0 } });
  } catch (err) {
    // Invalid product_id → FK violation (23503)
    if (err.code === '23503') {
      return res.status(404).json({ error: 'product not found' });
    }
    res.status(err.status || 500).json({ error: err.message });
  }
}

/**
 * DELETE /api/wishlist/:productId
 * Removes a saved product. Idempotent.
 */
async function removeItem(req, res) {
  try {
    const { productId } = req.params;
    await db.query(
      `DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2`,
      [req.user.id, productId]
    );
    res.status(204).send();
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { getWishlist, addItem, removeItem };
