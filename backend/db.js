require('dotenv').config();
const { Pool } = require('pg');
const logger   = require('./utils/logger');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('error', (err) => {
  logger.error(err, 'Unexpected database error');
});

module.exports = pool;
