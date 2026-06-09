'use strict';

const router      = require('express').Router();
const requireAuth = require('../middleware/auth');
const ctrl        = require('../controllers/checkoutController');

// All checkout routes require a logged-in user
router.use(requireAuth);

// POST /api/checkout               — initiate checkout, returns gateway payload
router.post('/',                  ctrl.initCheckout);

// POST /api/checkout/verify-payment — verify Razorpay signature + finalize order
router.post('/verify-payment',    ctrl.verifyPayment);

// POST /api/checkout/validate-coupon — preview discount without committing
router.post('/validate-coupon',   ctrl.validateCoupon);

// GET  /api/checkout/orders        — user's order history
router.get ('/orders',            ctrl.listOrders);

// GET  /api/checkout/orders/:id    — single order detail (ownership verified)
router.get ('/orders/:orderId',   ctrl.getOrder);

module.exports = router;
