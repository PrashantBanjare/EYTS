const rateLimit = require("express-rate-limit")

// Shared config: count only failures where it makes sense, and always
// return JSON so the frontend's err.response.data.message keeps working.
const make = ({ windowMs, max, message, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    max,
    skipSuccessfulRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ message }),
  })

// Login: 8 failed attempts per 15 minutes per IP.
// skipSuccessfulRequests means a legitimate user logging in and out
// repeatedly is never locked out — only wrong passwords count.
const loginLimiter = make({
  windowMs: 15 * 60 * 1000,
  max: 8,
  skipSuccessfulRequests: true,
  message: "Too many failed sign-in attempts. Please wait 15 minutes and try again.",
})

// OTP requests: 3 per hour per IP. Each one sends an email, so this
// protects your Gmail quota as much as the account.
const otpLimiter = make({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: "Too many password reset requests. Please wait an hour before trying again.",
})

// OTP verification: 10 per 15 minutes. A 6-digit code has a million
// combinations, so unlimited guesses would eventually succeed.
const otpVerifyLimiter = make({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many incorrect codes. Please wait 15 minutes and try again.",
})

// Signup: 5 accounts per hour per IP, to blunt automated registration.
const signupLimiter = make({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many accounts created from this connection. Please try again later.",
})

module.exports = { loginLimiter, otpLimiter, otpVerifyLimiter, signupLimiter }