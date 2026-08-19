const { PrismaClient } = require("@prisma/client")
const Razorpay = require("razorpay")
const crypto = require("crypto")
const prisma = new PrismaClient()
const {
  attributeCommission,
  reverseCommission,
  resolveReferralCode,
  linkStudentToEmployee,
} = require("./employeeController")
const { sendEmail } = require("../utils/emailService")
const { refundEmailTemplate } = require("../utils/emailTemplates")

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

const BASE_PRICE = 299  // ₹299 base price for exam registration

// ═══════════════════════════════════════════════════════════════════
//  CODE RESOLUTION
//  One input field accepts two kinds of code:
//    • a Coupon  — a marketing discount from the Coupon table
//    • a referral code — an employee's code, which also discounts
//  Coupons are checked first. Referral codes never overlap with coupon
//  codes because generateReferralCode checks both tables.
// ═══════════════════════════════════════════════════════════════════
const resolveCode = async (rawCode, userId) => {
  if (!rawCode) return null
  const code = rawCode.toUpperCase().trim()

  // ── 1. Coupon ──
  const coupon = await prisma.coupon.findUnique({ where: { code } })
  if (coupon) {
    if (!coupon.isActive) {
      return { error: "This coupon code is no longer active" }
    }
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return { error: "Coupon usage limit has been reached" }
    }
    if (coupon.discount >= BASE_PRICE) {
      return { error: "This coupon is misconfigured — please contact support" }
    }
    return {
      kind: "COUPON",
      code,
      discount: coupon.discount,
      label: "Coupon applied",
    }
  }

  // ── 2. Employee referral code ──
  const referral = await resolveReferralCode(code)
  if (referral) {
    if (userId && referral.employeeId === userId) {
      return { error: "You cannot use your own referral code" }
    }
    return {
      kind: "REFERRAL",
      code: referral.code,
      discount: referral.discount,
      employeeId: referral.employeeId,
      employeeName: referral.employeeName,
      label: `Referral code from ${referral.employeeName}`,
    }
  }

  return { error: "That code is not recognised" }
}

// ── POST /api/payments/validate-coupon ──────────────────────────────────────
// Accepts a coupon code OR an employee referral code.
const validateCoupon = async (req, res) => {
  try {
    const { code } = req.body
    if (!code) {
      return res.status(400).json({ message: "Enter a coupon or referral code" })
    }

    const resolved = await resolveCode(code, req.user?.id)

    if (!resolved || resolved.error) {
      return res.status(404).json({
        valid: false,
        message: resolved?.error || "That code is not recognised",
      })
    }

    // Has this user already used this code on a completed payment?
    if (req.user?.id) {
      const alreadyUsed = await prisma.payment.findFirst({
        where: { userId: req.user.id, couponCode: resolved.code, status: "PAID" },
      })
      if (alreadyUsed) {
        return res.status(400).json({
          valid: false,
          message: "You have already used this code",
        })
      }
    }

    const finalAmount = BASE_PRICE - resolved.discount

    res.status(200).json({
      valid: true,
      kind: resolved.kind,
      code: resolved.code,
      discount: resolved.discount,
      finalAmount,
      referredByName: resolved.employeeName || null,
      message: resolved.kind === "REFERRAL"
        ? `${resolved.label} — you save ₹${resolved.discount}`
        : `Coupon applied! You save ₹${resolved.discount}`,
    })
  } catch (error) {
    console.error("validateCoupon error:", error)
    res.status(500).json({ message: "Failed to validate code" })
  }
}

// ── POST /api/payments/create-order ─────────────────────────────────────────
const createOrder = async (req, res) => {
  try {
    const userId = req.user.id
    const { couponCode } = req.body

    // Check if already has paid access
    const existingPaid = await prisma.payment.findFirst({
      where: { userId, status: "PAID" }
    })
    if (existingPaid) {
      return res.status(400).json({ message: "You have already paid for exam access" })
    }

    // Check for existing pending payment (prevent duplicate orders)
    const existingPending = await prisma.payment.findFirst({
      where: { userId, status: "PENDING" }
    })
    if (existingPending) {
      return res.status(400).json({ 
        message: "You already have a pending payment. Please complete or cancel it first." 
      })
    }

    let amount = BASE_PRICE
    let discount = 0
    let appliedCode = null
    let resolved = null

    if (couponCode) {
      resolved = await resolveCode(couponCode, userId)

      if (!resolved || resolved.error) {
        return res.status(400).json({ message: resolved?.error || "That code is not recognised" })
      }

      const alreadyUsed = await prisma.payment.findFirst({
        where: { userId, couponCode: resolved.code, status: "PAID" },
      })
      if (alreadyUsed) {
        return res.status(400).json({ message: "You have already used this code" })
      }

      discount = resolved.discount
      amount = BASE_PRICE - discount
      appliedCode = resolved.code

      // A referral code entered at checkout also attributes the student,
      // if nobody claimed them at signup. First referrer keeps the credit.
      if (resolved.kind === "REFERRAL") {
        await linkStudentToEmployee(userId, resolved.employeeId)
      }
    }

    // Validate calculated amount
    if (amount <= 0) {
      return res.status(400).json({ message: "Invalid discount amount" })
    }

    // Create Razorpay order (amount in paise)
    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `receipt_${userId}_${Date.now()}`,
      notes: {
        userId,
        couponCode: appliedCode || "NONE",
        codeKind: resolved?.kind || "NONE",
        discount: discount.toString()
      }
    })

    // Save pending payment in DB
    await prisma.payment.create({
      data: {
        userId,
        amount,
        currency: "INR",
        status: "PENDING",
        gateway: "razorpay",
        couponCode: appliedCode,
        discount,
        razorpayOrderId: order.id
      }
    })

    res.status(200).json({
      orderId: order.id,
      amount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      discount,
      finalAmount: amount,
      codeKind: resolved?.kind || null,
      couponApplied: discount > 0
    })
  } catch (error) {
    console.error("createOrder error:", error)
    res.status(500).json({ message: "Failed to create payment order" })
  }
}

// ── POST /api/payments/verify ────────────────────────────────────────────────
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
    const userId = req.user.id

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment verification details" })
    }

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex")

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed — invalid signature" })
    }

    const payment = await prisma.payment.findFirst({
      where: { userId, razorpayOrderId: razorpay_order_id, status: "PENDING" }
    })

    if (!payment) {
      return res.status(404).json({ message: "Payment record not found" })
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "PAID", transactionId: razorpay_payment_id }
    })

    // Increment coupon usage — only for real coupons. A referral code lives
    // on User, not Coupon, so this update would throw for one.
    if (payment.couponCode) {
      const isCoupon = await prisma.coupon.findUnique({
        where: { code: payment.couponCode },
      })
      if (isCoupon) {
        await prisma.coupon.update({
          where: { code: payment.couponCode },
          data: { usedCount: { increment: 1 } }
        })
      }
    }

    // ── Credit the referring employee, if any ──
    // Safe to call twice: Commission.paymentId is unique. Wrapped so a
    // commission failure can never fail the student's payment.
    try {
      await attributeCommission(payment.id)
    } catch (commissionError) {
      console.error("attributeCommission failed for payment", payment.id, commissionError)
    }

    res.status(200).json({ 
      message: "Payment verified successfully", 
      payment: updated 
    })
  } catch (error) {
    console.error("verifyPayment error:", error)
    res.status(500).json({ message: "Payment verification failed" })
  }
}

// ── GET /api/payments/status ─────────────────────────────────────────────────
const getPaymentStatus = async (req, res) => {
  try {
    const payment = await prisma.payment.findFirst({
      where: { userId: req.user.id, status: "PAID" }
    })

    res.status(200).json({ 
      isPaid: !!payment, 
      payment: payment || null,
      message: payment ? "Student has exam access" : "No active payment found"
    })
  } catch (error) {
    console.error("getPaymentStatus error:", error)
    res.status(500).json({ message: "Failed to fetch payment status" })
  }
}

// ── GET /api/payments/my ─────────────────────────────────────────────────────
const getMyPayments = async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        discount: true,
        status: true,
        gateway: true,
        couponCode: true,
        transactionId: true,
        isFreeAccess: true,
        createdAt: true
      }
    })

    res.status(200).json({ count: payments.length, payments })
  } catch (error) {
    console.error("getMyPayments error:", error)
    res.status(500).json({ message: "Failed to fetch payments" })
  }
}

// ── GET /api/payments/all — admin ────────────────────────────────────────────
const getAllPayments = async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      include: { 
        user: { 
          select: { 
            id: true,
            name: true, 
            email: true,
            whatsappNumber: true,
            referredBy: { select: { name: true, employeeCode: true } }
          } 
        } 
      },
      orderBy: { createdAt: "desc" }
    })

    res.status(200).json({ count: payments.length, payments })
  } catch (error) {
    console.error("getAllPayments error:", error)
    res.status(500).json({ message: "Failed to fetch payments" })
  }
}

// ── POST /api/payments/grant-access — admin grants free access ───────────────
// No commission is credited here: free access generates no revenue.
const grantFreeAccess = async (req, res) => {
  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ message: "userId is required" })
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      return res.status(400).json({ message: "Invalid userId format" })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return res.status(404).json({ message: "Student not found" })
    }

    const existingPaid = await prisma.payment.findFirst({
      where: { userId, status: "PAID" }
    })
    if (existingPaid) {
      return res.status(400).json({ message: "Student already has exam access" })
    }

    const payment = await prisma.payment.create({
      data: {
        userId,
        amount: 0,
        currency: "INR",
        status: "PAID",
        gateway: "free",
        isFreeAccess: true,
        transactionId: `FREE_${userId}_${Date.now()}`
      }
    })

    res.status(201).json({ 
      message: `Free exam access granted to ${user.name}`,
      payment 
    })
  } catch (error) {
    console.error("grantFreeAccess error:", error)
    res.status(500).json({ message: "Failed to grant free access" })
  }
}

// ── POST /api/payments/coupons — admin creates coupon ────────────────────────
const createCoupon = async (req, res) => {
  try {
    const { code, discount, maxUses } = req.body

    if (!code || discount === undefined || discount === null) {
      return res.status(400).json({ message: "Code and discount are required" })
    }

    const upper = code.toUpperCase()
    const discountNum = parseInt(discount)

    if (!/^[A-Z0-9]{3,20}$/.test(upper)) {
      return res.status(400).json({ message: "Coupon code must be 3-20 alphanumeric characters" })
    }

    // A coupon must not collide with an employee referral code, since both
    // are accepted in the same field at checkout.
    const referralClash = await prisma.user.findFirst({
      where: { referralCode: upper },
      select: { name: true, employeeCode: true },
    })
    if (referralClash) {
      return res.status(409).json({
        message: `That code is already the referral code of ${referralClash.name} (${referralClash.employeeCode})`,
      })
    }

    if (isNaN(discountNum) || discountNum <= 0) {
      return res.status(400).json({ message: "Discount must be a positive number" })
    }

    if (discountNum >= BASE_PRICE) {
      return res.status(400).json({ 
        message: `Discount must be less than base price (₹${BASE_PRICE})` 
      })
    }

    if (maxUses) {
      const maxUsesNum = parseInt(maxUses)
      if (isNaN(maxUsesNum) || maxUsesNum <= 0) {
        return res.status(400).json({ message: "Max uses must be a positive number" })
      }
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: upper,
        discount: discountNum,
        maxUses: maxUses ? parseInt(maxUses) : null
      }
    })

    const finalPrice = BASE_PRICE - discountNum

    res.status(201).json({ 
      message: "Coupon created successfully",
      coupon,
      savings: `Students will save ₹${discountNum} (final price: ₹${finalPrice})`
    })
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Coupon code already exists" })
    }
    console.error("createCoupon error:", error)
    res.status(500).json({ message: "Failed to create coupon" })
  }
}

// ── GET /api/payments/coupons — admin gets all coupons ───────────────────────
// Returns marketing coupons and employee referral codes together, since both
// work in the same field at checkout and the office needs one view of them.
const getCoupons = async (req, res) => {
  try {
    const { REFERRAL_DISCOUNT } = require("./employeeController")

    const [coupons, employees] = await Promise.all([
      prisma.coupon.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true, code: true, discount: true, isActive: true,
          usedCount: true, maxUses: true, createdAt: true
        }
      }),
      prisma.user.findMany({
        where: { role: "EMPLOYEE", referralCode: { not: null } },
        orderBy: { employeeCode: "asc" },
        select: {
          id: true, name: true, employeeCode: true,
          referralCode: true, isActive: true, createdAt: true
        }
      }),
    ])

    const referralCodes = await Promise.all(
      employees.map(async (e) => ({
        id: e.id,
        code: e.referralCode,
        discount: REFERRAL_DISCOUNT,
        isActive: e.isActive,
        usedCount: await prisma.payment.count({
          where: { couponCode: e.referralCode, status: "PAID" },
        }),
        maxUses: null,
        createdAt: e.createdAt,
        employeeName: e.name,
        employeeCode: e.employeeCode,
      }))
    )

    res.status(200).json({ 
      count: coupons.length,
      coupons,
      referralCodes,
      referralDiscount: REFERRAL_DISCOUNT,
      basePrice: BASE_PRICE
    })
  } catch (error) {
    console.error("getCoupons error:", error)
    res.status(500).json({ message: "Failed to fetch coupons" })
  }
}

// ── PATCH /api/payments/coupons/:id — admin toggles coupon ───────────────────
const toggleCoupon = async (req, res) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({ message: "Coupon ID is required" })
    }

    const coupon = await prisma.coupon.findUnique({ where: { id } })
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" })
    }

    const updated = await prisma.coupon.update({
      where: { id },
      data: { isActive: !coupon.isActive }
    })

    const action = updated.isActive ? "activated" : "deactivated"
    res.status(200).json({ 
      message: `Coupon ${action} successfully`,
      coupon: updated 
    })
  } catch (error) {
    console.error("toggleCoupon error:", error)
    res.status(500).json({ message: "Failed to update coupon" })
  }
}


// ═══════════════════════════════════════════════════════════════════
//  POST /api/payments/refund — admin refunds a candidate
//
//  Reason decides whether the referring employee keeps their commission:
//
//    COMPANY_FAULT     our error, cancelled exam, technical failure
//    CANDIDATE_REQUEST they changed their mind
//        -> commission STANDS. The agent did their job; a problem at our
//           end is not theirs to pay for.
//
//    AGENT_MISCONDUCT  the agent misled the candidate or caused the fault
//        -> commission REVERSED.
//
//  The exam attempt is never deleted. It is the evidence of whatever went
//  wrong, and the office decides separately whether to reschedule.
//  Access is withdrawn; grant free access to restore it.
// ═══════════════════════════════════════════════════════════════════
const REFUND_REASONS = {
  COMPANY_FAULT: { label: "Company fault", reverseCommission: false },
  CANDIDATE_REQUEST: { label: "Candidate request", reverseCommission: false },
  AGENT_MISCONDUCT: { label: "Agent misconduct", reverseCommission: true },
}

const refundPayment = async (req, res) => {
  try {
    const { paymentId, reason, note } = req.body

    if (!paymentId) {
      return res.status(400).json({ message: "paymentId is required" })
    }
    if (!reason || !REFUND_REASONS[reason]) {
      return res.status(400).json({
        message: `reason must be one of: ${Object.keys(REFUND_REASONS).join(", ")}`,
      })
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        user: {
          select: {
            id: true, name: true, email: true,
            referredBy: { select: { id: true, name: true, employeeCode: true } },
          },
        },
      },
    })

    if (!payment) return res.status(404).json({ message: "Payment not found" })
    if (payment.status === "REFUNDED") {
      return res.status(400).json({ message: "This payment has already been refunded" })
    }
    if (payment.status !== "PAID") {
      return res.status(400).json({
        message: `Only a PAID payment can be refunded. This one is ${payment.status}.`,
      })
    }
    if (payment.isFreeAccess || payment.amount <= 0) {
      return res.status(400).json({ message: "There is nothing to refund on a free-access grant" })
    }

    const rule = REFUND_REASONS[reason]

    // Marking the payment REFUNDED is what withdraws access: startAttempt
    // and getPaymentStatus both look for status PAID.
    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "REFUNDED",
        couponCode: payment.couponCode,
        gateway: payment.gateway,
      },
    })

    // Commission only reverses on agent misconduct.
    let commissionReversed = false
    if (rule.reverseCommission) {
      try {
        const result = await reverseCommission(paymentId)
        commissionReversed = !!result?.reversed
      } catch (err) {
        console.error("reverseCommission failed during refund:", err)
      }
    }

    // Any in-progress attempt is abandoned, since access has gone. Submitted
    // attempts and their results are left untouched.
    const abandoned = await prisma.examAttempt.deleteMany({
      where: { userId: payment.userId, isSubmitted: false },
    })

    try {
      if (payment.user?.email) {
        sendEmail({
          to: payment.user.email,
          subject: "TalentExam — refund processed",
          html: refundEmailTemplate({
            name: payment.user.name,
            examTitle: "TalentExam registration",
            amount: payment.amount,
            reason: rule.label,
            transactionId: payment.transactionId,
          }),
        }).catch((err) => console.error("Refund email error:", err))
      }
    } catch (emailError) {
      console.error("Refund email error:", emailError)
    }

    res.status(200).json({
      message: `Rs. ${payment.amount} refunded to ${payment.user?.name}. Examination access has been withdrawn.`,
      payment: updated,
      reason: rule.label,
      note: note || null,
      commissionReversed,
      referringEmployee: payment.user?.referredBy || null,
      commissionNote: payment.user?.referredBy
        ? (commissionReversed
            ? `Commission reversed for ${payment.user.referredBy.name}.`
            : `Commission retained by ${payment.user.referredBy.name} — the refund was not their fault.`)
        : null,
      abandonedAttempts: abandoned.count,
      accessNote: "To reschedule this candidate, grant free access from the Students tab. They do not need to register again.",
    })
  } catch (error) {
    console.error("refundPayment error:", error)
    res.status(500).json({ message: "Could not process the refund" })
  }
}

// ═══════════════════════════════════════════════════════════════════
//  POST /api/webhooks/razorpay — Razorpay server-to-server callback
//
//  Why this exists: verifyPayment only runs if the student's browser calls
//  it. Close the tab, lose signal, or hit a crash after paying, and the
//  money is taken while the payment stays PENDING — no exam access, and no
//  commission for the agent. Razorpay calls this endpoint regardless.
//
//  req.body is a Buffer here, not a parsed object. express.raw() is used on
//  this route because the signature is an HMAC over the exact bytes sent;
//  re-serialising a parsed object produces different bytes and every check
//  would fail.
// ═══════════════════════════════════════════════════════════════════
const razorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"]
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET

    if (!secret) {
      console.error("RAZORPAY_WEBHOOK_SECRET is not set — webhook rejected")
      return res.status(500).json({ message: "Webhook not configured" })
    }
    if (!signature) {
      return res.status(400).json({ message: "Missing signature" })
    }

    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body))

    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex")

    // timingSafeEqual to avoid leaking the secret through response timing.
    const a = Buffer.from(expected, "utf8")
    const b = Buffer.from(String(signature), "utf8")
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      console.warn("Razorpay webhook: signature mismatch, ignoring")
      return res.status(400).json({ message: "Invalid signature" })
    }

    const payload = JSON.parse(raw.toString("utf8"))
    const event = payload.event
    const entity = payload.payload?.payment?.entity || payload.payload?.refund?.entity || {}
    const orderId = entity.order_id
    const paymentRef = entity.id

    console.log(`Razorpay webhook: ${event} order=${orderId} payment=${paymentRef}`)

    // Always 200 once the signature is valid. A non-2xx makes Razorpay retry
    // for hours, and a problem on our side is not something they can fix.
    if (!orderId) {
      return res.status(200).json({ received: true, note: "no order id in payload" })
    }

    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId: orderId },
    })

    if (!payment) {
      console.warn(`Webhook: no payment row for order ${orderId}`)
      return res.status(200).json({ received: true, note: "unknown order" })
    }

    if (event === "payment.captured" || event === "order.paid") {
      if (payment.status === "PAID") {
        return res.status(200).json({ received: true, note: "already paid" })
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "PAID", transactionId: paymentRef || payment.transactionId },
      })

      // Coupon usage — only for real coupons; a referral code lives on User.
      if (payment.couponCode) {
        const isCoupon = await prisma.coupon.findUnique({ where: { code: payment.couponCode } })
        if (isCoupon) {
          await prisma.coupon.update({
            where: { code: payment.couponCode },
            data: { usedCount: { increment: 1 } },
          })
        }
      }

      // Safe to call even if verifyPayment already did: Commission.paymentId
      // is unique, so the second call is a no-op.
      try {
        await attributeCommission(payment.id)
      } catch (err) {
        console.error("attributeCommission failed in webhook:", err)
      }

      console.log(`Webhook: payment ${payment.id} marked PAID`)
      return res.status(200).json({ received: true, updated: "PAID" })
    }

    if (event === "payment.failed") {
      if (payment.status === "PENDING") {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED" },
        })
      }
      return res.status(200).json({ received: true, updated: "FAILED" })
    }

    if (event === "refund.processed" || event === "refund.created") {
      if (payment.status === "PAID") {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "REFUNDED" },
        })
        // A refund initiated in the Razorpay dashboard rather than through
        // our own endpoint has no recorded reason, so commission is left
        // alone. Reverse it manually from the admin panel if it was the
        // agent's fault.
        console.log(`Webhook: payment ${payment.id} marked REFUNDED (commission untouched)`)
      }
      return res.status(200).json({ received: true, updated: "REFUNDED" })
    }

    return res.status(200).json({ received: true, note: `unhandled event ${event}` })
  } catch (error) {
    console.error("razorpayWebhook error:", error)
    // Still 200: Razorpay must not retry a payload we cannot parse.
    return res.status(200).json({ received: true, error: "processing failed" })
  }
}

module.exports = {
  validateCoupon, 
  createOrder, 
  verifyPayment,
  getPaymentStatus, 
  getMyPayments, 
  getAllPayments,
  grantFreeAccess, 
  createCoupon, 
  getCoupons, 
  toggleCoupon,
  refundPayment,
  razorpayWebhook,
  REFUND_REASONS
}
