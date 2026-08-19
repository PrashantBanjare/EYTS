const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcrypt")
const prisma = new PrismaClient()

// ── Business rules ───────────────────────────────────────────────
const RATE_PER_ENROLLMENT = 30      // ₹ per qualifying (paid) enrollment
const TASK_TARGET = 1000            // default paid enrollments per task
const TASK_BONUS = 5000             // ₹ salary on completing one task
const REFERRAL_DISCOUNT = 50        // ₹ off the fee when a student uses a referral code
const MISS_PENALTY_PERCENT = 20     // % of commission deducted if the deadline is missed

// ── Helpers ──────────────────────────────────────────────────────

// Monday 00:00 → Sunday 23:59:59.999 for the week containing `date`
const getWeekBounds = (date = new Date()) => {
  const d = new Date(date)
  const day = d.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const start = new Date(d)
  start.setDate(d.getDate() + diffToMonday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

// Readable code: first four letters of the name + a two-digit sequence.
// "Prashant Banjare" → PRAS01, a second Prashant → PRAS02.
// Checked against User.referralCode AND Coupon.code, because a referral code
// doubles as a discount code at checkout and the namespaces must not collide.
const generateReferralCode = async (name) => {
  const letters = (name || "").replace(/[^a-zA-Z]/g, "").toUpperCase()
  const base = (letters.slice(0, 4) || "EYTS").padEnd(4, "X")

  for (let n = 1; n <= 99; n++) {
    const code = `${base}${String(n).padStart(2, "0")}`
    const [employeeClash, couponClash] = await Promise.all([
      prisma.user.findUnique({ where: { referralCode: code } }),
      prisma.coupon.findUnique({ where: { code } }),
    ])
    if (!employeeClash && !couponClash) return code
  }

  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  for (let attempt = 0; attempt < 20; attempt++) {
    let suffix = ""
    for (let i = 0; i < 4; i++) {
      suffix += alphabet[Math.floor(Math.random() * alphabet.length)]
    }
    const code = `${base.slice(0, 2)}${suffix}`
    const [e, c] = await Promise.all([
      prisma.user.findUnique({ where: { referralCode: code } }),
      prisma.coupon.findUnique({ where: { code } }),
    ])
    if (!e && !c) return code
  }
  throw new Error("Could not generate a unique referral code")
}

const nextEmployeeCode = async () => {
  const last = await prisma.user.findFirst({
    where: { employeeCode: { not: null } },
    orderBy: { employeeCode: "desc" },
    select: { employeeCode: true },
  })
  const n = last?.employeeCode ? parseInt(last.employeeCode.replace(/\D/g, ""), 10) : 0
  return `EMP${String(n + 1).padStart(3, "0")}`
}

const notify = async (userId, { title, body, type, link = null }) => {
  try {
    await prisma.notification.create({ data: { userId, title, body, type, link } })
  } catch (err) {
    console.error("notify error:", err)
  }
}

// ═════════════════════════════════════════════════════════════════
//  TASK STATE
//  One task = `taskTarget` paid enrollments inside the window the
//  office sets. Progress counts only commissions earned in-window.
// ═════════════════════════════════════════════════════════════════
const getTaskState = async (employee) => {
  const target = employee.taskTarget || TASK_TARGET
  const start = employee.taskStartAt
  const deadline = employee.taskDeadline
  const now = new Date()

  const windowFilter = {}
  if (start) windowFilter.gte = start
  if (deadline) windowFilter.lte = deadline

  const inWindow = await prisma.commission.count({
    where: {
      employeeId: employee.id,
      type: "ENROLLMENT",
      status: { not: "REVERSED" },
      ...(start || deadline ? { earnedAt: windowFilter } : {}),
    },
  })

  const complete = inWindow >= target
  const expired = !!deadline && now > new Date(deadline) && !complete

  let daysLeft = null
  if (deadline && !complete) {
    daysLeft = Math.ceil((new Date(deadline) - now) / (1000 * 60 * 60 * 24))
  }

  const penalty = await prisma.commission.findFirst({
    where: { employeeId: employee.id, type: "TASK_PENALTY" },
    orderBy: { earnedAt: "desc" },
  })

  return {
    target,
    progress: inWindow,
    remaining: Math.max(target - inWindow, 0),
    percent: target > 0 ? Math.min(Math.round((inWindow / target) * 100), 100) : 0,
    startAt: start,
    deadline,
    daysLeft,
    isSet: !!deadline,
    complete,
    expired,
    penaltyPercent: MISS_PENALTY_PERCENT,
    penaltyApplied: penalty ? Math.abs(penalty.amount) : 0,
    bonus: TASK_BONUS,
    description: `Enroll ${target} students with completed payment${
      deadline ? ` by ${new Date(deadline).toLocaleDateString("en-IN")}` : ""
    }`,
  }
}

// Deduct MISS_PENALTY_PERCENT of in-window commission when a deadline
// passes with the target unmet. Stored as a NEGATIVE commission so every
// existing sum and payout total absorbs it with no special-case code.
// Idempotent: one penalty per employee per deadline.
const applyMissedTaskPenalty = async (employeeId) => {
  try {
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: {
        id: true, name: true, role: true,
        taskStartAt: true, taskDeadline: true, taskTarget: true,
      },
    })
    if (!employee || employee.role !== "EMPLOYEE") return { applied: false }
    if (!employee.taskDeadline) return { applied: false, reason: "no deadline set" }

    const state = await getTaskState(employee)
    if (!state.expired) return { applied: false, reason: "not expired or target met" }

    // Already penalised for this deadline?
    const existing = await prisma.commission.findFirst({
      where: {
        employeeId,
        type: "TASK_PENALTY",
        note: { contains: new Date(employee.taskDeadline).toISOString() },
      },
    })
    if (existing) return { applied: false, reason: "already penalised" }

    const windowFilter = {}
    if (employee.taskStartAt) windowFilter.gte = employee.taskStartAt
    windowFilter.lte = employee.taskDeadline

    const earned = await prisma.commission.aggregate({
      where: {
        employeeId,
        type: "ENROLLMENT",
        status: { not: "REVERSED" },
        earnedAt: windowFilter,
      },
      _sum: { amount: true },
    })

    const base = earned._sum.amount || 0
    if (base <= 0) return { applied: false, reason: "nothing earned in window" }

    const penalty = Math.round((base * MISS_PENALTY_PERCENT) / 100)

    await prisma.commission.create({
      data: {
        employeeId,
        type: "TASK_PENALTY",
        amount: -penalty,
        status: "PENDING",
        note: `Task target missed (${state.progress}/${state.target}) — ${MISS_PENALTY_PERCENT}% of ₹${base} deducted. Deadline ${new Date(employee.taskDeadline).toISOString()}`,
      },
    })

    await notify(employeeId, {
      title: "Task deadline missed",
      body: `You reached ${state.progress} of ${state.target} paid enrollments by the deadline, so ₹${penalty} (${MISS_PENALTY_PERCENT}% of your commission) has been deducted.`,
      type: "MILESTONE",
      link: "/employee?tab=earnings",
    })

    return { applied: true, penalty }
  } catch (err) {
    console.error("applyMissedTaskPenalty error:", err)
    return { applied: false }
  }
}

// ═════════════════════════════════════════════════════════════════
//  REFERRAL CODE RESOLUTION (used by paymentController)
// ═════════════════════════════════════════════════════════════════
const resolveReferralCode = async (code) => {
  if (!code) return null
  const employee = await prisma.user.findFirst({
    where: { referralCode: code.toUpperCase(), role: "EMPLOYEE", isActive: true },
    select: { id: true, name: true, referralCode: true, employeeCode: true },
  })
  if (!employee) return null
  return {
    employeeId: employee.id,
    employeeName: employee.name,
    employeeCode: employee.employeeCode,
    code: employee.referralCode,
    discount: REFERRAL_DISCOUNT,
  }
}

// Attach a student to an employee at payment time if nobody claimed them
// at signup. Never overwrites an existing referrer.
const linkStudentToEmployee = async (studentId, employeeId) => {
  try {
    if (studentId === employeeId) return false
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, referredById: true },
    })
    if (!student || student.referredById) return false
    await prisma.user.update({
      where: { id: studentId },
      data: { referredById: employeeId },
    })
    return true
  } catch (err) {
    console.error("linkStudentToEmployee error:", err)
    return false
  }
}

// ═════════════════════════════════════════════════════════════════
//  COMMISSION ATTRIBUTION — called from paymentController
// ═════════════════════════════════════════════════════════════════
const attributeCommission = async (paymentId) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: { select: { id: true, name: true, referredById: true } } },
    })

    if (!payment) return { credited: false, reason: "payment not found" }
    if (payment.status !== "PAID") return { credited: false, reason: "payment not PAID" }
    if (payment.isFreeAccess || payment.amount <= 0) {
      return { credited: false, reason: "free access" }
    }

    const employeeId = payment.user?.referredById
    if (!employeeId) return { credited: false, reason: "no referring employee" }

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: {
        id: true, role: true, name: true,
        taskStartAt: true, taskDeadline: true, taskTarget: true,
      },
    })
    if (!employee || employee.role !== "EMPLOYEE") {
      return { credited: false, reason: "referrer is not an employee" }
    }

    const already = await prisma.commission.findUnique({ where: { paymentId } })
    if (already) return { credited: false, reason: "already credited" }

    await prisma.commission.create({
      data: {
        employeeId,
        studentId: payment.userId,
        paymentId,
        type: "ENROLLMENT",
        amount: RATE_PER_ENROLLMENT,
        status: "PENDING",
      },
    })

    await notify(employeeId, {
      title: "Enrollment confirmed",
      body: `${payment.user.name} completed payment. ₹${RATE_PER_ENROLLMENT} added to this week's earnings.`,
      type: "ENROLLMENT",
      link: "/employee?tab=enrollments",
    })

    // ── Task completion check, inside the office-set window ──
    const state = await getTaskState(employee)
    if (state.complete) {
      const bonusForThisTask = await prisma.commission.findFirst({
        where: {
          employeeId,
          type: "TASK_BONUS",
          ...(employee.taskDeadline
            ? { note: { contains: new Date(employee.taskDeadline).toISOString() } }
            : {}),
        },
      })

      if (!bonusForThisTask) {
        await prisma.commission.create({
          data: {
            employeeId,
            type: "TASK_BONUS",
            amount: TASK_BONUS,
            status: "PENDING",
            note: `Task complete — ${state.target} paid enrollments${
              employee.taskDeadline
                ? `. Deadline ${new Date(employee.taskDeadline).toISOString()}`
                : ""
            }`,
          },
        })

        await notify(employeeId, {
          title: "Task complete",
          body: `You reached ${state.target} paid enrollments. ₹${TASK_BONUS} task salary added to your earnings.`,
          type: "MILESTONE",
          link: "/employee?tab=earnings",
        })
      }
    }

    return { credited: true, amount: RATE_PER_ENROLLMENT }
  } catch (err) {
    console.error("attributeCommission error:", err)
    return { credited: false, reason: "error" }
  }
}

const reverseCommission = async (paymentId) => {
  try {
    const commission = await prisma.commission.findUnique({ where: { paymentId } })
    if (!commission || commission.status === "REVERSED") return { reversed: false }

    await prisma.commission.update({
      where: { id: commission.id },
      data: { status: "REVERSED", note: "Student payment refunded" },
    })

    await notify(commission.employeeId, {
      title: "Commission reversed",
      body: `A student payment was refunded, so ₹${commission.amount} has been deducted from your earnings.`,
      type: "PAYOUT",
      link: "/employee?tab=earnings",
    })

    return { reversed: true }
  } catch (err) {
    console.error("reverseCommission error:", err)
    return { reversed: false }
  }
}

// ═════════════════════════════════════════════════════════════════
//  EMPLOYEE — GET /api/employees/me/summary
// ═════════════════════════════════════════════════════════════════
const getMySummary = async (req, res) => {
  try {
    const employeeId = req.user.id
    const { start, end } = getWeekBounds()

    const me = await prisma.user.findUnique({
      where: { id: employeeId },
      select: {
        id: true, name: true, email: true, whatsappNumber: true,
        employeeCode: true, referralCode: true, isActive: true,
        photoUrl: true, createdAt: true, address: true,
        taskStartAt: true, taskDeadline: true, taskTarget: true,
        bankAccountName: true, bankAccountNumber: true, bankIfsc: true,
        upiId: true, panNumber: true,
        emergencyContactName: true, emergencyContactPhone: true,
      },
    })
    if (!me) return res.status(404).json({ message: "Employee not found" })

    const task = await getTaskState(me)

    const [totalReferred, qualified, bonusCount, weekCommissions, pendingAgg, lastPayout] =
      await Promise.all([
        prisma.user.count({ where: { referredById: employeeId } }),
        prisma.commission.count({
          where: { employeeId, type: "ENROLLMENT", status: { not: "REVERSED" } },
        }),
        prisma.commission.count({
          where: { employeeId, type: "TASK_BONUS", status: { not: "REVERSED" } },
        }),
        prisma.commission.findMany({
          where: {
            employeeId,
            status: { not: "REVERSED" },
            earnedAt: { gte: start, lte: end },
          },
          select: { type: true, amount: true },
        }),
        prisma.commission.aggregate({
          where: { employeeId, status: "PENDING" },
          _sum: { amount: true },
        }),
        prisma.payout.findFirst({
          where: { employeeId, status: "PAID" },
          orderBy: { paidAt: "desc" },
        }),
      ])

    const lifetimeEarned = await prisma.commission.aggregate({
      where: { employeeId, status: { not: "REVERSED" } },
      _sum: { amount: true },
    })

    const paidOut = await prisma.payout.aggregate({
      where: { employeeId, status: "PAID" },
      _sum: { totalAmount: true },
    })

    const weekEnrollments = weekCommissions.filter((c) => c.type === "ENROLLMENT").length
    const weekBonus = weekCommissions
      .filter((c) => c.type === "TASK_BONUS")
      .reduce((s, c) => s + c.amount, 0)
    const weekPenalty = weekCommissions
      .filter((c) => c.type === "TASK_PENALTY")
      .reduce((s, c) => s + c.amount, 0)     // already negative
    const weekCommissionAmount = weekEnrollments * RATE_PER_ENROLLMENT
    const awaitingPayment = totalReferred - qualified

    res.status(200).json({
      employee: me,
      referralLink: me.referralCode
        ? `${process.env.FRONTEND_URL || "http://localhost:5173"}/signup?ref=${me.referralCode}`
        : null,
      rates: {
        perEnrollment: RATE_PER_ENROLLMENT,
        taskTarget: task.target,
        taskBonus: TASK_BONUS,
        referralDiscount: REFERRAL_DISCOUNT,
        missPenaltyPercent: MISS_PENALTY_PERCENT,
      },
      task,
      thisWeek: {
        periodStart: start,
        periodEnd: end,
        enrollments: weekEnrollments,
        commissionAmount: weekCommissionAmount,
        bonusAmount: weekBonus,
        penaltyAmount: weekPenalty,
        totalAmount: weekCommissionAmount + weekBonus + weekPenalty,
      },
      lifetime: {
        referred: totalReferred,
        qualified,
        awaitingPayment: awaitingPayment > 0 ? awaitingPayment : 0,
        tasksCompleted: bonusCount,
        earned: lifetimeEarned._sum.amount || 0,
        paidOut: paidOut._sum.totalAmount || 0,
      },
      pendingPayable: pendingAgg._sum.amount || 0,
      lastPayout: lastPayout || null,
    })
  } catch (error) {
    console.error("getMySummary error:", error)
    res.status(500).json({ message: "Could not load your dashboard" })
  }
}

// ═════════════════════════════════════════════════════════════════
//  EMPLOYEE — GET /api/employees/me/enrollments
//  Privacy: name + masked contact + payment status only.
// ═════════════════════════════════════════════════════════════════
const getMyEnrollments = async (req, res) => {
  try {
    const employeeId = req.user.id
    const { status } = req.query

    const students = await prisma.user.findMany({
      where: { referredById: employeeId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, email: true, whatsappNumber: true,
        institutionName: true, createdAt: true,
        payments: {
          select: {
            id: true, amount: true, status: true, discount: true,
            couponCode: true, isFreeAccess: true, createdAt: true,
          },
        },
      },
    })

    const commissions = await prisma.commission.findMany({
      where: { employeeId, type: "ENROLLMENT" },
      select: { studentId: true, amount: true, status: true, earnedAt: true },
    })
    const byStudent = {}
    commissions.forEach((c) => {
      if (c.studentId) byStudent[c.studentId] = c
    })

    const maskEmail = (e) => {
      if (!e || !e.includes("@")) return "—"
      const [local, domain] = e.split("@")
      return `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 2))}@${domain}`
    }
    const maskPhone = (p) => (p && p.length === 10 ? `${p.slice(0, 3)}***${p.slice(7)}` : "—")

    let rows = students.map((s) => {
      const paid = s.payments.find((p) => p.status === "PAID" && !p.isFreeAccess)
      const freeAccess = s.payments.find((p) => p.status === "PAID" && p.isFreeAccess)
      const commission = byStudent[s.id] || null
      return {
        studentId: s.id,
        name: s.name,
        email: maskEmail(s.email),
        whatsappNumber: maskPhone(s.whatsappNumber),
        institutionName: s.institutionName || "—",
        registeredAt: s.createdAt,
        hasPaid: !!paid,
        isFreeAccess: !!freeAccess,
        amountPaid: paid?.amount ?? null,
        discountUsed: paid?.discount ?? 0,
        codeUsed: paid?.couponCode ?? null,
        paidAt: paid?.createdAt ?? null,
        commissionAmount: commission?.amount ?? 0,
        commissionStatus: commission?.status ?? null,
        commissionEarnedAt: commission?.earnedAt ?? null,
        qualifies: !!commission && commission.status !== "REVERSED",
      }
    })

    if (status === "paid") rows = rows.filter((r) => r.hasPaid)
    if (status === "pending") rows = rows.filter((r) => !r.hasPaid)

    res.status(200).json({
      count: rows.length,
      qualified: rows.filter((r) => r.qualifies).length,
      awaitingPayment: rows.filter((r) => !r.hasPaid).length,
      totalCollected: rows.reduce((s, r) => s + (r.amountPaid || 0), 0),
      commissionEarned: rows.reduce((s, r) => s + (r.qualifies ? r.commissionAmount : 0), 0),
      enrollments: rows,
    })
  } catch (error) {
    console.error("getMyEnrollments error:", error)
    res.status(500).json({ message: "Could not load your enrollments" })
  }
}

// ═════════════════════════════════════════════════════════════════
//  EMPLOYEE — GET /api/employees/me/earnings
// ═════════════════════════════════════════════════════════════════
const getMyEarnings = async (req, res) => {
  try {
    const employeeId = req.user.id

    const [commissions, payouts] = await Promise.all([
      prisma.commission.findMany({
        where: { employeeId },
        orderBy: { earnedAt: "desc" },
        take: 300,
        select: {
          id: true, type: true, amount: true, status: true,
          note: true, earnedAt: true, payoutId: true, studentId: true,
        },
      }),
      prisma.payout.findMany({
        where: { employeeId },
        orderBy: { periodStart: "desc" },
      }),
    ])

    const pending = commissions
      .filter((c) => c.status === "PENDING")
      .reduce((s, c) => s + c.amount, 0)

    res.status(200).json({ pendingPayable: pending, commissions, payouts })
  } catch (error) {
    console.error("getMyEarnings error:", error)
    res.status(500).json({ message: "Could not load your earnings" })
  }
}

// ═════════════════════════════════════════════════════════════════
//  EMPLOYEE — PATCH /api/employees/me/profile
// ═════════════════════════════════════════════════════════════════
const updateMyProfile = async (req, res) => {
  try {
    const { name, whatsappNumber, address } = req.body

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ message: "Name cannot be empty" })
      if (!/^[a-zA-Z\s.]+$/.test(name.trim())) {
        return res.status(400).json({ message: "Name can contain only letters, spaces and full stops" })
      }
    }
    if (whatsappNumber !== undefined && !/^\d{10}$/.test(whatsappNumber)) {
      return res.status(400).json({ message: "WhatsApp number must be exactly 10 digits" })
    }

    const data = {}
    if (name !== undefined) data.name = name.trim()
    if (whatsappNumber !== undefined) data.whatsappNumber = whatsappNumber
    if (address !== undefined) data.address = address

    const employee = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true, name: true, email: true, whatsappNumber: true,
        address: true, employeeCode: true, referralCode: true,
      },
    })

    res.status(200).json({ message: "Profile updated", employee })
  } catch (error) {
    console.error("updateMyProfile error:", error)
    res.status(500).json({ message: "Could not save your profile" })
  }
}

// ═════════════════════════════════════════════════════════════════
//  EMPLOYEE — PATCH /api/employees/me/kyc
// ═════════════════════════════════════════════════════════════════
const updateMyKyc = async (req, res) => {
  try {
    const {
      panNumber, bankAccountName, bankAccountNumber, bankIfsc, upiId,
      emergencyContactName, emergencyContactPhone,
    } = req.body

    if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber.toUpperCase())) {
      return res.status(400).json({ message: "PAN must look like ABCDE1234F" })
    }
    if (bankAccountNumber && !/^\d{9,18}$/.test(bankAccountNumber)) {
      return res.status(400).json({ message: "Bank account number must be 9–18 digits" })
    }
    if (bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc.toUpperCase())) {
      return res.status(400).json({ message: "IFSC must look like SBIN0001234" })
    }
    if (upiId && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) {
      return res.status(400).json({ message: "UPI ID must look like name@bank" })
    }
    if (emergencyContactPhone && !/^\d{10}$/.test(emergencyContactPhone)) {
      return res.status(400).json({ message: "Emergency contact must be 10 digits" })
    }

    const data = {}
    if (panNumber !== undefined) data.panNumber = panNumber.toUpperCase()
    if (bankAccountName !== undefined) data.bankAccountName = bankAccountName
    if (bankAccountNumber !== undefined) data.bankAccountNumber = bankAccountNumber
    if (bankIfsc !== undefined) data.bankIfsc = bankIfsc.toUpperCase()
    if (upiId !== undefined) data.upiId = upiId
    if (emergencyContactName !== undefined) data.emergencyContactName = emergencyContactName
    if (emergencyContactPhone !== undefined) data.emergencyContactPhone = emergencyContactPhone

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true, panNumber: true, bankAccountName: true, bankAccountNumber: true,
        bankIfsc: true, upiId: true,
        emergencyContactName: true, emergencyContactPhone: true,
      },
    })

    res.status(200).json({ message: "Payout details saved", employee: user })
  } catch (error) {
    console.error("updateMyKyc error:", error)
    res.status(500).json({ message: "Could not save your payout details" })
  }
}

// ═════════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═════════════════════════════════════════════════════════════════
const getMyNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
    res.status(200).json({
      unread: notifications.filter((n) => !n.isRead).length,
      notifications,
    })
  } catch (error) {
    console.error("getMyNotifications error:", error)
    res.status(500).json({ message: "Could not load notifications" })
  }
}

const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params
    const existing = await prisma.notification.findFirst({
      where: { id, userId: req.user.id },
    })
    if (!existing) return res.status(404).json({ message: "Notification not found" })

    await prisma.notification.update({ where: { id }, data: { isRead: true } })
    res.status(200).json({ message: "Marked as read" })
  } catch (error) {
    console.error("markNotificationRead error:", error)
    res.status(500).json({ message: "Could not update notification" })
  }
}

const markAllNotificationsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    })
    res.status(200).json({ message: "All marked as read" })
  } catch (error) {
    console.error("markAllNotificationsRead error:", error)
    res.status(500).json({ message: "Could not update notifications" })
  }
}

// ═════════════════════════════════════════════════════════════════
//  LEADERBOARD
// ═════════════════════════════════════════════════════════════════
const getEmployeeLeaderboard = async (req, res) => {
  try {
    const employees = await prisma.user.findMany({
      where: { role: "EMPLOYEE", isActive: true },
      select: {
        id: true, name: true, employeeCode: true,
        taskStartAt: true, taskDeadline: true, taskTarget: true,
      },
    })

    const rows = await Promise.all(
      employees.map(async (e) => {
        const [qualified, task] = await Promise.all([
          prisma.commission.count({
            where: { employeeId: e.id, type: "ENROLLMENT", status: { not: "REVERSED" } },
          }),
          getTaskState(e),
        ])
        return {
          employeeId: e.id,
          name: e.name,
          employeeCode: e.employeeCode,
          qualified,
          taskProgress: task.progress,
          taskTarget: task.target,
          taskPercent: task.percent,
          tasksCompleted: await prisma.commission.count({
            where: { employeeId: e.id, type: "TASK_BONUS", status: { not: "REVERSED" } },
          }),
        }
      })
    )

    rows.sort((a, b) => b.qualified - a.qualified)
    rows.forEach((r, i) => (r.rank = i + 1))

    res.status(200).json({ leaderboard: rows })
  } catch (error) {
    console.error("getEmployeeLeaderboard error:", error)
    res.status(500).json({ message: "Could not load leaderboard" })
  }
}

// ═════════════════════════════════════════════════════════════════
//  ADMIN — employees
// ═════════════════════════════════════════════════════════════════
const createEmployee = async (req, res) => {
  try {
    const { name, email, password, whatsappNumber, taskDeadline, taskTarget } = req.body

    if (!name || !email || !password || !whatsappNumber) {
      return res.status(400).json({
        message: "Name, email, password and WhatsApp number are required",
      })
    }
    if (!/^[a-zA-Z\s.]+$/.test(name.trim())) {
      return res.status(400).json({ message: "Name can contain only letters, spaces and full stops" })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address" })
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" })
    }
    if (!/^\d{10}$/.test(whatsappNumber)) {
      return res.status(400).json({ message: "WhatsApp number must be 10 digits" })
    }

    const clash = await prisma.user.findUnique({ where: { email } })
    if (clash) return res.status(409).json({ message: "That email is already registered" })

    const [referralCode, employeeCode] = await Promise.all([
      generateReferralCode(name),
      nextEmployeeCode(),
    ])
    const hashed = await bcrypt.hash(password, 10)

    const employee = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        password: hashed,
        whatsappNumber,
        role: "EMPLOYEE",
        referralCode,
        employeeCode,
        taskStartAt: new Date(),
        taskDeadline: taskDeadline ? new Date(taskDeadline) : null,
        taskTarget: taskTarget ? parseInt(taskTarget) : null,
      },
      select: {
        id: true, name: true, email: true, whatsappNumber: true,
        employeeCode: true, referralCode: true, createdAt: true,
        taskStartAt: true, taskDeadline: true, taskTarget: true,
      },
    })

    await notify(employee.id, {
      title: "Welcome to EYTS",
      body: `Your employee ID is ${employeeCode} and your referral code is ${referralCode}. Students who use it get ₹${REFERRAL_DISCOUNT} off, and you earn ₹${RATE_PER_ENROLLMENT} per paid enrollment.`,
      type: "ANNOUNCEMENT",
      link: "/employee?tab=tools",
    })

    res.status(201).json({
      message: `Employee ${employeeCode} created`,
      employee,
      referralLink: `${process.env.FRONTEND_URL || "http://localhost:5173"}/signup?ref=${referralCode}`,
    })
  } catch (error) {
    console.error("createEmployee error:", error)
    res.status(500).json({ message: "Could not create employee" })
  }
}

const getAllEmployees = async (req, res) => {
  try {
    const employees = await prisma.user.findMany({
      where: { role: "EMPLOYEE" },
      orderBy: { employeeCode: "asc" },
      select: {
        id: true, name: true, email: true, whatsappNumber: true,
        employeeCode: true, referralCode: true, isActive: true, createdAt: true,
        taskStartAt: true, taskDeadline: true, taskTarget: true,
        bankAccountNumber: true, upiId: true, panNumber: true,
      },
    })

    const rows = await Promise.all(
      employees.map(async (e) => {
        const [qualified, referred, pending, codeUses, task, collected] = await Promise.all([
          prisma.commission.count({
            where: { employeeId: e.id, type: "ENROLLMENT", status: { not: "REVERSED" } },
          }),
          prisma.user.count({ where: { referredById: e.id } }),
          prisma.commission.aggregate({
            where: { employeeId: e.id, status: "PENDING" },
            _sum: { amount: true },
          }),
          prisma.payment.count({ where: { couponCode: e.referralCode, status: "PAID" } }),
          getTaskState(e),
          prisma.payment.aggregate({
            where: { status: "PAID", user: { referredById: e.id } },
            _sum: { amount: true },
          }),
        ])

        const commissionEarned = qualified * RATE_PER_ENROLLMENT

        return {
          ...e,
          kycComplete: !!(e.panNumber && (e.bankAccountNumber || e.upiId)),
          referred,
          qualified,
          codeUses,
          commissionEarned,
          revenueCollected: collected._sum.amount || 0,
          task,
          tasksCompleted: await prisma.commission.count({
            where: { employeeId: e.id, type: "TASK_BONUS", status: { not: "REVERSED" } },
          }),
          pendingPayable: pending._sum.amount || 0,
        }
      })
    )

    res.status(200).json({
      count: rows.length,
      referralDiscount: REFERRAL_DISCOUNT,
      ratePerEnrollment: RATE_PER_ENROLLMENT,
      defaultTaskTarget: TASK_TARGET,
      taskBonus: TASK_BONUS,
      missPenaltyPercent: MISS_PENALTY_PERCENT,
      employees: rows,
    })
  } catch (error) {
    console.error("getAllEmployees error:", error)
    res.status(500).json({ message: "Could not load employees" })
  }
}

// PATCH /api/employees/:id/task — office sets the task window
const setEmployeeTask = async (req, res) => {
  try {
    const { id } = req.params
    const { taskStartAt, taskDeadline, taskTarget } = req.body

    const employee = await prisma.user.findFirst({ where: { id, role: "EMPLOYEE" } })
    if (!employee) return res.status(404).json({ message: "Employee not found" })

    const data = {}

    if (taskStartAt !== undefined) {
      data.taskStartAt = taskStartAt ? new Date(taskStartAt) : null
      if (taskStartAt && isNaN(data.taskStartAt)) {
        return res.status(400).json({ message: "Enter a valid start date" })
      }
    }
    if (taskDeadline !== undefined) {
      data.taskDeadline = taskDeadline ? new Date(taskDeadline) : null
      if (taskDeadline && isNaN(data.taskDeadline)) {
        return res.status(400).json({ message: "Enter a valid deadline" })
      }
    }
    if (taskTarget !== undefined) {
      if (taskTarget === null || taskTarget === "") {
        data.taskTarget = null
      } else {
        const n = parseInt(taskTarget)
        if (isNaN(n) || n < 1) {
          return res.status(400).json({ message: "Target must be at least 1" })
        }
        data.taskTarget = n
      }
    }

    const start = data.taskStartAt ?? employee.taskStartAt
    const end = data.taskDeadline ?? employee.taskDeadline
    if (start && end && new Date(start) > new Date(end)) {
      return res.status(400).json({ message: "The deadline must fall after the start date" })
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, name: true, employeeCode: true,
        taskStartAt: true, taskDeadline: true, taskTarget: true,
      },
    })

    const task = await getTaskState({ ...employee, ...updated })

    if (updated.taskDeadline) {
      await notify(id, {
        title: "Task assigned",
        body: `Enroll ${task.target} students with completed payment by ${new Date(updated.taskDeadline).toLocaleDateString("en-IN")}. Completing it pays ₹${TASK_BONUS}. Missing it deducts ${MISS_PENALTY_PERCENT}% of your commission.`,
        type: "MILESTONE",
        link: "/employee/profile",
      })
    }

    res.status(200).json({
      message: `Task updated for ${updated.name}`,
      employee: updated,
      task,
    })
  } catch (error) {
    console.error("setEmployeeTask error:", error)
    res.status(500).json({ message: "Could not update the task" })
  }
}

const toggleEmployeeActive = async (req, res) => {
  try {
    const { id } = req.params
    const employee = await prisma.user.findFirst({ where: { id, role: "EMPLOYEE" } })
    if (!employee) return res.status(404).json({ message: "Employee not found" })

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: !employee.isActive },
      select: { id: true, name: true, employeeCode: true, isActive: true },
    })

    res.status(200).json({
      message: `${updated.name} ${updated.isActive ? "reactivated" : "deactivated"}`,
      employee: updated,
    })
  } catch (error) {
    console.error("toggleEmployeeActive error:", error)
    res.status(500).json({ message: "Could not update employee" })
  }
}

// ═════════════════════════════════════════════════════════════════
//  ADMIN — weekly payout run
//  Applies any missed-task penalties first, so they land in the payout.
// ═════════════════════════════════════════════════════════════════
const generatePayouts = async (req, res) => {
  try {
    let { periodStart, periodEnd } = req.body

    let start, end
    if (periodStart && periodEnd) {
      start = new Date(periodStart)
      end = new Date(periodEnd)
      if (isNaN(start) || isNaN(end) || start > end) {
        return res.status(400).json({ message: "Enter a valid period" })
      }
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
    } else {
      const lastWeek = new Date()
      lastWeek.setDate(lastWeek.getDate() - 7)
      const bounds = getWeekBounds(lastWeek)
      start = bounds.start
      end = bounds.end
    }

    // Apply penalties for any expired, unmet tasks before grouping.
    const withDeadlines = await prisma.user.findMany({
      where: { role: "EMPLOYEE", taskDeadline: { not: null, lt: new Date() } },
      select: { id: true },
    })
    const penalties = []
    for (const e of withDeadlines) {
      const result = await applyMissedTaskPenalty(e.id)
      if (result.applied) penalties.push({ employeeId: e.id, penalty: result.penalty })
    }

    const pending = await prisma.commission.findMany({
      where: { status: "PENDING", earnedAt: { gte: start, lte: end } },
      select: { id: true, employeeId: true, type: true, amount: true },
    })

    if (pending.length === 0) {
      return res.status(200).json({
        message: "No unpaid earnings in that period",
        periodStart: start,
        periodEnd: end,
        penaltiesApplied: penalties,
        payouts: [],
      })
    }

    const grouped = {}
    pending.forEach((c) => {
      grouped[c.employeeId] = grouped[c.employeeId] || {
        enrollmentCount: 0, commissionAmount: 0, bonusAmount: 0, ids: [],
      }
      const g = grouped[c.employeeId]
      g.ids.push(c.id)
      if (c.type === "ENROLLMENT") {
        g.enrollmentCount += 1
        g.commissionAmount += c.amount
      } else {
        // TASK_BONUS is positive, TASK_PENALTY is negative — both belong here.
        g.bonusAmount += c.amount
      }
    })

    const created = []
    for (const [employeeId, g] of Object.entries(grouped)) {
      const totalAmount = g.commissionAmount + g.bonusAmount

      const existing = await prisma.payout.findFirst({
        where: { employeeId, periodStart: start, periodEnd: end },
      })
      if (existing) {
        created.push({ employeeId, skipped: true, reason: "payout already generated" })
        continue
      }

      const payout = await prisma.payout.create({
        data: {
          employeeId,
          periodStart: start,
          periodEnd: end,
          enrollmentCount: g.enrollmentCount,
          commissionAmount: g.commissionAmount,
          bonusAmount: g.bonusAmount,
          totalAmount,
          status: "PENDING",
        },
      })

      await prisma.commission.updateMany({
        where: { id: { in: g.ids } },
        data: { payoutId: payout.id },
      })

      await notify(employeeId, {
        title: "Weekly payout prepared",
        body: `₹${totalAmount} for ${g.enrollmentCount} enrollment${g.enrollmentCount === 1 ? "" : "s"}${
          g.bonusAmount > 0 ? ` plus ₹${g.bonusAmount} task salary` : ""
        }${g.bonusAmount < 0 ? ` after a ₹${Math.abs(g.bonusAmount)} deduction` : ""}. It will be transferred shortly.`,
        type: "PAYOUT",
        link: "/employee?tab=earnings",
      })

      created.push(payout)
    }

    res.status(201).json({
      message: `${created.filter((c) => !c.skipped).length} payout(s) generated`,
      periodStart: start,
      periodEnd: end,
      penaltiesApplied: penalties,
      payouts: created,
    })
  } catch (error) {
    console.error("generatePayouts error:", error)
    res.status(500).json({ message: "Could not generate payouts" })
  }
}

const getAllPayouts = async (req, res) => {
  try {
    const { status } = req.query
    const payouts = await prisma.payout.findMany({
      where: status ? { status } : {},
      orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
      include: {
        employee: {
          select: {
            id: true, name: true, employeeCode: true,
            bankAccountName: true, bankAccountNumber: true, bankIfsc: true, upiId: true,
          },
        },
      },
    })
    res.status(200).json({ count: payouts.length, payouts })
  } catch (error) {
    console.error("getAllPayouts error:", error)
    res.status(500).json({ message: "Could not load payouts" })
  }
}

const markPayoutPaid = async (req, res) => {
  try {
    const { id } = req.params
    const { reference, notes } = req.body

    const payout = await prisma.payout.findUnique({
      where: { id },
      include: { employee: { select: { id: true, name: true } } },
    })
    if (!payout) return res.status(404).json({ message: "Payout not found" })
    if (payout.status === "PAID") {
      return res.status(400).json({ message: "This payout is already marked as paid" })
    }

    const updated = await prisma.payout.update({
      where: { id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        reference: reference || null,
        notes: notes || null,
      },
    })

    await prisma.commission.updateMany({
      where: { payoutId: id },
      data: { status: "PAID" },
    })

    await notify(payout.employee.id, {
      title: "Payment credited",
      body: `₹${payout.totalAmount} has been transferred${reference ? ` (ref ${reference})` : ""}.`,
      type: "PAYOUT",
      link: "/employee?tab=earnings",
    })

    res.status(200).json({ message: `₹${payout.totalAmount} marked as paid`, payout: updated })
  } catch (error) {
    console.error("markPayoutPaid error:", error)
    res.status(500).json({ message: "Could not update payout" })
  }
}

// ═════════════════════════════════════════════════════════════════
//  PUBLIC — GET /api/employees/referral/:code
// ═════════════════════════════════════════════════════════════════
const validateReferralCode = async (req, res) => {
  try {
    const { code } = req.params
    if (!code) return res.status(400).json({ message: "Referral code required" })

    const resolved = await resolveReferralCode(code)
    if (!resolved) {
      return res.status(404).json({ valid: false, message: "That referral code is not recognised" })
    }

    res.status(200).json({
      valid: true,
      referredByName: resolved.employeeName,
      referralCode: resolved.code,
      discount: resolved.discount,
    })
  } catch (error) {
    console.error("validateReferralCode error:", error)
    res.status(500).json({ message: "Could not check that referral code" })
  }
}

module.exports = {
  // hooks for paymentController
  attributeCommission,
  reverseCommission,
  resolveReferralCode,
  linkStudentToEmployee,
  applyMissedTaskPenalty,
  // employee
  getMySummary,
  getMyEnrollments,
  getMyEarnings,
  updateMyProfile,
  updateMyKyc,
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getEmployeeLeaderboard,
  // admin
  createEmployee,
  getAllEmployees,
  setEmployeeTask,
  toggleEmployeeActive,
  generatePayouts,
  getAllPayouts,
  markPayoutPaid,
  // public
  validateReferralCode,
  // constants
  RATE_PER_ENROLLMENT,
  TASK_TARGET,
  TASK_BONUS,
  REFERRAL_DISCOUNT,
  MISS_PENALTY_PERCENT,
}
