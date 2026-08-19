const express = require("express")
const router = express.Router()

const { razorpayWebhook } = require("../controllers/paymentController")

// ═══════════════════════════════════════════════════════════════════
//  RAZORPAY WEBHOOK
//
//  Why this route needs its own file and its own body parser:
//
//  Signature verification runs an HMAC over the EXACT bytes Razorpay
//  sent. express.json() parses and discards the raw body, and
//  re-serialising the parsed object produces different bytes (key order,
//  whitespace, unicode escaping), so every signature check would fail.
//  express.raw() hands the controller a Buffer instead.
//
//  This route must be registered in server.js BEFORE app.use(express.json()),
//  or the global JSON parser will consume the body first.
//
//  Configure in the Razorpay dashboard:
//    URL     https://your-domain.com/api/webhooks/razorpay
//    Events  payment.captured, payment.failed, refund.processed
//    Secret  set the same value as RAZORPAY_WEBHOOK_SECRET in .env
//
//  No `protect` middleware: Razorpay is not a signed-in user. The
//  signature IS the authentication, which is why it must be verified
//  before the payload is trusted.
// ═══════════════════════════════════════════════════════════════════
router.post(
  "/razorpay",
  express.raw({ type: "application/json" }),
  razorpayWebhook
)

module.exports = router
