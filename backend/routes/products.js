'use strict';

const router              = require('express').Router();
const db                  = require('../db');
const logger              = require('../utils/logger');
const { validateUUID }    = require('../middleware/validateUUID');

// GET /api/products?page=1&limit=40
// Returns paginated active products with a `sizes` string array (for quick-add on PLP).
router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 40));
    const offset = (page - 1) * limit;

    const [dataResult, countResult] = await Promise.all([
      db.query(`
        SELECT
          p.*,
          COALESCE(
            array_agg(v.size ORDER BY v.size) FILTER (WHERE v.id IS NOT NULL),
            ARRAY[]::varchar[]
          ) AS sizes
        FROM products p
        LEFT JOIN product_variants v ON v.product_id = p.id
        WHERE p.is_active = TRUE
        GROUP BY p.id
        ORDER BY p.name
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
      db.query('SELECT COUNT(*) FROM products WHERE is_active = TRUE'),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    res.json({
      data: dataResult.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'could not fetch products' });
  }
});

// GET /api/products/:id
// Returns one product with a `variants` array (size + live stock for PDP).
router.get('/:id', validateUUID, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        p.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id',           v.id,
              'size',         v.size,
              'sku',          v.sku,
              'stock_qty',    v.stock_qty,
              'reserved_qty', v.reserved_qty
            ) ORDER BY v.size
          ) FILTER (WHERE v.id IS NOT NULL),
          '[]'::json
        ) AS variants
      FROM products p
      LEFT JOIN product_variants v ON v.product_id = p.id
      WHERE p.id = $1
      GROUP BY p.id
    `, [req.params.id]);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'could not fetch product' });
  }
});

module.exports = router;
