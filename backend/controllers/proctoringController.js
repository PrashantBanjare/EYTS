const { PrismaClient } = require("@prisma/client")
const crypto = require("crypto")
const prisma = new PrismaClient()
const { sendEmail } = require("../utils/emailService")

// ═══════════════════════════════════════════════════════════════════
//  WHICH MODE APPLIES TO THIS CANDIDATE
//
//  Precedence: a per-student override beats the exam default. The
//  override exists for the case the office cannot plan for — a
//  candidate with no camera, a disability accommodation, a retake
//  under supervision — without weakening proctoring for everyone.
// ═══════════════════════════════════════════════════════════════════
const resolveProctoringMode = async (userId, examId) => {
  const [user, exam] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { proctoringOverride: true, age: true, consentWaived: true },
    }),
    prisma.exam.findUnique({
      where: { id: examId },
      select: { proctoringMode: true, requireParentalConsent: true },
    }),
  ])

  if (!user || !exam) return null

  const mode = user.proctoringOverride || exam.proctoringMode || "OFF"
  const isMinor = typeof user.age === "number" && user.age < 18
  const usesCamera = mode === "FACE_DETECTION" || mode === "FULL_RECORDING"

  // Consent is only ever demanded when the camera is actually going to be
  // switched on. A minor sitting a BROWSER_ONLY paper needs nothing.
  const needsConsent =
    isMinor &&
    usesCamera &&
    exam.requireParentalConsent &&
    !user.consentWaived

  return { mode, isMinor, usesCamera, needsConsent }
}

// ── GET /api/proctoring/config/:examId — student, before starting ──
const getProctoringConfig = async (req, res) => {
  try {
    const { examId } = req.params
    const userId = req.user.id

    const resolved = await resolveProctoringMode(userId, examId)
    if (!resolved) return res.status(404).json({ message: "Examination not found" })

    let consent = null
    if (resolved.needsConsent) {
      consent = await prisma.parentalConsent.findUnique({
        where: { studentId: userId },
        select: { verified: true, parentName: true, parentEmail: true, verifiedAt: true },
      })
    }

    res.status(200).json({
      mode: resolved.mode,
      usesCamera: resolved.usesCamera,
      storesSnapshots: resolved.mode === "FULL_RECORDING",
      isMinor: resolved.isMinor,
      needsConsent: resolved.needsConsent,
      consentGiven: !!consent?.verified,
      consent: consent?.verified ? consent : null,
    })
  } catch (error) {
    console.error("getProctoringConfig error:", error)
    res.status(500).json({ message: "Could not load proctoring settings" })
  }
}

// ── POST /api/proctoring/events — student's browser reports incidents ──
// Sent in batches. One incident must never be able to fail an exam
// submission, so this endpoint is deliberately forgiving.
const recordEvents = async (req, res) => {
  try {
    const { attemptId, events } = req.body
    const userId = req.user.id

    if (!attemptId || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ message: "attemptId and events are required" })
    }
    if (events.length > 100) {
      return res.status(400).json({ message: "Too many events in one batch" })
    }

    // The attempt must belong to the caller, or anyone could pollute
    // somebody else's proctoring record.
    const attempt = await prisma.examAttempt.findFirst({
      where: { id: attemptId, userId },
      select: { id: true, isSubmitted: true },
    })
    if (!attempt) return res.status(404).json({ message: "Attempt not found" })
    if (attempt.isSubmitted) {
      return res.status(200).json({ recorded: 0, note: "attempt already submitted" })
    }

    const ALLOWED = [
      "TAB_SWITCH", "WINDOW_BLUR", "FULLSCREEN_EXIT", "COPY", "PASTE",
      "RIGHT_CLICK", "DEVTOOLS", "FACE_ABSENT", "MULTIPLE_FACES",
      "LOOKING_AWAY", "CAMERA_BLOCKED", "CAMERA_ERROR", "CAMERA_STARTED",
    ]
    const SEVERITY = {
      MULTIPLE_FACES: "HIGH",
      CAMERA_BLOCKED: "HIGH",
      DEVTOOLS: "HIGH",
      FACE_ABSENT: "MEDIUM",
      TAB_SWITCH: "MEDIUM",
      FULLSCREEN_EXIT: "MEDIUM",
      PASTE: "MEDIUM",
      COPY: "LOW",
      WINDOW_BLUR: "LOW",
      RIGHT_CLICK: "LOW",
      LOOKING_AWAY: "LOW",
      CAMERA_ERROR: "LOW",
      CAMERA_STARTED: "LOW",
    }

    const rows = events
      .filter((e) => ALLOWED.includes(e.eventType))
      .map((e) => ({
        attemptId,
        eventType: e.eventType,
        severity: SEVERITY[e.eventType] || "LOW",
        metadata: e.metadata || undefined,
        occurredAt: e.occurredAt ? new Date(e.occurredAt) : new Date(),
      }))

    if (rows.length === 0) {
      return res.status(200).json({ recorded: 0 })
    }

    await prisma.proctoringEvent.createMany({ data: rows })
    res.status(201).json({ recorded: rows.length })
  } catch (error) {
    console.error("recordEvents error:", error)
    // 200, not 500: a proctoring write failing must not make the exam
    // client think something is wrong and interrupt the candidate.
    res.status(200).json({ recorded: 0, error: "not recorded" })
  }
}

// ── POST /api/proctoring/snapshot — FULL_RECORDING only ──
const recordSnapshot = async (req, res) => {
  try {
    const { attemptId, imageData, flagged, flagReason } = req.body
    const userId = req.user.id

    if (!attemptId || !imageData) {
      return res.status(400).json({ message: "attemptId and imageData are required" })
    }

    const attempt = await prisma.examAttempt.findFirst({
      where: { id: attemptId, userId },
      select: { id: true, isSubmitted: true, proctoringMode: true },
    })
    if (!attempt) return res.status(404).json({ message: "Attempt not found" })
    if (attempt.isSubmitted) {
      return res.status(200).json({ stored: false, note: "attempt already submitted" })
    }

    // Refuse to store an image the candidate was never told would be kept.
    if (attempt.proctoringMode !== "FULL_RECORDING") {
      return res.status(403).json({
        message: "Snapshots are not enabled for this attempt",
      })
    }

    // ~700 KB of base64. Anything larger is a client bug or an attempt to
    // fill the database.
    if (imageData.length > 700_000) {
      return res.status(413).json({ message: "Snapshot too large" })
    }

    await prisma.proctoringSnapshot.create({
      data: {
        attemptId,
        imageData,
        flagged: !!flagged,
        flagReason: flagReason || null,
      },
    })

    res.status(201).json({ stored: true })
  } catch (error) {
    console.error("recordSnapshot error:", error)
    res.status(200).json({ stored: false })
  }
}

// ═══════════════════════════════════════════════════════════════════
//  PARENTAL CONSENT
//
//  The OTP goes to the parent's own email, never the student's. A
//  student who can approve their own consent has not been consented
//  for, and the record would be worthless in a dispute.
// ═══════════════════════════════════════════════════════════════════

// ── POST /api/proctoring/consent/request ──
const requestParentalConsent = async (req, res) => {
  try {
    const { parentName, parentEmail, parentPhone, relationship } = req.body
    const userId = req.user.id

    if (!parentName || !parentEmail || !parentPhone) {
      return res.status(400).json({
        message: "Parent or guardian name, email and phone are all required",
      })
    }
    if (!/\S+@\S+\.\S+/.test(parentEmail)) {
      return res.status(400).json({ message: "That parent email does not look valid" })
    }
    if (!/^\d{10}$/.test(parentPhone)) {
      return res.status(400).json({ message: "Parent phone must be 10 digits" })
    }

    const student = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, age: true },
    })
    if (!student) return res.status(404).json({ message: "Student not found" })

    if (parentEmail.toLowerCase() === student.email.toLowerCase()) {
      return res.status(400).json({
        message: "The parent's email must be different from the candidate's own email",
      })
    }

    const otp = String(crypto.randomInt(100000, 1000000))
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000)

    await prisma.parentalConsent.upsert({
      where: { studentId: userId },
      update: {
        parentName: parentName.trim(),
        parentEmail: parentEmail.trim().toLowerCase(),
        parentPhone,
        relationship: relationship || null,
        otp,
        otpExpiry,
        verified: false,
        verifiedAt: null,
      },
      create: {
        studentId: userId,
        parentName: parentName.trim(),
        parentEmail: parentEmail.trim().toLowerCase(),
        parentPhone,
        relationship: relationship || null,
        otp,
        otpExpiry,
      },
    })

    await sendEmail({
      to: parentEmail,
      subject: "Consent required — your child's online examination",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;">
          <div style="background:#0a1628;color:#fff;padding:20px;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;font-size:19px;">Parental Consent Required</h1>
          </div>
          <div style="background:#f9f9f9;padding:24px;border-radius:0 0 12px 12px;">
            <p style="font-size:15px;">Dear ${parentName},</p>
            <p style="font-size:15px;line-height:1.6;">
              <strong>${student.name}</strong> (age ${student.age}) has registered for an
              online examination that is monitored by camera.
            </p>
            <p style="font-size:14px;line-height:1.6;">During the examination we will:</p>
            <ul style="font-size:14px;line-height:1.7;color:#444;">
              <li>Use the webcam to confirm the candidate is present and alone</li>
              <li>Record if the browser tab is switched or left</li>
              <li>Keep any images only as long as needed to review the result</li>
            </ul>
            <p style="font-size:15px;">Share this code with your child to give consent:</p>
            <div style="background:#fff;padding:20px;border-radius:10px;text-align:center;margin:16px 0;">
              <span style="font-size:32px;font-weight:bold;letter-spacing:8px;">${otp}</span>
            </div>
            <p style="font-size:13px;color:#777;">
              The code expires in 15 minutes. If you do not consent, simply do not share it —
              your child can still sit the examination without camera monitoring by contacting us.
            </p>
            <p style="font-size:13px;color:#999;margin-top:22px;">— TalentExam</p>
          </div>
        </div>
      `,
    })

    res.status(200).json({
      message: `A consent code has been sent to ${parentEmail}`,
      parentEmail,
    })
  } catch (error) {
    console.error("requestParentalConsent error:", error)
    res.status(500).json({ message: "Could not send the consent request" })
  }
}

// ── POST /api/proctoring/consent/verify ──
const verifyParentalConsent = async (req, res) => {
  try {
    const { otp } = req.body
    const userId = req.user.id

    if (!otp) return res.status(400).json({ message: "Enter the code from the email" })

    const consent = await prisma.parentalConsent.findUnique({
      where: { studentId: userId },
    })
    if (!consent || !consent.otp) {
      return res.status(400).json({ message: "No consent request found. Send one first." })
    }
    if (consent.verified) {
      return res.status(200).json({ message: "Consent has already been given", verified: true })
    }
    if (new Date() > consent.otpExpiry) {
      return res.status(400).json({ message: "That code has expired. Please request a new one." })
    }
    if (consent.otp !== String(otp).trim()) {
      return res.status(400).json({ message: "That code is not correct" })
    }

    const updated = await prisma.parentalConsent.update({
      where: { studentId: userId },
      data: {
        verified: true,
        verifiedAt: new Date(),
        otp: null,
        otpExpiry: null,
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
      },
    })

    res.status(200).json({
      message: "Consent recorded. You may now begin the examination.",
      verified: true,
      verifiedAt: updated.verifiedAt,
    })
  } catch (error) {
    console.error("verifyParentalConsent error:", error)
    res.status(500).json({ message: "Could not verify the consent code" })
  }
}

// ── GET /api/proctoring/consent/status ──
const getConsentStatus = async (req, res) => {
  try {
    const consent = await prisma.parentalConsent.findUnique({
      where: { studentId: req.user.id },
      select: {
        parentName: true, parentEmail: true, parentPhone: true,
        relationship: true, verified: true, verifiedAt: true, createdAt: true,
      },
    })
    res.status(200).json({ consent: consent || null, verified: !!consent?.verified })
  } catch (error) {
    console.error("getConsentStatus error:", error)
    res.status(500).json({ message: "Could not load consent status" })
  }
}

// ═══════════════════════════════════════════════════════════════════
//  ADMIN
// ═══════════════════════════════════════════════════════════════════

// ── GET /api/proctoring/report/:attemptId — admin reviews one sitting ──
const getProctoringReport = async (req, res) => {
  try {
    const { attemptId } = req.params

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        user: { select: { id: true, name: true, email: true, age: true } },
        proctoringEvents: { orderBy: { occurredAt: "asc" } },
        proctoringSnapshots: {
          orderBy: { capturedAt: "asc" },
          select: { id: true, capturedAt: true, flagged: true, flagReason: true },
        },
      },
    })
    if (!attempt) return res.status(404).json({ message: "Attempt not found" })

    const counts = {}
    attempt.proctoringEvents.forEach((e) => {
      counts[e.eventType] = (counts[e.eventType] || 0) + 1
    })

    const high = attempt.proctoringEvents.filter((e) => e.severity === "HIGH").length
    const medium = attempt.proctoringEvents.filter((e) => e.severity === "MEDIUM").length

    // A blunt score, not a verdict. It exists so a reviewer knows which
    // sittings to look at first — never to disqualify anyone on its own.
    const riskScore = Math.min(100, high * 20 + medium * 5)

    res.status(200).json({
      attempt: {
        id: attempt.id,
        student: attempt.user,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        proctoringMode: attempt.proctoringMode,
      },
      summary: {
        totalEvents: attempt.proctoringEvents.length,
        highSeverity: high,
        mediumSeverity: medium,
        riskScore,
        counts,
        snapshotCount: attempt.proctoringSnapshots.length,
      },
      events: attempt.proctoringEvents,
      snapshots: attempt.proctoringSnapshots,
    })
  } catch (error) {
    console.error("getProctoringReport error:", error)
    res.status(500).json({ message: "Could not load the proctoring report" })
  }
}

// ── GET /api/proctoring/snapshot/:id — admin fetches one image ──
// Images are served one at a time, never in a list, so a report page
// cannot accidentally pull megabytes of candidate photographs.
const getSnapshotImage = async (req, res) => {
  try {
    const snapshot = await prisma.proctoringSnapshot.findUnique({
      where: { id: req.params.id },
      select: { imageData: true, capturedAt: true, flagged: true, flagReason: true },
    })
    if (!snapshot) return res.status(404).json({ message: "Snapshot not found" })
    res.status(200).json({ snapshot })
  } catch (error) {
    console.error("getSnapshotImage error:", error)
    res.status(500).json({ message: "Could not load the snapshot" })
  }
}

// ── GET /api/proctoring/flagged — admin sees the sittings worth reviewing ──
const getFlaggedAttempts = async (req, res) => {
  try {
    const attempts = await prisma.examAttempt.findMany({
      where: {
        isSubmitted: true,
        proctoringEvents: { some: { severity: { in: ["HIGH", "MEDIUM"] } } },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        proctoringEvents: { select: { eventType: true, severity: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: 100,
    })

    const rows = attempts.map((a) => {
      const high = a.proctoringEvents.filter((e) => e.severity === "HIGH").length
      const medium = a.proctoringEvents.filter((e) => e.severity === "MEDIUM").length
      return {
        attemptId: a.id,
        student: a.user,
        submittedAt: a.submittedAt,
        proctoringMode: a.proctoringMode,
        totalEvents: a.proctoringEvents.length,
        highSeverity: high,
        mediumSeverity: medium,
        riskScore: Math.min(100, high * 20 + medium * 5),
      }
    })

    rows.sort((a, b) => b.riskScore - a.riskScore)

    res.status(200).json({ count: rows.length, attempts: rows })
  } catch (error) {
    console.error("getFlaggedAttempts error:", error)
    res.status(500).json({ message: "Could not load flagged attempts" })
  }
}

// ── PATCH /api/proctoring/student/:userId — admin sets a per-student rule ──
const setStudentProctoring = async (req, res) => {
  try {
    const { userId } = req.params
    const { proctoringOverride, consentWaived } = req.body

    const VALID = ["OFF", "BROWSER_ONLY", "FACE_DETECTION", "FULL_RECORDING"]
    const data = {}

    if (proctoringOverride !== undefined) {
      if (proctoringOverride === null || proctoringOverride === "") {
        data.proctoringOverride = null   // fall back to the exam default
      } else if (VALID.includes(proctoringOverride)) {
        data.proctoringOverride = proctoringOverride
      } else {
        return res.status(400).json({ message: `Mode must be one of: ${VALID.join(", ")}` })
      }
    }

    if (consentWaived !== undefined) {
      data.consentWaived = !!consentWaived
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "Nothing to update" })
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, age: true, proctoringOverride: true, consentWaived: true },
    })

    // Waiving consent for a minor is a decision somebody should be able to
    // account for later, so it is logged rather than done silently.
    if (data.consentWaived === true && typeof user.age === "number" && user.age < 18) {
      console.warn(
        `[CONSENT WAIVED] admin ${req.user.id} waived parental consent for minor ${user.id} (${user.name}, age ${user.age})`
      )
    }

    res.status(200).json({ message: "Proctoring settings updated", user })
  } catch (error) {
    console.error("setStudentProctoring error:", error)
    res.status(500).json({ message: "Could not update proctoring settings" })
  }
}

// ── GET /api/proctoring/consents — admin sees all consent records ──
const getAllConsents = async (req, res) => {
  try {
    const consents = await prisma.parentalConsent.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        student: { select: { id: true, name: true, email: true, age: true } },
      },
    })
    res.status(200).json({ count: consents.length, consents })
  } catch (error) {
    console.error("getAllConsents error:", error)
    res.status(500).json({ message: "Could not load consent records" })
  }
}

module.exports = {
  resolveProctoringMode,
  getProctoringConfig,
  recordEvents,
  recordSnapshot,
  requestParentalConsent,
  verifyParentalConsent,
  getConsentStatus,
  getProctoringReport,
  getSnapshotImage,
  getFlaggedAttempts,
  setStudentProctoring,
  getAllConsents,
}