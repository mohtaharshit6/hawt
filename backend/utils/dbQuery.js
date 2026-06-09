'use strict';

const pool = require('../db');

const q = (client, text, params) => (client || pool).query(text, params);

module.exports = { q };
