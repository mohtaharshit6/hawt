'use strict';

/**
 * Order Repository — raw DB access for orders, order_items, and
 * payment_transactions.
 *
 * All mutating methods (create, insertItems, updateStatus, …) accept
 * an optional `client` for transaction support. Read-only methods that
 * are only ever called outside of a transaction omit the parameter.
 */

const pool   = require('../db');
const { q }  = require('../utils/dbQuery');

// ─── Orders ───────────────────────────────────────────────────────────────────

/**
 * Insert a new order row in PENDING_PAYMENT state.
 * All monetary amounts are stored as DECIMAL(12,2).
 */
async function create(
  {
    userId,
    subtotal,
    couponDiscount,
    paymentDiscount,
    taxAmount,
    shippingAmount,
    totalAmount,
    couponId        = null,
    shippingAddress = null,
  },
  client
) {
  const { rows } = await q(
    client,
    `INSERT INTO orders
       (user_id, status, subtotal, coupon_discount, payment_discount,
        tax_amount, shipping_amount, total_amount, coupon_id, shipping_address)
     VALUES ($1,'PENDING_PAYMENT',$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      userId, subtotal, couponDiscount, paymentDiscount,
      taxAmount, shippingAmount, totalAmount, couponId,
      shippingAddress ? JSON.stringify(shippingAddress) : null,
    ]
  );
  return rows[0];
}

/**
 * Fetch a single order by its UUID, including all line items and the
 * primary image URL for each product.
 * Returns null when the order is not found.
 */
async function findById(orderId, client) {
  const { rows } = await q(
    client,
    `SELECT
       o.*,
       COALESCE(
         json_agg(
           json_build_object(
             'id',                oi.id,
             'variant_id',        oi.variant_id,
             'product_id',        oi.product_id,
             'product_name',      oi.product_name,
             'size',              oi.size,
             'quantity',          oi.quantity,
             'price_at_purchase', oi.price_at_purchase,
             'image_url',         p.image_url
           ) ORDER BY oi.created_at
         ) FILTER (WHERE oi.id IS NOT NULL),
         '[]'
       ) AS items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN products    p  ON p.id = oi.product_id
     WHERE o.id = $1
     GROUP BY o.id`,
    [orderId]
  );
  return rows[0] ?? null;
}

/**
 * Fetch all orders for a user, newest first, each with its line items.
 * Uses a single aggregation query to avoid N+1.
 */
async function findByUserId(userId) {
  const { rows } = await pool.query(
    `SELECT
       o.*,
       COALESCE(
         json_agg(
           json_build_object(
             'id',                oi.id,
             'variant_id',        oi.variant_id,
             'product_id',        oi.product_id,
             'product_name',      oi.product_name,
             'size',              oi.size,
             'quantity',          oi.quantity,
             'price_at_purchase', oi.price_at_purchase,
             'image_url',         p.image_url
           ) ORDER BY oi.created_at
         ) FILTER (WHERE oi.id IS NOT NULL),
         '[]'
       ) AS items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN products    p  ON p.id = oi.product_id
     WHERE o.user_id = $1
     GROUP BY o.id
     ORDER BY o.created_at DESC`,
    [userId]
  );
  return rows;
}

/** Transition an order to a new status. */
async function updateStatus(orderId, status, client) {
  const { rows } = await q(
    client,
    `UPDATE orders
     SET status = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, status, updated_at`,
    [orderId, status]
  );
  return rows[0];
}

// ─── Order Items ──────────────────────────────────────────────────────────────

/**
 * Batch-insert all line items for an order.
 * Denormalised snapshot: product_name, size, and price_at_purchase are
 * captured at checkout time so the order history is immutable.
 *
 * @param {{ orderId, variantId, productId, productName, size, quantity, priceAtPurchase }[]} items
 * @param {import('pg').PoolClient} client
 */
async function insertItems(items, client) {
  if (!items.length) return [];

  const placeholders = [];
  const params       = [];
  let   p            = 1;

  for (const item of items) {
    placeholders.push(`($${p},$${p+1},$${p+2},$${p+3},$${p+4},$${p+5},$${p+6})`);
    params.push(
      item.orderId, item.variantId, item.productId, item.productName,
      item.size, item.quantity, item.priceAtPurchase
    );
    p += 7;
  }

  const { rows } = await client.query(
    `INSERT INTO order_items
       (order_id, variant_id, product_id, product_name, size, quantity, price_at_purchase)
     VALUES ${placeholders.join(',')}
     RETURNING *`,
    params
  );
  return rows;
}

/**
 * Fetch raw order_items rows for an order, with product image_url.
 * Used by webhookService to build the inventory deduction / outbox payload.
 */
async function getOrderItems(orderId, client) {
  const { rows } = await q(
    client,
    `SELECT oi.*, p.image_url
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1
     ORDER BY oi.created_at`,
    [orderId]
  );
  return rows;
}

// ─── Payment Transactions ─────────────────────────────────────────────────────

/**
 * Insert a new payment_transactions row immediately after the gateway
 * order is created. Starts in CREATED status.
 */
async function insertPaymentTransaction(
  { orderId, gatewayOrderId, gateway = 'razorpay', amountPaise },
  client
) {
  const { rows } = await q(
    client,
    `INSERT INTO payment_transactions
       (order_id, gateway_order_id, gateway, amount_paise, currency, status)
     VALUES ($1, $2, $3, $4, 'INR', 'CREATED')
     RETURNING *`,
    [orderId, gatewayOrderId, gateway, amountPaise]
  );
  return rows[0];
}

/**
 * Update a payment_transactions row when the webhook arrives.
 *
 * @param {string}         gatewayOrderId
 * @param {{ gatewayPaymentId?: string, status: string }} updates
 * @param {import('pg').PoolClient} [client]
 */
async function updatePaymentTransaction(gatewayOrderId, { gatewayPaymentId = null, status }, client) {
  const { rows } = await q(
    client,
    `UPDATE payment_transactions
     SET status             = $2,
         gateway_payment_id = COALESCE($3, gateway_payment_id),
         updated_at         = NOW()
     WHERE gateway_order_id = $1
     RETURNING *`,
    [gatewayOrderId, status, gatewayPaymentId]
  );
  return rows[0] ?? null;
}

/**
 * Resolve a gateway order ID → the associated internal order + payment row.
 * Used as the entry point for every incoming webhook event.
 *
 * Returns null when no matching payment transaction is found.
 */
async function findOrderByGatewayOrderId(gatewayOrderId, client) {
  const { rows } = await q(
    client,
    `SELECT
       o.id,          o.user_id,        o.status,
       o.subtotal,    o.coupon_id,      o.total_amount,
       o.coupon_discount, o.payment_discount,
       o.tax_amount,  o.shipping_amount,
       o.shipping_address, o.created_at,
       pt.id          AS payment_tx_id,
       pt.status      AS payment_status,
       pt.gateway_order_id,
       pt.gateway_payment_id
     FROM payment_transactions pt
     JOIN orders o ON o.id = pt.order_id
     WHERE pt.gateway_order_id = $1
     LIMIT 1`,
    [gatewayOrderId]
  );
  if (!rows[0]) return null;

  const row = rows[0];
  return {
    order: {
      id:               row.id,
      user_id:          row.user_id,
      status:           row.status,
      subtotal:         row.subtotal,
      total_amount:     row.total_amount,
      coupon_id:        row.coupon_id,
      coupon_discount:  row.coupon_discount,
      payment_discount: row.payment_discount,
      tax_amount:       row.tax_amount,
      shipping_amount:  row.shipping_amount,
      shipping_address: row.shipping_address,
      created_at:       row.created_at,
    },
    payment: {
      id:                  row.payment_tx_id,
      status:              row.payment_status,
      gateway_order_id:    row.gateway_order_id,
      gateway_payment_id:  row.gateway_payment_id,
    },
  };
}

module.exports = {
  create,
  findById,
  findByUserId,
  updateStatus,
  insertItems,
  getOrderItems,
  insertPaymentTransaction,
  updatePaymentTransaction,
  findOrderByGatewayOrderId,
};
