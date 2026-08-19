const express = require("express")
const router = express.Router()
const {
  validateCoupon, createOrder, verifyPayment,
  getPaymentStatus, getMyPayments, getAllPayments,
  grantFreeAccess, createCoupon, getCoupons, toggleCoupon,
  refundPayment
} = require("../controllers/paymentController")
const { protect, adminOnly } = require("../middleware/authMiddleware")

// Student routes
router.post("/validate-coupon", protect, validateCoupon)
router.post("/create-order", protect, createOrder)
router.post("/verify", protect, verifyPayment)
router.get("/status", protect, getPaymentStatus)
router.get("/my", protect, getMyPayments)

// Admin routes
router.get("/all", protect, adminOnly, getAllPayments)
router.post("/grant-access", protect, adminOnly, grantFreeAccess)
router.post("/coupons", protect, adminOnly, createCoupon)
router.get("/coupons", protect, adminOnly, getCoupons)
router.patch("/coupons/:id", protect, adminOnly, toggleCoupon)

// Refund. Withdraws exam access and, depending on the reason given,
// may reverse the referring employee's commission. Admin only —
// this moves money and touches somebody's earnings.
router.post("/refund", protect, adminOnly, refundPayment)

// NOTE: the Razorpay webhook is NOT registered here. It needs express.raw()
// rather than express.json() for signature verification, so it lives in
// routes/webhookRoutes.js and is mounted at /api/webhooks in server.js.

module.exports = router
