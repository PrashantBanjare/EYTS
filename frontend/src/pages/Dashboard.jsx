import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { paymentService, attemptService } from "../services/api"

function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [paymentStatus, setPaymentStatus] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError("")
    setRetrying(false)

    try {
      const [payRes, attRes] = await Promise.all([
        paymentService.getStatus(),
        attemptService.getMyAttempts()
      ])

      setPaymentStatus(payRes.data || null)
      setAttempts(Array.isArray(attRes.data?.attempts) ? attRes.data.attempts : [])
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Failed to load dashboard data"
      setError(errorMessage)
      console.error("Dashboard fetch error:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = async () => {
    setRetrying(true)
    await fetchData()
  }

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      logout()
      navigate("/login")
    }
  }

  // Get best attempt from all submitted attempts
  const bestAttempt = attempts && attempts.length > 0
    ? attempts
        .filter((a) => a.isSubmitted && a.result)
        .sort((a, b) => (b.result?.totalScore || 0) - (a.result?.totalScore || 0))[0]
    : null

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="flex-1 bg-black text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 transition hover:bg-gray-900"
            >
              {retrying ? "Retrying..." : "Retry"}
            </button>
            <button
              onClick={() => navigate("/login")}
              className="flex-1 border border-gray-300 px-4 py-2 rounded-lg font-medium transition hover:bg-gray-50"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Student Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Welcome back, <span className="font-semibold">{user?.name || "Student"}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => navigate("/profile")}
            className="text-sm border border-gray-300 px-4 py-2 rounded-lg font-medium transition hover:bg-gray-50"
          >
            My Profile
          </button>
          <button
            onClick={handleLogout}
            className="text-sm bg-black text-white px-5 py-2 rounded-lg font-medium transition hover:bg-gray-900"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white p-6 rounded-2xl shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Your Profile</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
          <div className="flex justify-between">
            <span className="text-gray-500">Name:</span>
            <span className="font-medium">{user?.name || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Email:</span>
            <span className="font-medium">{user?.email || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Phone:</span>
            <span className="font-medium">{user?.whatsappNumber || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Role:</span>
            <span className="font-medium capitalize">{user?.role || "N/A"}</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Payment Status */}
        <div className="bg-white p-5 rounded-2xl shadow">
          <p className="text-sm text-gray-500 mb-1">Payment Status</p>
          {paymentStatus?.isPaid ? (
            <>
              <p className="text-xl font-bold text-green-500">Paid ✓</p>
              <p className="text-xs text-gray-400 mt-2">Access Granted</p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-red-500">Unpaid</p>
              <button
                onClick={() => navigate("/payment")}
                className="mt-2 text-xs bg-black text-white px-3 py-1 rounded-lg font-medium transition hover:bg-gray-900"
              >
                Pay Now
              </button>
            </>
          )}
        </div>

        {/* Exam Status */}
        <div className="bg-white p-5 rounded-2xl shadow">
          <p className="text-sm text-gray-500 mb-1">Exam</p>
          <p className={`text-xl font-bold ${bestAttempt ? "text-blue-500" : "text-amber-500"}`}>
            {bestAttempt ? "Attempted" : "Pending"}
          </p>
          {paymentStatus?.isPaid && !bestAttempt && (
            <button
              onClick={() => navigate("/exam")}
              className="mt-2 text-xs bg-black text-white px-3 py-1 rounded-lg font-medium transition hover:bg-gray-900"
            >
              Start Exam
            </button>
          )}
          {!paymentStatus?.isPaid && (
            <p className="text-xs text-gray-400 mt-2">Complete payment first</p>
          )}
        </div>

        {/* Best Score */}
        <div className="bg-white p-5 rounded-2xl shadow">
          <p className="text-sm text-gray-500 mb-1">Best Score</p>
          <p className="text-xl font-bold text-purple-500">
            {bestAttempt && bestAttempt.result
              ? `${bestAttempt.result.totalScore}/${bestAttempt.result.totalQuestions}`
              : "—"}
          </p>
          {bestAttempt?.result && (
            <p className="text-xs text-gray-400 mt-2">{bestAttempt.result.percentage}%</p>
          )}
        </div>

        {/* Rank */}
        <div className="bg-white p-5 rounded-2xl shadow">
          <p className="text-sm text-gray-500 mb-1">Rank</p>
          <p className="text-xl font-bold text-green-500">
            {bestAttempt?.result?.rank ? `#${bestAttempt.result.rank}` : "—"}
          </p>
          {bestAttempt?.result?.percentile !== null && bestAttempt?.result?.percentile !== undefined && (
            <p className="text-xs text-gray-400 mt-2">{bestAttempt.result.percentile}th percentile</p>
          )}
        </div>
      </div>

      {/* Attempts History */}
      {attempts && attempts.length > 0 ? (
        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-lg font-semibold mb-4">Exam Attempts ({attempts.length})</h2>
          <div className="space-y-3">
            {attempts.map((a, i) => (
              <div key={a.id} className="flex items-center justify-between py-3 border-b last:border-0 hover:bg-gray-50 px-2 rounded transition">
                <div>
                  <p className="font-medium text-sm">{a.exam?.title || "Exam"} - Attempt #{i + 1}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(a.startedAt).toLocaleString()}
                  </p>
                </div>
                {a.isSubmitted && a.result ? (
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold">{a.result.totalScore}/{a.result.totalQuestions}</p>
                      <p className="text-xs text-gray-400">{a.result.percentage}%</p>
                    </div>
                    {!a.resultPending ? (
                      <button
                        onClick={() => navigate(`/result/${a.id}`)}
                        className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-lg font-medium transition hover:bg-gray-200"
                      >
                        View Result
                      </button>
                    ) : (
                      <span className="text-xs text-amber-500 font-medium">Results Pending</span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-amber-500 font-medium">In Progress</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-2xl shadow text-center">
          <div className="text-4xl mb-3">📝</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Attempts Yet</h3>
          <p className="text-gray-500 mb-4">You haven't attempted any exams yet.</p>
          {paymentStatus?.isPaid ? (
            <button
              onClick={() => navigate("/exam")}
              className="bg-black text-white px-6 py-2 rounded-lg font-medium transition hover:bg-gray-900"
            >
              Start Your First Exam →
            </button>
          ) : (
            <button
              onClick={() => navigate("/payment")}
              className="bg-black text-white px-6 py-2 rounded-lg font-medium transition hover:bg-gray-900"
            >
              Complete Payment First →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default Dashboard