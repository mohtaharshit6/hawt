'use strict';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUUID(req, res, next) {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'invalid id format' });
  }
  next();
}

module.exports = { validateUUID };
