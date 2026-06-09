'use strict';
const router              = require('express').Router();
const path                = require('path');
const fs                  = require('fs');
const multer              = require('multer');
const db                  = require('../db');
const logger              = require('../utils/logger');
const { requireAdmin }    = require('../middleware/requireAdmin');
const { validateUUID }    = require('../middleware/validateUUID');

const IMAGES_DIR = path.join(__dirname, '../../frontend/images/products');

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, IMAGES_DIR),
    filename:    (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, req.params.id + ext);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('only image files are allowed'));
  },
});

// ── GET /api/admin/products ────────────────────────────────────────────────
router.get('/products', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*,
        COALESCE(
          json_agg(
            json_build_object('id', v.id, 'size', v.size, 'sku', v.sku,
                              'stock_qty', v.stock_qty, 'reserved_qty', v.reserved_qty)
            ORDER BY v.size
          ) FILTER (WHERE v.id IS NOT NULL), '[]'
        ) AS variants
      FROM products p
      LEFT JOIN product_variants v ON v.product_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'failed to load products' });
  }
});

// ── POST /api/admin/products ───────────────────────────────────────────────
router.post('/products', requireAdmin, async (req, res) => {
  const {
    name, category, base_price, badge, sub, description, image_url, tags, sizes,
    is_new_in, is_on_sale, is_clearance, discount_percentage,
  } = req.body;
  if (!name || !category || !base_price) {
    return res.status(400).json({ error: 'name, category, and base_price are required' });
  }
  const discPct = Math.max(0, Math.min(99, parseInt(discount_percentage) || 0));
  const computedSalePrice = discPct > 0
    ? parseFloat((parseFloat(base_price) * (1 - discPct / 100)).toFixed(2))
    : null;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    + '-' + Date.now().toString(36);
  const skuPrefix = 'HWT-' + category.toUpperCase().slice(0, 3).replace(/[^A-Z]/g, 'X') + '-' + Math.floor(Math.random() * 900 + 100);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const pResult = await client.query(
      `INSERT INTO products (name, slug, description, category, sku_prefix, base_price, sale_price,
        image_url, badge, sub, tags, is_active,
        is_new_in, is_on_sale, is_clearance, discount_percentage)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE,$12,$13,$14,$15)
       RETURNING *`,
      [name, slug, description || '', category, skuPrefix,
       parseFloat(base_price), computedSalePrice,
       image_url || '', badge || null, sub || '', tags || [],
       !!is_new_in, !!is_on_sale, !!is_clearance, discPct]
    );
    const product = pResult.rows[0];
    if (Array.isArray(sizes) && sizes.length) {
      for (const s of sizes) {
        const sku = skuPrefix + '-' + s.size.toUpperCase().replace(/\s/g, '');
        await client.query(
          `INSERT INTO product_variants (product_id, size, sku, stock_qty) VALUES ($1,$2,$3,$4)`,
          [product.id, s.size, sku, parseInt(s.stock_qty) || 0]
        );
      }
    }
    await client.query('COMMIT');
    res.status(201).json(product);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error(err);
    res.status(500).json({ error: 'failed to create product' });
  } finally {
    client.release();
  }
});

// ── PUT /api/admin/products/:id ────────────────────────────────────────────
router.put('/products/:id', requireAdmin, validateUUID, async (req, res) => {
  const {
    name, category, base_price, badge, sub, description, image_url, is_active, sizes,
    is_new_in, is_on_sale, is_clearance, discount_percentage,
  } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Fetch current base_price if not provided, to compute sale_price
    const cur = await client.query('SELECT base_price FROM products WHERE id = $1', [req.params.id]);
    if (!cur.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'product not found' }); }
    const effectiveBase = base_price ? parseFloat(base_price) : parseFloat(cur.rows[0].base_price);
    const discPct = discount_percentage !== undefined
      ? Math.max(0, Math.min(99, parseInt(discount_percentage) || 0))
      : undefined;
    const computedSalePrice = discPct !== undefined
      ? (discPct > 0 ? parseFloat((effectiveBase * (1 - discPct / 100)).toFixed(2)) : null)
      : undefined;
    const result = await client.query(
      `UPDATE products SET
        name                = COALESCE($1, name),
        category            = COALESCE($2, category),
        base_price          = COALESCE($3, base_price),
        sale_price          = COALESCE($4, sale_price),
        badge               = COALESCE($5, badge),
        sub                 = COALESCE($6, sub),
        description         = COALESCE($7, description),
        image_url           = COALESCE($8, image_url),
        is_active           = COALESCE($9, is_active),
        is_new_in           = COALESCE($10, is_new_in),
        is_on_sale          = COALESCE($11, is_on_sale),
        is_clearance        = COALESCE($12, is_clearance),
        discount_percentage = COALESCE($13, discount_percentage),
        updated_at          = NOW()
       WHERE id = $14 RETURNING *`,
      [
        name || null, category || null,
        base_price ? parseFloat(base_price) : null,
        computedSalePrice !== undefined ? computedSalePrice : null,
        badge !== undefined ? (badge || null) : null,
        sub || null, description || null, image_url || null,
        is_active !== undefined ? is_active : null,
        is_new_in !== undefined ? !!is_new_in : null,
        is_on_sale !== undefined ? !!is_on_sale : null,
        is_clearance !== undefined ? !!is_clearance : null,
        discPct !== undefined ? discPct : null,
        req.params.id,
      ]
    );
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'product not found' });
    }
    if (Array.isArray(sizes)) {
      await client.query('DELETE FROM product_variants WHERE product_id = $1', [req.params.id]);
      const skuPrefix = result.rows[0].sku_prefix;
      for (const s of sizes) {
        const sku = skuPrefix + '-' + s.size.toUpperCase().replace(/\s/g, '');
        await client.query(
          `INSERT INTO product_variants (product_id, size, sku, stock_qty) VALUES ($1,$2,$3,$4)`,
          [req.params.id, s.size, sku, parseInt(s.stock_qty) || 0]
        );
      }
    }
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error(err);
    res.status(500).json({ error: 'failed to update product' });
  } finally {
    client.release();
  }
});

// ── DELETE /api/admin/products/:id (soft delete) ──────────────────────────
router.delete('/products/:id', requireAdmin, validateUUID, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'product not found' });
    res.json({ message: 'product deactivated' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'failed to delete product' });
  }
});

// ── POST /api/admin/products/:id/image ────────────────────────────────────
router.post('/products/:id/image', requireAdmin, validateUUID, (req, res, next) => {
  upload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'no image file provided' });
    const imageUrl = '/images/products/' + req.file.filename;
    try {
      const result = await db.query(
        `UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2 RETURNING id, image_url`,
        [imageUrl, req.params.id]
      );
      if (!result.rows.length) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'product not found' });
      }
      res.json({ image_url: imageUrl });
    } catch (err2) {
      logger.error(err2);
      res.status(500).json({ error: 'failed to update image' });
    }
  });
});

module.exports = router;
