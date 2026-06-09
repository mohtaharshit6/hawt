'use strict';

const pool       = require('../db');
const outboxRepo = require('../repositories/outboxRepository');
const logger     = require('../utils/logger');

const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE       = 10;
const MAX_ATTEMPTS     = 3;

async function dispatch(event) {
  switch (event.event_type) {
    case 'order.paid':
    case 'order.cod_placed':
      logger.info({ orderId: event.payload?.orderId, event: event.event_type }, 'outbox: order event — stub');
      break;
    case 'send_confirmation_email':
      logger.info({ orderId: event.payload?.orderId }, 'outbox: confirmation email — stub');
      break;
    case 'sync_fulfillment':
      logger.info({ orderId: event.payload?.orderId }, 'outbox: fulfillment sync — stub');
      break;
    default:
      logger.warn({ event_type: event.event_type }, 'outbox: unknown event type');
  }
}

async function sweep() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const events = await outboxRepo.claimPending(BATCH_SIZE, client);
    await client.query('COMMIT');

    for (const event of events) {
      if (event.attempts > MAX_ATTEMPTS) {
        const errClient = await pool.connect();
        try {
          await outboxRepo.markFailed(event.id, 'max attempts exceeded', errClient);
        } finally {
          errClient.release();
        }
        continue;
      }

      try {
        await dispatch(event);
        const doneClient = await pool.connect();
        try {
          await outboxRepo.markDone(event.id, doneClient);
        } finally {
          doneClient.release();
        }
      } catch (err) {
        logger.error({ err, eventId: event.id }, 'outbox: dispatch failed');
        const failClient = await pool.connect();
        try {
          await outboxRepo.markFailed(event.id, err.message, failClient);
        } finally {
          failClient.release();
        }
      }
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error({ err }, 'outbox: sweep error');
  } finally {
    client.release();
  }
}

function start() {
  logger.info('outbox worker started');
  setInterval(sweep, POLL_INTERVAL_MS);
}

module.exports = { start };
