-- Performance indexes: replace the broad non-partial category/is_active indexes
-- with partial indexes scoped to active products only. These are smaller on disk,
-- faster to scan, and directly match the WHERE clause in GET /api/products and
-- all frontend shop filter queries.

-- Drop old non-partial indexes being superseded
DROP INDEX IF EXISTS idx_products_category;
DROP INDEX IF EXISTS idx_products_is_active;

-- Category filter on active products (every shop page load hits this)
CREATE INDEX idx_products_active_cat
  ON products(category) WHERE is_active = TRUE;

-- Flag-based nav filters: New In, Sale, Clearance pills
CREATE INDEX idx_products_flags
  ON products(is_new_in, is_on_sale, is_clearance) WHERE is_active = TRUE;
