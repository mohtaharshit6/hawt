'use strict';

const router      = require('express').Router();
const requireAuth = require('../middleware/auth');
const ctrl        = require('../controllers/wishlistController');

// ── Wishlist routes ───────────────────────────────────────────────────────────
// All require a logged-in user — the wishlist is tied to a user account so it
// follows them across devices. Guests are prompted to sign in by the frontend.

router.get   ('/',            requireAuth, ctrl.getWishlist);
router.post  ('/',            requireAuth, ctrl.addItem);
router.delete('/:productId',  requireAuth, ctrl.removeItem);

module.exports = router;
