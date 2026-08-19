import { useEffect, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { attemptService, examService } from "../services/api"

function Leaderboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { examId: paramExamId } = useParams()
  const [searchParams] = useSearchParams()
  const queryExamId = searchParams.get("examId")

  // Get exam ID from params or query
  const examId = paramExamId || queryExamId

  const [leaderboard, setLeaderboard] = useState([])
  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
  const [resultsReleased, setResultsReleased] = useState(false)

  // Fetch leaderboard data
  useEffect(() => {
    const fetchLeaderboard = async () => {
      // Validation
      if (!examId) {
        setError("Invalid exam ID. Please select an exam first.")
        setLoading(false)
        return
      }

      // Validate exam ID format (UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(examId)) {
        setError("Invalid exam ID format")
        setLoading(false)
        return
      }

      setLoading(true)
      setError("")

      try {
        // Fetch exam details first
        const examResponse = await examService.getActive()
        const activeExam = examResponse.data?.exam

        if (!activeExam) {
          setError("Exam not found")
          setLoading(false)
          return
        }

        setExam(activeExam)

        // Check if results are released
        const now = new Date()
        const resultsAreReleased = !activeExam.resultReleaseAt || 
          now >= new Date(activeExam.resultReleaseAt)

        if (!resultsAreReleased) {
          setError(
            `Leaderboard will be available on ${new Date(
              activeExam.resultReleaseAt
            ).toLocaleString()}`
          )
          setResultsReleased(false)
          setLoading(false)
          return
        }

        setResultsReleased(true)

        // Fetch leaderboard
        const leaderboardResponse = await attemptService.getLeaderboard(examId)
        const leaderboardData = leaderboardResponse.data?.leaderboard || []

        if (!Array.isArray(leaderboardData)) {
          setError("Invalid leaderboard data received")
          setLeaderboard([])
          return
        }

        setLeaderboard(leaderboardData)
        setCurrentPage(1)
      } catch (err) {
        const errorMessage = err.response?.data?.message || "Failed to fetch leaderboard"
        setError(errorMessage)
        console.error("Leaderboard fetch error:", err)
        setLeaderboard([])
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [examId])

  // Filter leaderboard by search query
  const filteredLeaderboard = leaderboard.filter((entry) => {
    if (!searchQuery.trim()) return true

    const searchLower = searchQuery.toLowerCase()
    const userName = entry.user?.name?.toLowerCase() || ""
    const userEmail = entry.user?.email?.toLowerCase() || ""

    return userName.includes(searchLower) || userEmail.includes(searchLower)
  })

  // Pagination
  const totalPages = Math.ceil(filteredLeaderboard.length / itemsPerPage)
  const startIdx = (currentPage - 1) * itemsPerPage
  const endIdx = startIdx + itemsPerPage
  const paginatedLeaderboard = filteredLeaderboard.slice(startIdx, endIdx)

  // Find current user in leaderboard
  const currentUserRank = leaderboard.find((entry) => entry.user?.id === user?.id)

  // Handle page change
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 font-medium">Loading leaderboard...</p>
        </div>
      </div>
    )
  }

  // Error state - results not released
  if (error && !resultsReleased) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate("/dashboard")}
            className="mb-6 text-sm border border-gray-300 px-4 py-2 rounded-lg font-medium transition hover:bg-gray-50"
          >
            ← Back to Dashboard
          </button>

          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="text-5xl mb-4">⏳</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Leaderboard Coming Soon</h2>
            <p className="text-gray-600 mb-2">{error}</p>
            <p className="text-gray-500 text-sm">
              Check back once the exam results have been released.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Error state - general error
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate("/dashboard")}
            className="mb-6 text-sm border border-gray-300 px-4 py-2 rounded-lg font-medium transition hover:bg-gray-50"
          >
            ← Back to Dashboard
          </button>

          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate("/dashboard")}
              className="bg-black text-white px-6 py-2 rounded-lg font-medium transition hover:bg-gray-900"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Empty leaderboard state
  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate("/dashboard")}
            className="mb-6 text-sm border border-gray-300 px-4 py-2 rounded-lg font-medium transition hover:bg-gray-50"
          >
            ← Back to Dashboard
          </button>

          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="text-4xl mb-4">📊</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">No Submissions Yet</h2>
            <p className="text-gray-600 mb-6">
              The leaderboard will populate once students submit the exam.
            </p>
            <button
              onClick={() => navigate("/dashboard")}
              className="bg-black text-white px-6 py-2 rounded-lg font-medium transition hover:bg-gray-900"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Leaderboard</h1>
            <p className="text-gray-500 mt-1">{exam?.title}</p>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm border border-gray-300 px-4 py-2 rounded-lg font-medium transition hover:bg-gray-50"
          >
            ← Dashboard
          </button>
        </div>

        {/* Current User Info Card */}
        {currentUserRank && (
          <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-4">Your Position</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-blue-700 mb-1">Rank</p>
                <p className="text-2xl font-bold text-blue-900">
                  #{currentUserRank.rank || "—"}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-700 mb-1">Score</p>
                <p className="text-2xl font-bold text-blue-900">
                  {currentUserRank.totalScore}/{currentUserRank.totalQuestions}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-700 mb-1">Percentage</p>
                <p className="text-2xl font-bold text-blue-900">
                  {currentUserRank.percentage}%
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-700 mb-1">Percentile</p>
                <p className="text-2xl font-bold text-blue-900">
                  {currentUserRank.percentile !== null && currentUserRank.percentile !== undefined
                    ? `${currentUserRank.percentile}th`
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 mb-1">Total Submissions</p>
            <p className="text-2xl font-bold text-gray-900">{leaderboard.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 mb-1">Top Score</p>
            <p className="text-2xl font-bold text-gray-900">
              {leaderboard[0]?.totalScore || "—"}/
              {leaderboard[0]?.totalQuestions || "—"}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 mb-1">Average Score</p>
            <p className="text-2xl font-bold text-gray-900">
              {leaderboard.length > 0
                ? (
                    leaderboard.reduce((sum, entry) => sum + (entry.totalScore || 0), 0) /
                    leaderboard.length
                  ).toFixed(1)
                : "—"}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full border border-gray-300 p-3 rounded-lg text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition"
          />
          {searchQuery && (
            <p className="text-xs text-gray-500 mt-2">
              Showing {filteredLeaderboard.length} result{filteredLeaderboard.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Leaderboard Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Rank</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Email</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Score</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Percentage</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Percentile</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLeaderboard.map((entry, idx) => {
                  const isCurrentUser = entry.user?.id === user?.id
                  const rowClass = isCurrentUser
                    ? "bg-blue-50 border-l-4 border-blue-500"
                    : idx % 2 === 0
                    ? "bg-white"
                    : "bg-gray-50"

                  return (
                    <tr key={entry.id} className={rowClass}>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">
                        #{entry.rank || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="font-semibold text-gray-900">{entry.user?.name || "—"}</div>
                        {isCurrentUser && (
                          <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">
                            You
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{entry.user?.email || "—"}</td>
                      <td className="px-6 py-4 text-sm text-center">
                        <span className="font-bold text-gray-900">
                          {entry.totalScore || "—"}/{entry.totalQuestions || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        <span className="font-semibold text-gray-900">{entry.percentage || "—"}%</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        <span className="font-semibold text-gray-900">
                          {entry.percentile !== null && entry.percentile !== undefined
                            ? `${entry.percentile}th`
                            : "—"}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-2 p-4">
            {paginatedLeaderboard.map((entry) => {
              const isCurrentUser = entry.user?.id === user?.id
              const cardClass = isCurrentUser
                ? "bg-blue-50 border-2 border-blue-500"
                : "bg-gray-50 border border-gray-200"

              return (
                <div key={entry.id} className={`${cardClass} p-4 rounded-lg`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-gray-900">#{entry.rank || "—"}</p>
                        <p className="font-semibold text-gray-900">{entry.user?.name || "—"}</p>
                        {isCurrentUser && (
                          <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{entry.user?.email || "—"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="text-center">
                      <p className="text-gray-500 mb-1">Score</p>
                      <p className="font-bold text-gray-900">
                        {entry.totalScore}/{entry.totalQuestions}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 mb-1">%</p>
                      <p className="font-bold text-gray-900">{entry.percentage}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 mb-1">Percentile</p>
                      <p className="font-bold text-gray-900">
                        {entry.percentile !== null && entry.percentile !== undefined
                          ? `${entry.percentile}th`
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition hover:bg-gray-50"
            >
              ← Previous
            </button>

            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(Math.max(0, currentPage - 2), Math.min(totalPages, currentPage + 1))
                .map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-2 rounded-lg font-medium transition ${
                      currentPage === page
                        ? "bg-black text-white"
                        : "border border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </button>
                ))}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition hover:bg-gray-50"
            >
              Next →
            </button>

            <p className="text-sm text-gray-500 ml-4">
              Page {currentPage} of {totalPages}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Leaderboard