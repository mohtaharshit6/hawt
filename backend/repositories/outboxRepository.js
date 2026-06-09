'use strict';

/**
 * Outbox Repository — async event queue backed by the `outbox` table.
 *
 * The outbox pattern guarantees that domain events (send email, sync
 * fulfillment, etc.) are only published AFTER the database transaction
 * that produced them commits. A background worker polls PENDING rows,
 * processes them, and marks them DONE or FAILED.
 *
 * All writes that happen inside a checkout / webhook transaction MUST
 * pass the transaction `client` so the insert is part of the same
 * commit. If the outer transaction rolls back, the event is never
 * queued — exactly the behaviour we want.
 */

const { q } = require('../utils/dbQuery');

/**
 * Queue a new outbox event.
 *
 * @param {{
 *   aggregateType: string,   — e.g. 'order', 'user'
 *   aggregateId:   string,   — UUID of the aggregate (order.id, etc.)
 *   eventType:     string,   — e.g. 'order.paid', 'send_confirmation_email'
 *   payload:       object,   — arbitrary JSON — serialised to JSONB
 * }} event
 * @param {import('pg').PoolClient} [client] — pass inside a transaction
 */
async function insert({ aggregateType, aggregateId, eventType, payload }, client) {
  const { rows } = await q(
    client,
    `INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [aggregateType, aggregateId, eventType, JSON.stringify(payload)]
  );
  return rows[0];
}

/**
 * Claim a batch of PENDING events for processing.
 * Uses FOR UPDATE SKIP LOCKED — safe for concurrent workers; each
 * worker claims its own slice without blocking the others.
 *
 * Sets status → PROCESSING so the same row isn't claimed twice.
 *
 * @param {number} [limit=10]  — max rows to claim per sweep
 * @param {import('pg').PoolClient} client — REQUIRED: open transaction client
 */
async function claimPending(limit = 10, client) {
  const { rows } = await client.query(
    `UPDATE outbox
     SET status = 'PROCESSING', attempts = attempts + 1
     WHERE id IN (
       SELECT id FROM outbox
       WHERE status = 'PENDING'
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [limit]
  );
  return rows;
}

/** Mark an event as successfully processed. */
async function markDone(id, client) {
  await q(
    client,
    `UPDATE outbox
     SET status = 'DONE', processed_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
}

/**
 * Mark an event as failed and record the error message.
 * The worker can retry rows where status = 'FAILED' and attempts < threshold.
 */
async function markFailed(id, errorMessage, client) {
  await q(
    client,
    `UPDATE outbox
     SET status = 'FAILED', last_error = $2, updated_at = NOW()
     WHERE id = $1`,
    [id, errorMessage]
  );
}

/**
 * Reset a FAILED or PROCESSING event back to PENDING so it can be retried.
 * Useful for manual recovery or scheduled retry sweeps.
 */
async function resetForRetry(id, client) {
  await q(
    client,
    `UPDATE outbox
     SET status = 'PENDING', last_error = NULL, updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
}

module.exports = {
  insert,
  claimPending,
  markDone,
  markFailed,
  resetForRetry,
};
