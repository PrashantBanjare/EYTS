import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { paymentService } from "../services/api"

function Payment() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [paymentStatus, setPaymentStatus] = useState(null)
  const [couponCode, setCouponCode] = useState("")
  const [discount, setDiscount] = useState(0)
  const [finalPrice, setFinalPrice] = useState(299)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [validatingCoupon, setValidatingCoupon] = useState(false)
  const [processingPayment, setProcessingPayment] = useState(false)

  const BASE_PRICE = 299

  // Check payment status on mount
  useEffect(() => {
    const checkPaymentStatus = async () => {
      setLoading(true)
      setError("")

      try {
        const response = await paymentService.getStatus()
        setPaymentStatus(response.data || null)

        // If already paid, redirect to dashboard
        if (response.data?.isPaid) {
          setSuccess("You already have exam access!")
          setTimeout(() => navigate("/dashboard"), 2000)
        }
      } catch (err) {
        const errorMessage = err.response?.data?.message || "Failed to check payment status"
        setError(errorMessage)
        console.error("Payment status check error:", err)
      } finally {
        setLoading(false)
      }
    }

    checkPaymentStatus()
  }, [navigate])

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.async = true
    script.onload = () => {
      console.log("✓ Razorpay script loaded")
    }
    script.onerror = () => {
      setError("Failed to load payment gateway. Please refresh and try again.")
    }
    document.body.appendChild(script)

    return () => {
      // Cleanup script if component unmounts
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [])

  // Validate coupon code format
  const validateCouponFormat = (code) => {
    if (!code || code.trim().length === 0) {
      return "Coupon code cannot be empty"
    }
    if (!/^[A-Z0-9]{3,20}$/.test(code.toUpperCase())) {
      return "Coupon code must be 3-20 alphanumeric characters"
    }
    return null
  }

  // Handle coupon validation
  const handleValidateCoupon = async (e) => {
    e.preventDefault()
    setError("")

    // Validation
    const formatError = validateCouponFormat(couponCode)
    if (formatError) {
      setError(formatError)
      return
    }

    setValidatingCoupon(true)

    try {
      const response = await paymentService.validateCoupon(couponCode)
      const data = response.data

      if (!data?.valid) {
        setError("Invalid coupon code")
        return
      }

      setDiscount(data.discount || 0)
      setFinalPrice(data.finalAmount || BASE_PRICE)
      setSuccess(`✓ Coupon applied! You save ₹${data.discount}`)

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Failed to validate coupon"
      setError(errorMessage)
      setDiscount(0)
      setFinalPrice(BASE_PRICE)
    } finally {
      setValidatingCoupon(false)
    }
  }

  // Handle payment creation and processing
  const handlePayment = async () => {
    // Validation
    if (!user?.id) {
      setError("User information missing")
      return
    }

    // Confirm payment
    const confirmPayment = confirm(
      `You are about to pay ₹${finalPrice} for exam access. Continue?`
    )
    if (!confirmPayment) return

    setProcessingPayment(true)
    setError("")

    try {
      // Step 1: Create order
      const orderResponse = await paymentService.createOrder(couponCode || undefined)
      const orderData = orderResponse.data

      if (!orderData?.orderId || !orderData?.keyId) {
        setError("Failed to create payment order")
        setProcessingPayment(false)
        return
      }

      // Step 2: Check if Razorpay is loaded
      if (!window.Razorpay) {
        setError("Payment gateway not loaded. Please refresh the page.")
        setProcessingPayment(false)
        return
      }

      // Step 3: Open Razorpay modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount * 100, // Convert to paise
        currency: orderData.currency || "INR",
        order_id: orderData.orderId,
        handler: async (response) => {
          try {
            // Step 4: Verify payment
            const verifyResponse = await paymentService.verifyPayment(
              orderData.orderId,
              response.razorpay_payment_id,
              response.razorpay_signature
            )

            if (verifyResponse.status === 200) {
              setSuccess("✓ Payment successful! Redirecting...")
              setTimeout(() => navigate("/dashboard"), 2000)
            } else {
              setError("Payment verification failed")
              setProcessingPayment(false)
            }
          } catch (err) {
            const errorMessage = err.response?.data?.message || "Payment verification failed"
            setError(errorMessage)
            setProcessingPayment(false)
            console.error("Verification error:", err)
          }
        },
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: user?.whatsappNumber ? `+91${user.whatsappNumber}` : ""
        },
        notes: {
          couponCode: couponCode || "NONE",
          discount: discount.toString()
        },
        theme: {
          color: "#0a1628"
        }
      }

      const razorpay = new window.Razorpay(options)
      
      // Handle payment close
      razorpay.on("payment.failed", (response) => {
        setError(`Payment failed: ${response.error.description}`)
        setProcessingPayment(false)
      })

      razorpay.open()
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Failed to process payment"
      setError(errorMessage)
      setProcessingPayment(false)
      console.error("Payment error:", err)
    }
  }

  // Clear coupon
  const handleClearCoupon = () => {
    setCouponCode("")
    setDiscount(0)
    setFinalPrice(BASE_PRICE)
    setError("")
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 font-medium">Loading payment page...</p>
        </div>
      </div>
    )
  }

  // Already paid
  if (paymentStatus?.isPaid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-green-600 mb-2">Payment Confirmed</h2>
          <p className="text-gray-600 mb-6">You already have exam access!</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-black text-white px-6 py-2 rounded-lg font-medium transition hover:bg-gray-900"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Exam Access Payment</h1>
            <p className="text-gray-500 mt-1">Secure payment powered by Razorpay</p>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm border border-gray-300 px-4 py-2 rounded-lg font-medium transition hover:bg-gray-50"
          >
            ← Back
          </button>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="mb-6 bg-red-100 text-red-700 p-4 rounded-lg border border-red-300 flex items-start gap-3 animate-slide-down">
            <span className="text-lg">⚠️</span>
            <div className="flex-1">
              <p className="font-semibold text-sm">Error</p>
              <p className="text-sm">{error}</p>
            </div>
            <button
              onClick={() => setError("")}
              className="text-red-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-100 text-green-700 p-4 rounded-lg border border-green-300 flex items-start gap-3 animate-slide-down">
            <span className="text-lg">✓</span>
            <div className="flex-1">
              <p className="font-semibold text-sm">Success</p>
              <p className="text-sm">{success}</p>
            </div>
            <button
              onClick={() => setSuccess("")}
              className="text-green-400 hover:text-green-600"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main Payment Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          {/* Student Info */}
          <div className="mb-6 pb-6 border-b">
            <h2 className="text-lg font-semibold mb-3">Student Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Name</p>
                <p className="font-semibold text-gray-900">{user?.name || "N/A"}</p>
              </div>
              <div>
                <p className="text-gray-500">Email</p>
                <p className="font-semibold text-gray-900">{user?.email || "N/A"}</p>
              </div>
              <div>
                <p className="text-gray-500">Phone</p>
                <p className="font-semibold text-gray-900">
                  {user?.whatsappNumber ? `+91 ${user.whatsappNumber}` : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="mb-6 pb-6 border-b">
            <h2 className="text-lg font-semibold mb-3">Price Breakdown</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Base Price</span>
                <span className="font-semibold">₹{BASE_PRICE}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between items-center text-sm text-green-600">
                  <span>Discount ({couponCode})</span>
                  <span className="font-semibold">-₹{discount}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-3 border-t text-lg font-bold">
                <span>Total Amount</span>
                <span>₹{finalPrice}</span>
              </div>
            </div>
          </div>

          {/* Coupon Section */}
          <div className="mb-6 pb-6 border-b">
            <h2 className="text-lg font-semibold mb-3">Apply Coupon Code</h2>
            <form onSubmit={handleValidateCoupon} className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Enter coupon code (optional)"
                className="flex-1 border border-gray-300 p-3 rounded-lg text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition disabled:bg-gray-100"
                disabled={validatingCoupon || processingPayment}
                maxLength="20"
              />
              {couponCode && (
                <button
                  type="button"
                  onClick={handleClearCoupon}
                  disabled={validatingCoupon || processingPayment}
                  className="px-3 py-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >
                  ✕
                </button>
              )}
              <button
                type="submit"
                disabled={validatingCoupon || processingPayment || !couponCode}
                className="bg-gray-800 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition hover:bg-gray-900"
              >
                {validatingCoupon ? "Validating..." : "Apply"}
              </button>
            </form>
            <p className="text-xs text-gray-400 mt-2">
              Have a coupon code? Enter it above to get a discount on your exam access.
            </p>
          </div>

          {/* Important Notes */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">ℹ️ Note:</span> Payment is secure and processed by Razorpay. You will receive a confirmation email after successful payment.
            </p>
          </div>

          {/* Payment Button */}
          <button
            onClick={handlePayment}
            disabled={processingPayment || paymentStatus?.isPaid}
            className="w-full bg-green-600 text-white px-6 py-4 rounded-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition hover:bg-green-700 active:scale-95"
          >
            {processingPayment ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Processing Payment...
              </span>
            ) : (
              `Pay ₹${finalPrice} & Get Exam Access`
            )}
          </button>
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-lg font-semibold mb-4">Frequently Asked Questions</h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold text-gray-900 mb-1">How long is exam access valid?</p>
              <p className="text-gray-600">Your exam access is valid for 12 months from the date of purchase.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">Can I get a refund?</p>
              <p className="text-gray-600">Refunds are available within 7 days of purchase if you haven't attempted the exam.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">Is my payment secure?</p>
              <p className="text-gray-600">Yes, all payments are encrypted and processed securely by Razorpay (PCI DSS certified).</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">What payment methods are accepted?</p>
              <p className="text-gray-600">We accept Credit Cards, Debit Cards, UPI, Net Banking, and Wallets.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Payment