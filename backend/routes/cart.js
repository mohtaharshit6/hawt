'use strict';

const router       = require('express').Router();
const requireAuth  = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const ctrl         = require('../controllers/cartController');

// ── Cart routes ───────────────────────────────────────────────────────────────
//
// optionalAuth: passes req.user if a valid Bearer token is present,
//               otherwise lets the request through as a guest.
//               Guest identity is carried by the X-Session-ID header.
//
// requireAuth:  rejects unauthenticated requests (used for merge only,
//               because a merge requires a known user account to merge into).

router.get   ('/',                  optionalAuth, ctrl.getCart);
router.post  ('/items',             optionalAuth, ctrl.addItem);
router.put   ('/items/:variantId',  optionalAuth, ctrl.updateItem);
router.delete('/items/:variantId',  optionalAuth, ctrl.removeItem);
router.post  ('/merge',             requireAuth,  ctrl.mergeCart);

module.exports = router;
