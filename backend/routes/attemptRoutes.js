const express = require("express")
const router = express.Router()
const {
  startAttempt,
  submitAttempt,
  getMyAttempts,
  getAttemptResult,
  getLeaderboard,
  resetAttempt,
  getAttemptSheetAdmin,
  getExamAttemptsAdmin
} = require("../controllers/attemptController")
const { protect, adminOnly } = require("../middleware/authMiddleware")

router.post("/start", protect, startAttempt)
router.post("/submit", protect, submitAttempt)
router.get("/my", protect, getMyAttempts)
router.get("/admin/by-exam/:examId", protect, adminOnly, getExamAttemptsAdmin)
router.get("/admin/:attemptId", protect, adminOnly, getAttemptSheetAdmin)
router.get("/:id/result", protect, getAttemptResult)
router.get("/leaderboard/:examId", protect, getLeaderboard)
router.delete("/reset/:userId", protect, adminOnly, resetAttempt)

module.exports = router