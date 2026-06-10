-- Add product flag columns (were missing from initial schema)
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_new_in    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_on_sale   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_clearance BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percentage INTEGER;

-- Performance indexes: replace the broad non-partial category/is_active indexes
-- with partial indexes scoped to active products only.
DROP INDEX IF EXISTS idx_products_category;
DROP INDEX IF EXISTS idx_products_is_active;

CREATE INDEX idx_products_active_cat
  ON products(category) WHERE is_active = TRUE;

CREATE INDEX idx_products_flags
  ON products(is_new_in, is_on_sale, is_clearance) WHERE is_active = TRUE;
