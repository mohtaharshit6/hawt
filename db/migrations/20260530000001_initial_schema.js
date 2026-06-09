'use strict';

/**
 * Migration: 20260530000001 — initial schema
 *
 * Creates the complete Hawt e-commerce schema:
 *   ENUMs → users → products → variants → carts → coupons →
 *   payment_offers → orders → order_items → order_payment_offers →
 *   payment_transactions → outbox → indexes → deferred FK
 *
 * down() tears everything down in strict reverse-FK order.
 * Running down() on a database with real order/user data is destructive —
 * it is only safe in development or CI environments.
 */

// ─── UP ───────────────────────────────────────────────────────────────────────

exports.up = (pgm) => {
  pgm.sql(`

    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    -- ── ENUMs ──────────────────────────────────────────────────────────────────

    CREATE TYPE order_status AS ENUM (
      'PENDING_PAYMENT', 'PAID', 'PROCESSING', 'FULFILLED', 'CANCELLED', 'REFUNDED'
    );

    CREATE TYPE payment_status AS ENUM (
      'CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED'
    );

    CREATE TYPE coupon_type AS ENUM ('flat', 'percent');

    CREATE TYPE outbox_status AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

    -- ── USERS ──────────────────────────────────────────────────────────────────

    CREATE TABLE users (
      id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      name          VARCHAR(120) NOT NULL,
      email         VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT         NOT NULL,
      phone         VARCHAR(20),
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );

    -- ── PRODUCTS ───────────────────────────────────────────────────────────────

    CREATE TABLE products (
      id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      name          VARCHAR(255)  NOT NULL,
      slug          VARCHAR(255)  NOT NULL UNIQUE,
      description   TEXT,
      category      VARCHAR(80)   NOT NULL,
      sku_prefix    VARCHAR(40)   NOT NULL,
      base_price    DECIMAL(12,2) NOT NULL CHECK (base_price >= 0),
      sale_price    DECIMAL(12,2)          CHECK (sale_price >= 0),
      image_url     TEXT,
      alt_image_url TEXT,
      badge         VARCHAR(50),
      sub           VARCHAR(255),
      tags          TEXT[]        NOT NULL DEFAULT '{}',
      is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    -- One row per size — the unit that inventory tracks and locks
    CREATE TABLE product_variants (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id   UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      size         VARCHAR(20) NOT NULL,
      sku          VARCHAR(80) NOT NULL UNIQUE,
      stock_qty    INTEGER     NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
      reserved_qty INTEGER     NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (product_id, size)
    );

    -- ── CART ───────────────────────────────────────────────────────────────────

    CREATE TABLE carts (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID                 REFERENCES users(id) ON DELETE CASCADE,
      session_id VARCHAR(120),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT cart_owner_check CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
    );

    CREATE TABLE cart_items (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      cart_id    UUID        NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
      variant_id UUID        NOT NULL REFERENCES product_variants(id),
      quantity   INTEGER     NOT NULL DEFAULT 1 CHECK (quantity > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (cart_id, variant_id)
    );

    -- ── COUPONS ────────────────────────────────────────────────────────────────

    CREATE TABLE coupons (
      id                            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      code                          VARCHAR(50)   NOT NULL UNIQUE,
      type                          coupon_type   NOT NULL,
      value                         DECIMAL(12,2) NOT NULL CHECK (value > 0),
      min_cart_value                DECIMAL(12,2) NOT NULL DEFAULT 0,
      max_discount                  DECIMAL(12,2),
      usage_limit                   INTEGER,
      user_usage_limit              INTEGER       NOT NULL DEFAULT 1,
      stackable_with_payment_offers BOOLEAN       NOT NULL DEFAULT FALSE,
      is_active                     BOOLEAN       NOT NULL DEFAULT TRUE,
      expires_at                    TIMESTAMPTZ,
      created_at                    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    -- Soft-written at PENDING_PAYMENT; hard-deleted on payment failure
    CREATE TABLE coupon_usage (
      id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      coupon_id UUID        NOT NULL REFERENCES coupons(id),
      user_id   UUID        NOT NULL REFERENCES users(id),
      order_id  UUID,
      used_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- ── PAYMENT OFFERS ─────────────────────────────────────────────────────────

    CREATE TABLE payment_offers (
      id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      name             VARCHAR(120)  NOT NULL,
      discount_percent DECIMAL(5,2)  NOT NULL,
      max_discount     DECIMAL(12,2),
      payment_method   VARCHAR(50)   NOT NULL,
      is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
      expires_at       TIMESTAMPTZ,
      created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    -- ── ORDERS ─────────────────────────────────────────────────────────────────

    CREATE TABLE orders (
      id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id          UUID          NOT NULL REFERENCES users(id),
      status           order_status  NOT NULL DEFAULT 'PENDING_PAYMENT',
      subtotal         DECIMAL(12,2) NOT NULL,
      coupon_discount  DECIMAL(12,2) NOT NULL DEFAULT 0,
      payment_discount DECIMAL(12,2) NOT NULL DEFAULT 0,
      tax_amount       DECIMAL(12,2) NOT NULL DEFAULT 0,
      shipping_amount  DECIMAL(12,2) NOT NULL DEFAULT 0,
      total_amount     DECIMAL(12,2) NOT NULL,
      coupon_id        UUID                   REFERENCES coupons(id),
      shipping_address JSONB,
      created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    -- Denormalised snapshot — captures name/size/price at the moment of purchase
    CREATE TABLE order_items (
      id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id          UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      variant_id        UUID          NOT NULL REFERENCES product_variants(id),
      product_id        UUID          NOT NULL REFERENCES products(id),
      product_name      VARCHAR(255)  NOT NULL,
      size              VARCHAR(20)   NOT NULL,
      quantity          INTEGER       NOT NULL CHECK (quantity > 0),
      price_at_purchase DECIMAL(12,2) NOT NULL,
      created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    -- UNIQUE(user_id, payment_offer_id, order_id) prevents replay attacks
    CREATE TABLE order_payment_offers (
      id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id         UUID          NOT NULL REFERENCES orders(id),
      user_id          UUID          NOT NULL REFERENCES users(id),
      payment_offer_id UUID          NOT NULL REFERENCES payment_offers(id),
      discount_amount  DECIMAL(12,2) NOT NULL,
      UNIQUE (user_id, payment_offer_id, order_id)
    );

    -- Deferred FK: coupon_usage.order_id → orders.id
    -- Split into two statements because orders didn't exist when coupon_usage was created
    ALTER TABLE coupon_usage
      ADD CONSTRAINT fk_coupon_usage_order
      FOREIGN KEY (order_id) REFERENCES orders(id);

    -- ── PAYMENT TRANSACTIONS ───────────────────────────────────────────────────

    CREATE TABLE payment_transactions (
      id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id           UUID           NOT NULL REFERENCES orders(id),
      gateway_order_id   VARCHAR(120)   UNIQUE,
      gateway_payment_id VARCHAR(120),
      gateway            VARCHAR(20)    NOT NULL DEFAULT 'razorpay',
      amount_paise       INTEGER        NOT NULL CHECK (amount_paise > 0),
      currency           CHAR(3)        NOT NULL DEFAULT 'INR',
      status             payment_status NOT NULL DEFAULT 'CREATED',
      gateway_response   JSONB,
      created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    );

    -- ── OUTBOX ─────────────────────────────────────────────────────────────────

    -- Async event queue — worker polls PENDING rows after each commit
    CREATE TABLE outbox (
      id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      aggregate_type VARCHAR(80)   NOT NULL,
      aggregate_id   UUID          NOT NULL,
      event_type     VARCHAR(80)   NOT NULL,
      payload        JSONB         NOT NULL,
      status         outbox_status NOT NULL DEFAULT 'PENDING',
      attempts       INTEGER       NOT NULL DEFAULT 0,
      last_error     TEXT,
      created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      processed_at   TIMESTAMPTZ
    );

    -- ── INDEXES ────────────────────────────────────────────────────────────────

    CREATE INDEX idx_products_category    ON products(category);
    CREATE INDEX idx_products_is_active   ON products(is_active);
    CREATE INDEX idx_variants_product_id  ON product_variants(product_id);

    CREATE INDEX idx_carts_user_id        ON carts(user_id);
    CREATE INDEX idx_carts_session_id     ON carts(session_id);
    CREATE INDEX idx_cart_items_cart_id   ON cart_items(cart_id);

    CREATE INDEX idx_orders_user_id       ON orders(user_id);
    CREATE INDEX idx_orders_status        ON orders(status);
    CREATE INDEX idx_order_items_order_id ON order_items(order_id);

    CREATE INDEX idx_coupon_usage_user    ON coupon_usage(user_id);
    CREATE INDEX idx_coupon_usage_coupon  ON coupon_usage(coupon_id);

    CREATE INDEX idx_payment_order_id     ON payment_transactions(order_id);
    CREATE INDEX idx_payment_gateway_oid  ON payment_transactions(gateway_order_id);

    CREATE INDEX idx_outbox_status        ON outbox(status);
    CREATE INDEX idx_outbox_aggregate     ON outbox(aggregate_type, aggregate_id);

  `);
};

// ─── DOWN ─────────────────────────────────────────────────────────────────────

exports.down = (pgm) => {
  pgm.sql(`

    -- Tables — reverse FK-dependency order (children before parents)
    DROP TABLE IF EXISTS outbox                CASCADE;
    DROP TABLE IF EXISTS payment_transactions  CASCADE;
    DROP TABLE IF EXISTS order_payment_offers  CASCADE;
    DROP TABLE IF EXISTS order_items           CASCADE;
    DROP TABLE IF EXISTS orders                CASCADE;
    DROP TABLE IF EXISTS coupon_usage          CASCADE;
    DROP TABLE IF EXISTS payment_offers        CASCADE;
    DROP TABLE IF EXISTS coupons               CASCADE;
    DROP TABLE IF EXISTS cart_items            CASCADE;
    DROP TABLE IF EXISTS carts                 CASCADE;
    DROP TABLE IF EXISTS product_variants      CASCADE;
    DROP TABLE IF EXISTS products              CASCADE;
    DROP TABLE IF EXISTS users                 CASCADE;

    -- ENUMs — after all tables that reference them are gone
    DROP TYPE IF EXISTS outbox_status;
    DROP TYPE IF EXISTS coupon_type;
    DROP TYPE IF EXISTS payment_status;
    DROP TYPE IF EXISTS order_status;

  `);
};
