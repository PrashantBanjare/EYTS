const express = require("express")
const router = express.Router()

const {
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
} = require("../controllers/proctoringController")

const { protect, adminOnly } = require("../middleware/authMiddleware")

// ── Student ───────────────────────────────────────────────────────
// What monitoring applies to me, and do I need a parent's consent first
router.get("/config/:examId", protect, getProctoringConfig)

// Incident batches from the browser during the sitting
router.post("/events", protect, recordEvents)

// Webcam frames — rejected server-side unless the attempt was started
// in FULL_RECORDING mode
router.post("/snapshot", protect, recordSnapshot)

// ── Parental consent (student-initiated, parent-verified) ─────────
router.post("/consent/request", protect, requestParentalConsent)
router.post("/consent/verify", protect, verifyParentalConsent)
router.get("/consent/status", protect, getConsentStatus)

// ── Admin ─────────────────────────────────────────────────────────
// Static paths first, so "/flagged" and "/consents" are not swallowed
// by the ":attemptId" pattern below them.
router.get("/flagged", protect, adminOnly, getFlaggedAttempts)
router.get("/consents", protect, adminOnly, getAllConsents)
router.get("/snapshot/:id", protect, adminOnly, getSnapshotImage)
router.get("/report/:attemptId", protect, adminOnly, getProctoringReport)

// Per-candidate override — the only way to differ from the exam default
router.patch("/student/:userId", protect, adminOnly, setStudentProctoring)

module.exports = router
