const express = require("express")
const cors = require("cors")
const morgan = require("morgan")
require("dotenv").config()

// Routes
const authRoutes = require("./routes/authRoutes")
const examRoutes = require("./routes/examRoutes")
const paymentRoutes = require("./routes/paymentRoutes")
const attemptRoutes = require("./routes/attemptRoutes")
const employeeRoutes = require("./routes/employeeRoutes")
const bulkRoutes = require("./routes/bulkRoutes")
const webhookRoutes = require("./routes/webhookRoutes")

const app = express()

// ============ CORS ============
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
  allowedHeaders: ["Content-Type", "Authorization"]
}))

app.use(morgan("dev"))

// ============ WEBHOOKS — MUST COME BEFORE express.json() ============
//
// Razorpay signs the raw request body. express.json() parses and discards
// those exact bytes, and re-serialising the parsed object produces
// different bytes (key order, whitespace, unicode escaping), so every
// signature check would fail. webhookRoutes applies express.raw() itself.
//
// If you move this line below express.json(), webhook verification breaks
// silently — payments will still work through the browser, so you would
// only notice when a student closes their tab mid-payment.
app.use("/api/webhooks", webhookRoutes)

// ============ BODY PARSERS ============
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ limit: "10mb", extended: true }))

// ============ ROUTES ============
app.use("/api/auth", authRoutes)
app.use("/api/exams", examRoutes)
app.use("/api/payments", paymentRoutes)
app.use("/api/attempts", attemptRoutes)
app.use("/api/employees", employeeRoutes)
app.use("/api/bulk", bulkRoutes)

// ============ HEALTH CHECK ============
app.get("/", (req, res) => {
  res.status(200).json({
    message: "TalentExam API Running ✓",
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  })
})

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development"
  })
})

// ============ 404 HANDLER ============
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.path,
    method: req.method
  })
})

// ============ GLOBAL ERROR HANDLER ============
app.use((err, req, res, next) => {
  console.error("❌ Error:", err)

  const statusCode = err.statusCode || 500
  const message = err.message || "Internal Server Error"

  res.status(statusCode).json({
    message,
    statusCode,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack })
  })
})

// ============ SERVER START ============
const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`\n✅ Server running on port ${PORT}`)
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`)
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`)
  console.log(`🗄️  Database: ${process.env.DATABASE_URL ? "Connected" : "Not configured"}`)
  console.log(`🔔 Razorpay webhook: ${
    process.env.RAZORPAY_WEBHOOK_SECRET ? "configured" : "NOT configured — set RAZORPAY_WEBHOOK_SECRET"
  }\n`)
})

module.exports = app
