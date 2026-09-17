const express = require("express")
const router = express.Router()
const { signup, login, getMe, getStudents, updateProfile, forgotPassword, verifyOtp, resetPassword, sendRegistrationOtp, verifyRegistrationOtp } = require("../controllers/authController")
const { loginLimiter, otpLimiter, otpVerifyLimiter, signupLimiter } = require("../middleware/rateLimiter")

const { protect, adminOnly } = require("../middleware/authMiddleware")

router.post("/signup", signupLimiter, signup)
router.post("/login", loginLimiter, login)
router.get("/me", protect, getMe)
router.patch("/profile", protect, updateProfile)
router.get("/students", protect, adminOnly, getStudents)
router.post("/forgot-password", otpLimiter, forgotPassword)
router.post("/verify-otp", otpVerifyLimiter, verifyOtp)
router.post("/reset-password", otpVerifyLimiter, resetPassword)
router.post("/send-registration-otp", otpLimiter, sendRegistrationOtp)
router.post("/verify-registration-otp", otpVerifyLimiter, verifyRegistrationOtp)

module.exports = router 