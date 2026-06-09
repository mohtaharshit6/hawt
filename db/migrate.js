'use strict';

/**
 * Migration runner — thin wrapper around node-pg-migrate's JS API.
 *
 * Why a wrapper instead of calling the CLI directly?
 *   The CLI is a standalone process; it doesn't inherit the Node process
 *   environment that dotenv has already populated. This file loads .env
 *   first, so DATABASE_URL is always available regardless of how the
 *   script is invoked (npm script, CI runner, Docker entrypoint, etc.).
 *
 * Usage (via npm scripts):
 *   npm run db:migrate           — apply all pending migrations
 *   npm run db:rollback          — roll back the most recent migration
 *   npm run db:rollback -- 3     — roll back the last 3 migrations
 *
 * Usage (direct):
 *   node db/migrate.js up
 *   node db/migrate.js down
 *   node db/migrate.js down 3
 *
 * To create a new migration file:
 *   npm run db:migrate:create -- <migration_name>
 *   e.g.  npm run db:migrate:create -- add_phone_to_users
 *   This shells out to the node-pg-migrate CLI (file creation only — no DB).
 */

require('dotenv').config({ path: `${__dirname}/../.env` });

const path          = require('path');
const nodePgMigrate = require('node-pg-migrate');

// node-pg-migrate compiles to CJS with a .default export
const runner = nodePgMigrate.default ?? nodePgMigrate;

const direction = process.argv[2] ?? 'up';

if (!['up', 'down'].includes(direction)) {
  console.error('Usage: node db/migrate.js [up|down] [count]');
  process.exit(1);
}

const count = direction === 'down'
  ? (parseInt(process.argv[3], 10) || 1)
  : Infinity;

runner({
  databaseUrl:     process.env.DATABASE_URL,
  migrationsTable: 'pgmigrations',      // table that tracks applied migrations
  dir:             path.join(__dirname, 'migrations'),
  direction,
  count,
  verbose:         true,
})
  .then(() => {
    console.log(`\n✅  Migration ${direction} complete.`);
    process.exit(0);
  })
  .catch(err => {
    console.error(`\n❌  Migration failed: ${err.message}`);
    process.exit(1);
  });
