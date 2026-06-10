require('dotenv').config();
const { Pool } = require('pg');
const logger   = require('./utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  logger.error(err, 'Unexpected database error');
});

module.exports = pool;
