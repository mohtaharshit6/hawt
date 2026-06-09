'use strict';

const pool             = require('../db');
const orderRepo        = require('../repositories/orderRepository');
const couponRepo       = require('../repositories/couponRepository');
const inventoryService = require('../services/inventoryService');
const logger           = require('../utils/logger');

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const STALE_MINUTES    = 30;

async function cancelStaleOrders() {
  // Compute threshold JS-side and pass as a typed parameter — no string interpolation in SQL
  const staleThreshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000);

  const { rows: staleOrders } = await pool.query(
    `SELECT id, coupon_id FROM orders
     WHERE status = 'PENDING_PAYMENT'
       AND created_at < $1`,
    [staleThreshold]
  );

  if (!staleOrders.length) {
    logger.info('staleOrderWorker: 0 stale orders cleaned');
    return;
  }

  let cancelled = 0;
  for (const { id, coupon_id } of staleOrders) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const items = await orderRepo.getOrderItems(id, client);
      if (items.length) {
        await inventoryService.releaseReservations(
          items.map(i => ({ variantId: i.variant_id, quantity: i.quantity })),
          client
        );
      }

      // Release coupon so the user can reuse it — mirrors the webhook failure handler
      if (coupon_id) {
        await couponRepo.releaseUsage(coupon_id, id, client);
      }

      await orderRepo.updateStatus(id, 'CANCELLED', client);
      await client.query('COMMIT');
      cancelled++;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      logger.error({ err, orderId: id }, 'staleOrderWorker: failed to cancel order');
    } finally {
      client.release();
    }
  }

  logger.info({ cancelled }, `staleOrderWorker: ${cancelled} stale order(s) cancelled`);
}

function start() {
  logger.info('stale order worker started');
  cancelStaleOrders().catch(err => logger.error({ err }, 'staleOrderWorker: initial run failed'));
  setInterval(() => {
    cancelStaleOrders().catch(err => logger.error({ err }, 'staleOrderWorker: sweep failed'));
  }, POLL_INTERVAL_MS);
}

module.exports = { start };
