import { useState, useEffect, useRef } from "react"
import { useNavigate, Link } from "react-router-dom"

function ForgotPassword() {
  const navigate = useNavigate()

  // Form state
  const [step, setStep] = useState(1) // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [otpTimer, setOtpTimer] = useState(0)
  const [canResendOtp, setCanResendOtp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Refs
  const timerRef = useRef(null)
  const lastOtpRequestRef = useRef(0)

  // OTP Timer effect
  useEffect(() => {
    if (otpTimer > 0) {
      timerRef.current = setTimeout(() => {
        setOtpTimer((prev) => prev - 1)
      }, 1000)
    } else if (otpTimer === 0 && otpSent) {
      setCanResendOtp(true)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [otpTimer, otpSent])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Email validation
  const validateEmail = (emailStr) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(emailStr)
  }

  // Password validation
  const validatePassword = (pwd) => {
    if (pwd.length < 6) return "Password must be at least 6 characters"
    if (!/[A-Z]/.test(pwd)) return "Password must contain at least one uppercase letter"
    if (!/[0-9]/.test(pwd)) return "Password must contain at least one number"
    return null
  }

  // OTP format validation (6 digits)
  const validateOtp = (otpStr) => {
    return /^\d{6}$/.test(otpStr)
  }

  // Rate limit check (prevent OTP spam)
  const canRequestOtp = () => {
    const now = Date.now()
    const timeSinceLastRequest = now - lastOtpRequestRef.current
    return timeSinceLastRequest >= 30000 // 30 seconds cooldown
  }

  // Step 1: Request OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    // Validation
    if (!email.trim()) {
      setError("Email is required")
      return
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address")
      return
    }

    // Rate limiting
    if (!canRequestOtp()) {
      const secondsLeft = Math.ceil((30000 - (Date.now() - lastOtpRequestRef.current)) / 1000)
      setError(`Please wait ${secondsLeft} seconds before requesting another OTP`)
      return
    }

    setLoading(true)

    try {
      const response = await fetch("http://localhost:5000/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to send OTP")
      }

      setSuccess("OTP sent to your email address!")
      setOtpSent(true)
      setOtpTimer(300) // 5 minutes
      setCanResendOtp(false)
      lastOtpRequestRef.current = Date.now()
      setStep(2)

      // Clear success message
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError(err.message || "Failed to send OTP")
      console.error("Request OTP error:", err)
    } finally {
      setLoading(false)
    }
  }

  // Resend OTP
  const handleResendOtp = async () => {
    if (!canResendOtp) return

    setError("")
    setLoading(true)

    try {
      const response = await fetch("http://localhost:5000/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to resend OTP")
      }

      setSuccess("OTP resent to your email!")
      setOtpTimer(300)
      setCanResendOtp(false)
      lastOtpRequestRef.current = Date.now()

      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError(err.message || "Failed to resend OTP")
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError("")

    // Validation
    if (!otp.trim()) {
      setError("OTP is required")
      return
    }

    if (!validateOtp(otp)) {
      setError("OTP must be exactly 6 digits")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("http://localhost:5000/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Invalid OTP")
      }

      setSuccess("OTP verified successfully!")
      setStep(3)

      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError(err.message || "Failed to verify OTP")
      console.error("Verify OTP error:", err)
    } finally {
      setLoading(false)
    }
  }

  // Step 3: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError("")

    // Validation
    if (!newPassword || !confirmPassword) {
      setError("Both password fields are required")
      return
    }

    const passwordError = validatePassword(newPassword)
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("http://localhost:5000/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to reset password")
      }

      setSuccess("✓ Password reset successfully!")
      setTimeout(() => {
        navigate("/login")
      }, 2000)
    } catch (err) {
      setError(err.message || "Failed to reset password")
      console.error("Reset password error:", err)
    } finally {
      setLoading(false)
    }
  }

  // Go back to previous step
  const handleGoBack = () => {
    if (step > 1) {
      setStep(step - 1)
      setError("")
      setSuccess("")
    } else {
      navigate("/login")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold mb-2 text-center">Reset Password</h1>
        <p className="text-gray-500 text-center mb-6">
          {step === 1 && "Enter your email address"}
          {step === 2 && "Verify your OTP"}
          {step === 3 && "Create a new password"}
        </p>

        {/* Step Indicator */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full ${
                s <= step ? "bg-black" : "bg-gray-300"
              }`}
            ></div>
          ))}
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="mb-4 bg-red-100 text-red-700 p-3 rounded-lg border border-red-300 text-sm flex items-start gap-2">
            <span>⚠️</span>
            <div>
              <p className="font-semibold">Error</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-100 text-green-700 p-3 rounded-lg border border-green-300 text-sm flex items-start gap-2">
            <span>✓</span>
            <div>
              <p className="font-semibold">Success</p>
              <p>{success}</p>
            </div>
          </div>
        )}

        {/* Step 1: Email */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full border border-gray-300 p-3 rounded-lg text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white p-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition hover:bg-gray-900 active:scale-95"
            >
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>
          </form>
        )}

        {/* Step 2: OTP Verification */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                OTP (6 digits)
              </label>
              <input
                type="text"
                placeholder="000000"
                maxLength="6"
                className="w-full border border-gray-300 p-3 rounded-lg text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition text-center tracking-widest"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                disabled={loading}
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-500">
                  {otpTimer > 0 ? (
                    <span>
                      OTP expires in{" "}
                      <span className={otpTimer < 60 ? "text-red-600 font-bold" : ""}>
                        {Math.floor(otpTimer / 60)}:{String(otpTimer % 60).padStart(2, "0")}
                      </span>
                    </span>
                  ) : (
                    <span className="text-red-600 font-semibold">OTP expired</span>
                  )}
                </p>
              </div>
            </div>

            {canResendOtp ? (
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading}
                className="w-full text-sm border border-black text-black p-2 rounded-lg disabled:opacity-50 transition hover:bg-gray-50"
              >
                Resend OTP
              </button>
            ) : (
              <button
                type="button"
                disabled={true}
                className="w-full text-sm border border-gray-300 text-gray-500 p-2 rounded-lg disabled:opacity-50 cursor-not-allowed"
              >
                Resend available in {otpTimer > 0 ? `${otpTimer}s` : "..."}
              </button>
            )}

            <button
              type="submit"
              disabled={loading || otpTimer <= 0}
              className="w-full bg-black text-white p-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition hover:bg-gray-900 active:scale-95"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </form>
        )}

        {/* Step 3: New Password */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full border border-gray-300 p-3 rounded-lg text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition pr-10"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Minimum 6 characters, 1 uppercase letter, 1 number
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full border border-gray-300 p-3 rounded-lg text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition pr-10"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white p-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition hover:bg-gray-900 active:scale-95"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        {/* Navigation */}
        <div className="mt-6 text-center text-sm">
          {step > 1 && (
            <button
              onClick={handleGoBack}
              className="text-black underline hover:text-gray-700 transition mb-4"
            >
              ← Go Back
            </button>
          )}
          <div className="border-t pt-4">
            <p className="text-gray-600 mb-2">Remember your password?</p>
            <Link to="/login" className="text-black font-semibold underline hover:text-gray-700 transition">
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword