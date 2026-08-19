const express = require("express")
const router = express.Router()

const { protect, adminOnly } = require("../middleware/authMiddleware")
const {
  getMySummary,
  getMyEnrollments,
  getMyEarnings,
  updateMyProfile,
  updateMyKyc,
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getEmployeeLeaderboard,
  createEmployee,
  getAllEmployees,
  setEmployeeTask,
  toggleEmployeeActive,
  generatePayouts,
  getAllPayouts,
  markPayoutPaid,
  validateReferralCode,
} = require("../controllers/employeeController")

// Employees only (admins pass too, so the office can inspect a page).
const employeeOnly = (req, res, next) => {
  if (req.user?.role !== "EMPLOYEE" && req.user?.role !== "ADMIN") {
    return res.status(403).json({ message: "This area is for EYTS employees" })
  }
  next()
}

// ── Public ────────────────────────────────────────────────────────
router.get("/referral/:code", validateReferralCode)

// ── Employee ──────────────────────────────────────────────────────
router.get("/me/summary", protect, employeeOnly, getMySummary)
router.get("/me/enrollments", protect, employeeOnly, getMyEnrollments)
router.get("/me/earnings", protect, employeeOnly, getMyEarnings)
router.patch("/me/profile", protect, employeeOnly, updateMyProfile)
router.patch("/me/kyc", protect, employeeOnly, updateMyKyc)
router.get("/leaderboard", protect, employeeOnly, getEmployeeLeaderboard)

// Notifications work for any signed-in user (students included).
router.get("/me/notifications", protect, getMyNotifications)
router.patch("/me/notifications/read-all", protect, markAllNotificationsRead)
router.patch("/me/notifications/:id/read", protect, markNotificationRead)

// ── Admin ─────────────────────────────────────────────────────────
router.post("/", protect, adminOnly, createEmployee)
router.get("/", protect, adminOnly, getAllEmployees)
router.patch("/:id/task", protect, adminOnly, setEmployeeTask)
router.patch("/:id/toggle-active", protect, adminOnly, toggleEmployeeActive)

router.post("/payouts/generate", protect, adminOnly, generatePayouts)
router.get("/payouts", protect, adminOnly, getAllPayouts)
router.patch("/payouts/:id/pay", protect, adminOnly, markPayoutPaid)

module.exports = router