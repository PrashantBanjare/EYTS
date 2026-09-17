import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import api, { proctoringService } from "../services/api"
import { AdminEmployees, AdminPayouts, AdminReferralCodes } from "./AdminEmployees"
import { AdminExamManager } from "./AdminExamManager"

const MODE_LABEL = {
  OFF: "Not monitored",
  BROWSER_ONLY: "Activity only",
  FACE_DETECTION: "Camera, no images kept",
  FULL_RECORDING: "Camera, images stored",
}

function Admin() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState("overview")
  const [coupons, setCoupons] = useState([])
  const [newCoupon, setNewCoupon] = useState({ code: "", discount: 50, maxUses: "" })
  const [couponMsg, setCouponMsg] = useState("")
  const [students, setStudents] = useState([])
  const [payments, setPayments] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [examConfig, setExamConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [releaseDate, setReleaseDate] = useState("")
  const [fetchError, setFetchError] = useState("")

  const [sections, setSections] = useState([])
  const [newQ, setNewQ] = useState({
    sectionId: "", text: "", explanation: "",
    options: [
      { key: "A", text: "", isCorrect: true },
      { key: "B", text: "", isCorrect: false },
      { key: "C", text: "", isCorrect: false },
      { key: "D", text: "", isCorrect: false },
    ]
  })
  const [qSuccess, setQSuccess] = useState("")
  const [qError, setQError] = useState("")

  // ── question editing ──
  const [editingQ, setEditingQ] = useState(null)

  // ── section editing ──
  const [editingSection, setEditingSection] = useState(null)
  const [editingSectionName, setEditingSectionName] = useState("")

  // ── refund ──
  const [refundModal, setRefundModal] = useState(null)
  const [refundReason, setRefundReason] = useState("")
  const [refundNote, setRefundNote] = useState("")
  const [refundLoading, setRefundLoading] = useState(false)

  // ── proctoring ──
  const [flagged, setFlagged] = useState([])
  const [consents, setConsents] = useState([])
  const [report, setReport] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [snapshotView, setSnapshotView] = useState(null)
  const [studentProctoring, setStudentProctoring] = useState(null)

  // Exam id comes from the database, not a hardcoded constant, so this
  // panel keeps working if the exam is recreated.
  const examId = examConfig?.id || null

  useEffect(() => {
    if (user?.role !== "ADMIN") { navigate("/dashboard"); return }
    fetchAll()
  }, [user])

  const fetchAll = async () => {
    setFetchError("")
    try {
      // Fetch the exam first — the leaderboard call needs its id.
      const examRes = await api.get("/exams")
      const exam = examRes.data.exams?.[0] || null
      setExamConfig(exam)
      setSections(exam?.sections || [])
      if (exam?.resultReleaseAt) {
        setReleaseDate(new Date(exam.resultReleaseAt).toISOString().slice(0, 16))
      }
      if (exam?.sections?.[0]) setNewQ(q => ({ ...q, sectionId: exam.sections[0].id }))

      const [studRes, payRes, couponRes] = await Promise.all([
        api.get("/auth/students"),
        api.get("/payments/all"),
        api.get("/payments/coupons"),
      ])
      setStudents(studRes.data.students || [])
      setPayments(payRes.data.payments || [])
      setCoupons(couponRes.data.coupons || [])

      // Proctoring data is fetched separately: a failure here must not
      // take down the whole panel.
      try {
        const [flagRes, consentRes] = await Promise.all([
          proctoringService.getFlagged(),
          proctoringService.getAllConsents(),
        ])
        setFlagged(flagRes.data.attempts || [])
        setConsents(consentRes.data.consents || [])
      } catch (err) {
        console.error("proctoring fetch error:", err)
      }

      if (exam?.id) {
        try {
          const lbRes = await api.get(`/attempts/leaderboard/${exam.id}`)
          setLeaderboard(lbRes.data.leaderboard || [])
        } catch {
          setLeaderboard([])
        }
      } else {
        setLeaderboard([])
      }
    } catch (err) {
      console.error("Admin fetch error:", err)
      setFetchError(err.response?.data?.message || "Could not load some admin data")
    } finally {
      setLoading(false)
    }
  }

  const toggleExam = async () => {
    if (!examId) return alert("No exam found")
    try {
      await api.patch(`/exams/${examId}`, { isEnabled: !examConfig.isEnabled })
      setExamConfig(e => ({ ...e, isEnabled: !e.isEnabled }))
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update exam")
    }
  }

  const toggleReattempt = async () => {
    if (!examId) return alert("No exam found")
    try {
      await api.patch(`/exams/${examId}`, { allowReattempt: !examConfig.allowReattempt })
      setExamConfig(e => ({ ...e, allowReattempt: !e.allowReattempt }))
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update exam")
    }
  }

  const handleSetReleaseDate = async () => {
    if (!examId) return alert("No exam found")
    if (!releaseDate) { alert("Please select a date and time"); return }
    try {
      await api.patch(`/exams/${examId}`, { resultReleaseAt: new Date(releaseDate).toISOString() })
      setExamConfig(e => ({ ...e, resultReleaseAt: new Date(releaseDate).toISOString() }))
      alert("Result release date set successfully!")
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update release date")
    }
  }

  // ── proctoring: exam-wide mode ──
  const handleSetProctoringMode = async (mode) => {
    if (!examId) return alert("No exam found")
    try {
      await api.patch(`/exams/${examId}`, { proctoringMode: mode })
      setExamConfig(e => ({ ...e, proctoringMode: mode }))
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update proctoring mode")
    }
  }

  const handleToggleConsentRequirement = async () => {
    if (!examId) return alert("No exam found")
    const turningOff = examConfig.requireParentalConsent
    if (turningOff && !confirm(
      "Turn off parental consent?\n\n" +
      "Candidates under 18 will then sit camera-monitored examinations without a " +
      "parent's approval on record. Only do this if consent has been collected " +
      "another way."
    )) return

    try {
      await api.patch(`/exams/${examId}`, { requireParentalConsent: !examConfig.requireParentalConsent })
      setExamConfig(e => ({ ...e, requireParentalConsent: !e.requireParentalConsent }))
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update consent requirement")
    }
  }

  // ── proctoring: per-student override ──
  const handleSetStudentProctoring = async (userId, data) => {
    try {
      await proctoringService.setStudentProctoring(userId, data)
      setStudentProctoring(null)
      fetchAll()
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update the candidate's settings")
    }
  }

  // ── proctoring: open one report ──
  const openReport = async (attemptId) => {
    setReportLoading(true)
    setReport(null)
    try {
      const res = await proctoringService.getReport(attemptId)
      setReport(res.data)
    } catch (err) {
      alert(err.response?.data?.message || "Could not load the report")
    } finally {
      setReportLoading(false)
    }
  }

  const openSnapshot = async (id) => {
    try {
      const res = await proctoringService.getSnapshot(id)
      setSnapshotView(res.data.snapshot)
    } catch (err) {
      alert("Could not load the image")
    }
  }

  const handleAddQuestion = async () => {
    setQError(""); setQSuccess("")
    if (!newQ.sectionId) {
      setQError("Create a section for this exam first"); return
    }
    if (!newQ.text || newQ.options.some(o => !o.text)) {
      setQError("Fill all fields"); return
    }
    try {
      await api.post("/exams/questions", newQ)
      setQSuccess("Question added successfully!")
      setNewQ(q => ({ ...q, text: "", explanation: "", options: q.options.map(o => ({ ...o, text: "" })) }))
      fetchAll()
      setTimeout(() => setQSuccess(""), 3000)
    } catch (err) {
      setQError(err.response?.data?.message || "Failed to add question")
    }
  }

  const handleSaveQuestion = async () => {
    setQError(""); setQSuccess("")
    if (!editingQ.text || editingQ.options.some(o => !o.text)) {
      setQError("Fill all fields"); return
    }
    const correctCount = editingQ.options.filter(o => o.isCorrect).length
    if (correctCount !== 1) {
      setQError("Exactly one option must be marked correct"); return
    }
    try {
      await api.patch(`/exams/questions/${editingQ.id}`, {
        text: editingQ.text,
        explanation: editingQ.explanation,
        options: editingQ.options.map(o => ({
          key: o.key, text: o.text, isCorrect: o.isCorrect
        }))
      })
      setEditingQ(null)
      fetchAll()
    } catch (err) {
      setQError(err.response?.data?.message || "Failed to update question")
    }
  }

  const handleRenameSection = async (sectionId) => {
    if (!editingSectionName.trim()) return
    try {
      await api.patch(`/exams/sections/${sectionId}`, { name: editingSectionName })
      setEditingSection(null)
      setEditingSectionName("")
      fetchAll()
    } catch (err) {
      alert(err.response?.data?.message || "Failed to rename section")
    }
  }

  const handleDeleteSection = async (sectionId, sectionName) => {
    if (!confirm(`Delete section "${sectionName}"?`)) return
    try {
      await api.delete(`/exams/sections/${sectionId}`)
      fetchAll()
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete section")
    }
  }

  const handleRefund = async () => {
    if (!refundReason) { alert("Please select a refund reason"); return }
    setRefundLoading(true)
    try {
      const res = await api.post("/payments/refund", {
        paymentId: refundModal.id,
        reason: refundReason,
        note: refundNote || undefined,
      })
      alert(res.data.message + (res.data.commissionNote ? `\n\n${res.data.commissionNote}` : ""))
      setRefundModal(null)
      setRefundReason("")
      setRefundNote("")
      fetchAll()
    } catch (err) {
      alert(err.response?.data?.message || "Refund failed")
    } finally {
      setRefundLoading(false)
    }
  }

  const exportCSV = () => {
    const rows = [["Rank", "Name", "Email", "Score", "Percentage", "Percentile", "Time", "Submitted"]]
    leaderboard.forEach(r => rows.push([
      r.rank, r.user?.name, r.user?.email,
      `${r.totalScore}/${r.totalQuestions}`,
      r.percentage + "%", r.percentile + "th",
      `${Math.floor(r.timeTaken / 60)}:${String(r.timeTaken % 60).padStart(2, "0")}`,
      new Date(r.submittedAt).toLocaleString()
    ]))
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "results.csv"
    a.click()
  }

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "students", label: "Students" },
    { id: "exams", label: "Exams" },
    { id: "employees", label: "Employees" },
    { id: "payouts", label: "Payouts" },
    { id: "payments", label: "Payments" },
    { id: "coupons", label: "Coupons" },
    { id: "results", label: "Results" },
    { id: "questions", label: "Questions" },
    { id: "proctoring", label: "Proctoring" },
    { id: "settings", label: "Settings" },
  ]

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Loading admin panel...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <div className="bg-white shadow-sm px-6 py-3 flex items-center justify-between">
        <h1 className="font-bold text-lg">Admin Panel</h1>
        <div className="flex gap-3 items-center">
          <span className="text-sm text-gray-500">{user?.name}</span>
          <button onClick={() => { logout(); navigate("/login") }}
            className="text-sm bg-black text-white px-4 py-1.5 rounded-lg">
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {fetchError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg mb-4 text-sm flex items-start justify-between gap-3">
            <span>{fetchError}</span>
            <button onClick={() => setFetchError("")} className="text-amber-500">✕</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${tab === t.id ? "bg-black text-white" : "bg-white text-gray-600 border"}`}>
              {t.label}
              {t.id === "proctoring" && flagged.length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {flagged.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {[
                ["Students", students.length],
                ["Paid", payments.filter(p => p.status === "PAID").length],
                ["Submissions", leaderboard.length],
                ["Flagged", flagged.length],
                ["Exam", examConfig?.isEnabled ? "Active" : "Disabled"],
              ].map(([label, value]) => (
                <div key={label} className="bg-white rounded-2xl shadow p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className="text-2xl font-bold">{value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-semibold mb-4">Recent Submissions</h2>
              {leaderboard.slice(0, 5).map(r => (
                <div key={r.id} className="flex justify-between items-center py-2 border-b last:border-0 text-sm">
                  <span className="font-medium">{r.user?.name}</span>
                  <span className="text-blue-500 font-semibold">{r.totalScore}/{r.totalQuestions}</span>
                  <span className="text-gray-400 text-xs">{new Date(r.submittedAt).toLocaleString()}</span>
                </div>
              ))}
              {leaderboard.length === 0 && <p className="text-gray-400 text-sm">No submissions yet.</p>}
            </div>
          </>
        )}

        {/* Students */}
        {tab === "students" && (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Phone</th>
                    <th className="px-4 py-3 text-left">Referred by</th>
                    <th className="px-4 py-3 text-center">Payment</th>
                    <th className="px-4 py-3 text-center">Exam</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => {
                    const paid = payments.find(p => p.userId === s.id && p.status === "PAID")
                    const attempted = leaderboard.find(r => r.userId === s.id)
                    return (
                      <tr key={s.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">
                          {s.name}
                          {typeof s.age === "number" && s.age < 18 && (
                            <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                              Under 18
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{s.email}</td>
                        <td className="px-4 py-3 text-gray-500">{s.whatsappNumber || "—"}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {s.referredBy
                            ? <span title={s.referredBy.employeeCode}>{s.referredBy.name}</span>
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                            ${paid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {paid ? "Paid" : "Unpaid"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                            ${attempted ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                            {attempted ? "Done" : "Pending"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex gap-1 justify-center flex-wrap">
                            {attempted && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Reset ${s.name}'s exam attempt?`)) return
                                  try {
                                    await api.delete(`/attempts/reset/${s.id}`)
                                    alert("Attempt reset.")
                                    fetchAll()
                                  } catch (err) {
                                    alert(err.response?.data?.message || "Failed to reset")
                                  }
                                }}
                                className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg"
                              >
                                Retry
                              </button>
                            )}
                            {!paid && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Grant free exam access to ${s.name}?\n\nNote: free access earns the referring employee no commission.`)) return
                                  try {
                                    await api.post("/payments/grant-access", { userId: s.id })
                                    alert(`Free access granted to ${s.name}`)
                                    fetchAll()
                                  } catch (err) {
                                    alert(err.response?.data?.message || "Failed to grant access")
                                  }
                                }}
                                className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg"
                              >
                                Free Access
                              </button>
                            )}
                            <button
                              onClick={() => setStudentProctoring({
                                ...s,
                                proctoringOverride: s.proctoringOverride || "",
                                consentWaived: !!s.consentWaived,
                              })}
                              className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-lg"
                            >
                              Proctoring
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                        No students registered yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Exams */}
        {tab === "exams" && <AdminExamManager />}

        {/* Employees */}
        {tab === "employees" && <AdminEmployees />}

        {/* Payouts */}
        {tab === "payouts" && <AdminPayouts />}

        {/* Payments — WITH REFUND */}
        {tab === "payments" && (
          <>
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Student</th>
                      <th className="px-4 py-3 text-left">Amount</th>
                      <th className="px-4 py-3 text-left">Transaction ID</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium">{p.user?.name}</p>
                          <p className="text-xs text-gray-400">{p.user?.email}</p>
                          {p.user?.referredBy && (
                            <p className="text-xs text-blue-500">via {p.user.referredBy.name}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          ₹{p.amount}
                          {p.discount > 0 && (
                            <span className="text-xs text-green-600 ml-1">(−₹{p.discount})</span>
                          )}
                          {p.isFreeAccess && (
                            <span className="text-xs text-blue-600 ml-1">(Free)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{p.transactionId || "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                            ${p.status === "PAID" ? "bg-green-100 text-green-700"
                              : p.status === "REFUNDED" ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {new Date(p.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {p.status === "PAID" && !p.isFreeAccess && p.amount > 0 && (
                            <button
                              onClick={() => { setRefundModal(p); setRefundReason(""); setRefundNote("") }}
                              className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-lg"
                            >
                              Refund
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {payments.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                          No payments yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Refund modal */}
            {refundModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                  <h2 className="font-bold text-lg mb-1">Process Refund</h2>
                  <p className="text-sm text-gray-500 mb-4">
                    Refunding ₹{refundModal.amount} to {refundModal.user?.name}
                  </p>

                  <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Transaction</span>
                      <span className="font-mono text-xs">{refundModal.transactionId || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Amount</span>
                      <span className="font-semibold">₹{refundModal.amount}</span>
                    </div>
                    {refundModal.user?.referredBy && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Referred by</span>
                        <span className="text-xs">{refundModal.user.referredBy.name}</span>
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">
                      Reason *
                    </label>
                    <select
                      className="w-full border p-2.5 rounded-lg text-sm"
                      value={refundReason}
                      onChange={e => setRefundReason(e.target.value)}
                    >
                      <option value="">Select a reason</option>
                      <option value="COMPANY_FAULT">Company fault — commission stands</option>
                      <option value="CANDIDATE_REQUEST">Candidate request — commission stands</option>
                      <option value="AGENT_MISCONDUCT">Agent misconduct — commission reversed</option>
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">
                      Internal note (optional)
                    </label>
                    <textarea
                      className="w-full border p-2.5 rounded-lg text-sm"
                      rows={2}
                      placeholder="For the office record"
                      value={refundNote}
                      onChange={e => setRefundNote(e.target.value)}
                    />
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 mb-4">
                    ⚠️ Examination access will be withdrawn. Submitted attempts and results are kept as evidence.
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setRefundModal(null); setRefundReason(""); setRefundNote("") }}
                      className="flex-1 border py-2.5 rounded-xl text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRefund}
                      disabled={refundLoading || !refundReason}
                      className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                    >
                      {refundLoading ? "Processing..." : "Confirm Refund"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Coupons */}
        {tab === "coupons" && (
          <div>
            <AdminReferralCodes />
            {/* Create coupon */}
            <div className="bg-white rounded-2xl shadow p-6 mb-6 max-w-lg">
              <h2 className="font-semibold mb-4">Create Coupon Code</h2>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Code</label>
                  <input
                    className="w-full border rounded-lg p-2 text-sm uppercase"
                    placeholder="e.g. SAVE50"
                    value={newCoupon.code}
                    onChange={e => setNewCoupon(c => ({ ...c, code: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg p-2 text-sm"
                    placeholder="50"
                    value={newCoupon.discount}
                    onChange={e => setNewCoupon(c => ({ ...c, discount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Max Uses</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg p-2 text-sm"
                    placeholder="Unlimited"
                    value={newCoupon.maxUses}
                    onChange={e => setNewCoupon(c => ({ ...c, maxUses: e.target.value }))}
                  />
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs text-gray-500">
                💡 Base price is ₹299. With ₹50 discount coupon, student pays <strong>₹249</strong>.
              </div>
              {couponMsg && (
                <p className={`text-sm mb-3 ${couponMsg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
                  {couponMsg}
                </p>
              )}
              <button
                onClick={async () => {
                  if (!newCoupon.code || !newCoupon.discount) {
                    setCouponMsg("Code and discount are required"); return
                  }
                  try {
                    await api.post("/payments/coupons", {
                      code: newCoupon.code,
                      discount: newCoupon.discount,
                      maxUses: newCoupon.maxUses || null
                    })
                    setCouponMsg("✓ Coupon created successfully!")
                    setNewCoupon({ code: "", discount: 50, maxUses: "" })
                    fetchAll()
                  } catch (err) {
                    setCouponMsg(err.response?.data?.message || "Failed to create coupon")
                  }
                }}
                className="bg-black text-white px-6 py-2 rounded-lg text-sm"
              >
                Create Coupon
              </button>
            </div>

            {/* Coupon list */}
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Code</th>
                      <th className="px-4 py-3 text-center">Discount</th>
                      <th className="px-4 py-3 text-center">Final Price</th>
                      <th className="px-4 py-3 text-center">Used</th>
                      <th className="px-4 py-3 text-center">Max Uses</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map(c => (
                      <tr key={c.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-bold">{c.code}</td>
                        <td className="px-4 py-3 text-center text-green-600 font-semibold">₹{c.discount}</td>
                        <td className="px-4 py-3 text-center font-semibold">₹{299 - c.discount}</td>
                        <td className="px-4 py-3 text-center">{c.usedCount}</td>
                        <td className="px-4 py-3 text-center">{c.maxUses || "Unlimited"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                            ${c.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {c.isActive ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={async () => {
                              try {
                                await api.patch(`/payments/coupons/${c.id}`)
                                fetchAll()
                              } catch (err) {
                                alert(err.response?.data?.message || "Failed to update coupon")
                              }
                            }}
                            className={`text-xs px-3 py-1 rounded-lg
                              ${c.isActive ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}
                          >
                            {c.isActive ? "Disable" : "Enable"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {coupons.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                          No coupons created yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {tab === "results" && (
          <>
            <div className="flex justify-end mb-4">
              <button
                onClick={exportCSV}
                disabled={leaderboard.length === 0}
                className="text-sm border px-4 py-2 rounded-lg disabled:opacity-50"
              >
                ⬇ Export CSV
              </button>
            </div>
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Rank</th>
                      <th className="px-4 py-3 text-left">Student</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3 text-center">%</th>
                      <th className="px-4 py-3 text-center">Percentile</th>
                      <th className="px-4 py-3 text-center">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map(r => (
                      <tr key={r.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3 font-bold">#{r.rank}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{r.user?.name}</p>
                          <p className="text-xs text-gray-400">{r.user?.email}</p>
                        </td>
                        <td className="px-4 py-3 text-center font-mono">{r.totalScore}/{r.totalQuestions}</td>
                        <td className="px-4 py-3 text-center">{r.percentage}%</td>
                        <td className="px-4 py-3 text-center">{r.percentile}th</td>
                        <td className="px-4 py-3 text-center font-mono text-gray-500">
                          {Math.floor(r.timeTaken / 60)}:{String(r.timeTaken % 60).padStart(2, "0")}
                        </td>
                      </tr>
                    ))}
                    {leaderboard.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                          No results yet. Results also stay hidden until the release date has passed.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Questions — WITH EDIT + SECTION MANAGEMENT */}
        {tab === "questions" && (
          <div className="space-y-6">

            {/* Section management */}
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-semibold mb-4">Sections</h2>
              {sections.length === 0 && (
                <p className="text-sm text-gray-400">No sections found for this exam.</p>
              )}
              {sections.map((sec, idx) => (
                <div key={sec.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  {editingSection === sec.id ? (
                    <div className="flex gap-2 flex-1 mr-3">
                      <input
                        className="flex-1 border p-1.5 rounded-lg text-sm"
                        value={editingSectionName}
                        onChange={e => setEditingSectionName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleRenameSection(sec.id)}
                        autoFocus
                      />
                      <button onClick={() => handleRenameSection(sec.id)}
                        className="text-xs bg-black text-white px-3 py-1 rounded-lg">Save</button>
                      <button onClick={() => setEditingSection(null)}
                        className="text-xs border px-3 py-1 rounded-lg">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-xs text-gray-400 w-4">{idx + 1}</span>
                      <span className="text-sm font-medium">{sec.name}</span>
                      <span className="text-xs text-gray-400">
                        ({sec.questions?.length || 0} questions)
                      </span>
                    </div>
                  )}
                  {editingSection !== sec.id && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingSection(sec.id); setEditingSectionName(sec.name) }}
                        className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-lg"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => handleDeleteSection(sec.id, sec.name)}
                        className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-lg"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Question list */}
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-semibold mb-4">
                Existing Questions ({sections.reduce((a, s) => a + (s.questions?.length || 0), 0)})
              </h2>

              {sections.map(sec => (
                <div key={sec.id} className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{sec.name}</p>
                  {(sec.questions || []).map((q, i) => (
                    <div key={q.id} className="flex items-center justify-between py-2 border-b text-sm">
                      <span className="text-gray-700 flex-1 pr-4">
                        {i + 1}. {q.text.length > 70 ? `${q.text.slice(0, 70)}…` : q.text}
                      </span>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => setEditingQ({
                            ...q,
                            options: (q.options || []).map(o => ({ ...o }))
                          })}
                          className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-lg"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm("Delete this question?")) return
                            try {
                              await api.delete(`/exams/questions/${q.id}`)
                              fetchAll()
                            } catch (err) {
                              alert(err.response?.data?.message || "Failed to delete question")
                            }
                          }}
                          className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-lg"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                  {(sec.questions || []).length === 0 && (
                    <p className="text-xs text-gray-400 py-2">No questions in this section yet</p>
                  )}
                </div>
              ))}
            </div>

            {/* Edit question modal */}
            {editingQ && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                  <h3 className="font-bold text-lg mb-4">Edit Question</h3>
                  <div className="mb-3">
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                      Question Text
                    </label>
                    <textarea className="w-full border rounded-lg p-2 text-sm" rows={3}
                      value={editingQ.text}
                      onChange={e => setEditingQ(q => ({ ...q, text: e.target.value }))} />
                  </div>
                  {editingQ.options.map((opt, i) => (
                    <div key={opt.key} className="mb-2 flex gap-2 items-center">
                      <span className="text-sm font-bold w-5">{opt.key}</span>
                      <input className="flex-1 border rounded-lg p-2 text-sm"
                        value={opt.text}
                        onChange={e => {
                          const opts = [...editingQ.options]
                          opts[i] = { ...opts[i], text: e.target.value }
                          setEditingQ(q => ({ ...q, options: opts }))
                        }} />
                      <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                        <input type="radio" name="editCorrect" checked={opt.isCorrect}
                          onChange={() => {
                            const opts = editingQ.options.map((o, j) => ({ ...o, isCorrect: j === i }))
                            setEditingQ(q => ({ ...q, options: opts }))
                          }} />
                        Correct
                      </label>
                    </div>
                  ))}
                  <div className="mb-4 mt-3">
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                      Explanation
                    </label>
                    <input className="w-full border rounded-lg p-2 text-sm"
                      value={editingQ.explanation || ""}
                      onChange={e => setEditingQ(q => ({ ...q, explanation: e.target.value }))} />
                  </div>
                  {qError && <p className="text-red-500 text-sm mb-3">{qError}</p>}
                  <div className="flex gap-3">
                    <button onClick={() => { setEditingQ(null); setQError("") }}
                      className="flex-1 border py-2.5 rounded-xl text-sm font-medium">
                      Cancel
                    </button>
                    <button onClick={handleSaveQuestion}
                      className="flex-1 bg-black text-white py-2.5 rounded-xl text-sm font-medium">
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Add new question */}
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-semibold mb-4">Add New Question</h2>
              <div className="mb-4">
                <label className="text-xs text-gray-500 font-medium block mb-1">Section</label>
                <select className="w-full border rounded-lg p-2 text-sm"
                  value={newQ.sectionId}
                  onChange={e => setNewQ(q => ({ ...q, sectionId: e.target.value }))}>
                  {sections.length === 0 && <option value="">No sections available</option>}
                  {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <label className="text-xs text-gray-500 font-medium block mb-1">Question Text</label>
                <textarea className="w-full border rounded-lg p-2 text-sm" rows={3}
                  value={newQ.text}
                  onChange={e => setNewQ(q => ({ ...q, text: e.target.value }))} />
              </div>
              {newQ.options.map((opt, i) => (
                <div key={opt.key} className="mb-3 flex gap-3 items-center">
                  <span className="text-sm font-bold w-6">{opt.key}</span>
                  <input className="flex-1 border rounded-lg p-2 text-sm"
                    placeholder={`Option ${opt.key}`}
                    value={opt.text}
                    onChange={e => {
                      const updated = [...newQ.options]
                      updated[i] = { ...updated[i], text: e.target.value }
                      setNewQ(q => ({ ...q, options: updated }))
                    }} />
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    <input type="radio" name="correct"
                      checked={opt.isCorrect}
                      onChange={() => {
                        const updated = newQ.options.map((o, j) => ({ ...o, isCorrect: j === i }))
                        setNewQ(q => ({ ...q, options: updated }))
                      }} />
                    Correct
                  </label>
                </div>
              ))}
              <div className="mb-4">
                <label className="text-xs text-gray-500 font-medium block mb-1">Explanation (optional)</label>
                <input className="w-full border rounded-lg p-2 text-sm"
                  value={newQ.explanation}
                  onChange={e => setNewQ(q => ({ ...q, explanation: e.target.value }))} />
              </div>
              {qError && !editingQ && <p className="text-red-500 text-sm mb-3">{qError}</p>}
              {qSuccess && <p className="text-green-600 text-sm mb-3">{qSuccess}</p>}
              <button onClick={handleAddQuestion}
                className="bg-black text-white px-6 py-2 rounded-lg text-sm">
                Add Question
              </button>
            </div>
          </div>
        )}

        {/* ══ PROCTORING ══════════════════════════════════════════ */}
        {tab === "proctoring" && (
          <div className="space-y-6">

            {/* Exam-wide setting */}
            {examConfig ? (
              <div className="bg-white rounded-2xl shadow p-6">
                <h2 className="font-semibold mb-1">Monitoring for this examination</h2>
                <p className="text-xs text-gray-400 mb-5">
                  Applies to every candidate unless overridden individually
                </p>

                <div className="space-y-2 mb-6">
                  {[
                    ["OFF", "Off", "Nothing is watched or recorded"],
                    ["BROWSER_ONLY", "Activity only", "Tab switches, copy, paste, developer tools. No camera."],
                    ["FACE_DETECTION", "Camera, no images kept", "Detects absence and extra people. Nothing is stored."],
                    ["FULL_RECORDING", "Camera, images stored", "Still images captured periodically and kept for review."],
                  ].map(([value, label, desc]) => {
                    const active = (examConfig.proctoringMode || "OFF") === value
                    return (
                      <button key={value} onClick={() => handleSetProctoringMode(value)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all
                          ${active ? "border-black bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0
                            ${active ? "border-black bg-black" : "border-gray-300"}`} />
                          <span className="font-medium text-sm">{label}</span>
                          {value === "FULL_RECORDING" && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                              Stores images
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 ml-6">{desc}</p>
                      </button>
                    )
                  })}
                </div>

                <div className="flex items-start justify-between py-4 border-t gap-4">
                  <div>
                    <p className="font-medium text-sm">Require parental consent under 18</p>
                    <p className="text-xs text-gray-400 mt-0.5 max-w-md">
                      A parent must verify by email before a minor sits a camera-monitored
                      examination. Turning this off without consent collected elsewhere
                      creates legal exposure under the DPDP Act.
                    </p>
                  </div>
                  <button onClick={handleToggleConsentRequirement}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap
                      ${examConfig.requireParentalConsent
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"}`}>
                    {examConfig.requireParentalConsent ? "Required ✓" : "Not required"}
                  </button>
                </div>

                {examConfig.proctoringMode !== "OFF" && !examConfig.requireParentalConsent && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 mt-2">
                    ⚠️ Minors will sit this examination with the camera on and no parental
                    consent on record. Make sure consent has been collected another way.
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow p-6">
                <p className="text-sm text-gray-500">No exam found, so there is nothing to configure.</p>
              </div>
            )}

            {/* Flagged sittings */}
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <div className="p-6 pb-3">
                <h2 className="font-semibold">Sittings worth reviewing</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Sorted by risk. A score is a prompt to look, never a verdict on its own.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Candidate</th>
                      <th className="px-4 py-3 text-center">Mode</th>
                      <th className="px-4 py-3 text-center">Risk</th>
                      <th className="px-4 py-3 text-center">High</th>
                      <th className="px-4 py-3 text-center">Medium</th>
                      <th className="px-4 py-3 text-center">Total</th>
                      <th className="px-4 py-3 text-left">Submitted</th>
                      <th className="px-4 py-3 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {flagged.map(f => (
                      <tr key={f.attemptId} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium">{f.student?.name}</p>
                          <p className="text-xs text-gray-400">{f.student?.email}</p>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-500">
                          {MODE_LABEL[f.proctoringMode] || f.proctoringMode}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold
                            ${f.riskScore >= 60 ? "bg-red-100 text-red-700"
                              : f.riskScore >= 25 ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-600"}`}>
                            {f.riskScore}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-red-600 font-semibold">{f.highSeverity}</td>
                        <td className="px-4 py-3 text-center text-amber-600">{f.mediumSeverity}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{f.totalEvents}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {f.submittedAt ? new Date(f.submittedAt).toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => openReport(f.attemptId)}
                            className="text-xs bg-blue-100 text-blue-600 px-3 py-1 rounded-lg">
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                    {flagged.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                          Nothing flagged. Either the examinations were clean, or monitoring is off.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Consent records */}
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <div className="p-6 pb-3">
                <h2 className="font-semibold">Parental consent records</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Kept as evidence. Do not delete these while a candidate's result stands.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Candidate</th>
                      <th className="px-4 py-3 text-center">Age</th>
                      <th className="px-4 py-3 text-left">Parent / guardian</th>
                      <th className="px-4 py-3 text-left">Contact</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-left">Recorded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consents.map(c => (
                      <tr key={c.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium">{c.student?.name}</p>
                          <p className="text-xs text-gray-400">{c.student?.email}</p>
                        </td>
                        <td className="px-4 py-3 text-center">{c.student?.age ?? "—"}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{c.parentName}</p>
                          <p className="text-xs text-gray-400">{c.relationship || "—"}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          <p>{c.parentEmail}</p>
                          <p>{c.parentPhone}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                            ${c.verified ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                            {c.verified ? "Given" : "Pending"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {c.verifiedAt ? new Date(c.verifiedAt).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                    {consents.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                          No consent records yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Settings */}
        {tab === "settings" && (
          examConfig ? (
            <div className="bg-white rounded-2xl shadow p-6 max-w-lg">
              <h2 className="font-semibold mb-6">Exam Settings</h2>

              <div className="flex items-center justify-between py-4 border-b">
                <div>
                  <p className="font-medium text-sm">Exam Enabled</p>
                  <p className="text-xs text-gray-400">Allow students to take the exam</p>
                </div>
                <button onClick={toggleExam}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${examConfig.isEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {examConfig.isEnabled ? "Enabled ✓" : "Disabled"}
                </button>
              </div>

              <div className="flex items-center justify-between py-4 border-b">
                <div>
                  <p className="font-medium text-sm">Allow Reattempt</p>
                  <p className="text-xs text-gray-400">Students can retake the exam</p>
                </div>
                <button onClick={toggleReattempt}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${examConfig.allowReattempt ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {examConfig.allowReattempt ? "Enabled ✓" : "Disabled"}
                </button>
              </div>

              <div className="flex items-center justify-between py-4 border-b">
                <div>
                  <p className="font-medium text-sm">Proctoring</p>
                  <p className="text-xs text-gray-400">
                    {MODE_LABEL[examConfig.proctoringMode] || "Not monitored"}
                  </p>
                </div>
                <button onClick={() => setTab("proctoring")}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600">
                  Configure →
                </button>
              </div>

              <div className="py-4">
                <p className="font-medium text-sm mb-1">Result Release Date & Time</p>
                <p className="text-xs text-gray-400 mb-3">
                  Students can view full results only after this date and time
                </p>
                <div className="flex gap-2 items-center">
                  <input
                    type="datetime-local"
                    className="flex-1 border p-2 rounded-lg text-sm"
                    value={releaseDate}
                    onChange={e => setReleaseDate(e.target.value)}
                  />
                  <button
                    onClick={handleSetReleaseDate}
                    className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
                  >
                    Set Date
                  </button>
                </div>
                {examConfig?.resultReleaseAt && (
                  <p className="text-xs text-green-600 mt-2">
                    ✓ Results release on: {new Date(examConfig.resultReleaseAt).toLocaleString()}
                  </p>
                )}
                {!examConfig?.resultReleaseAt && (
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠ No release date set — results are hidden from students
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow p-6 max-w-lg">
              <p className="text-sm text-gray-500">
                No exam found in the database, so there is nothing to configure yet.
              </p>
            </div>
          )
        )}
      </div>

      {/* ══ Per-student proctoring modal ══════════════════════════ */}
      {studentProctoring && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="font-bold text-lg mb-1">Proctoring for {studentProctoring.name}</h2>
            <p className="text-sm text-gray-500 mb-5">
              {typeof studentProctoring.age === "number"
                ? `Age ${studentProctoring.age}${studentProctoring.age < 18 ? " — a minor" : ""}`
                : "Age not on record"}
            </p>

            <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">
              Monitoring for this candidate
            </label>
            <select className="w-full border p-2.5 rounded-lg text-sm mb-1"
              value={studentProctoring.proctoringOverride}
              onChange={e => setStudentProctoring(s => ({ ...s, proctoringOverride: e.target.value }))}>
              <option value="">
                Follow the exam setting ({MODE_LABEL[examConfig?.proctoringMode] || "Not monitored"})
              </option>
              <option value="OFF">Off — nothing watched</option>
              <option value="BROWSER_ONLY">Activity only — no camera</option>
              <option value="FACE_DETECTION">Camera, no images kept</option>
              <option value="FULL_RECORDING">Camera, images stored</option>
            </select>
            <p className="text-xs text-gray-400 mb-5">
              Use this for a candidate with no camera, an accommodation, or a supervised
              retake. It overrides the exam-wide setting for this person only.
            </p>

            {typeof studentProctoring.age === "number" && studentProctoring.age < 18 && (
              <label className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 cursor-pointer">
                <input type="checkbox" className="mt-0.5"
                  checked={studentProctoring.consentWaived}
                  onChange={e => setStudentProctoring(s => ({ ...s, consentWaived: e.target.checked }))} />
                <span className="text-xs text-amber-900">
                  <strong>Waive parental consent for this candidate.</strong> Only tick this
                  if consent has been collected on paper or in person. The waiver is logged
                  against your account.
                </span>
              </label>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStudentProctoring(null)}
                className="flex-1 border py-2.5 rounded-xl text-sm font-medium">
                Cancel
              </button>
              <button
                onClick={() => handleSetStudentProctoring(studentProctoring.id, {
                  proctoringOverride: studentProctoring.proctoringOverride || null,
                  consentWaived: studentProctoring.consentWaived,
                })}
                className="flex-1 bg-black text-white py-2.5 rounded-xl text-sm font-medium">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Proctoring report modal ═══════════════════════════════ */}
      {(report || reportLoading) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {reportLoading ? (
              <div className="p-10 text-center text-gray-500">Loading report…</div>
            ) : (
              <div className="p-6">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="font-bold text-lg">{report.attempt.student?.name}</h2>
                    <p className="text-sm text-gray-500">{report.attempt.student?.email}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {MODE_LABEL[report.attempt.proctoringMode] || report.attempt.proctoringMode}
                      {report.attempt.submittedAt &&
                        ` · submitted ${new Date(report.attempt.submittedAt).toLocaleString()}`}
                    </p>
                  </div>
                  <button onClick={() => setReport(null)} className="text-gray-400 text-xl leading-none">✕</button>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-6">
                  {[
                    ["Risk", report.summary.riskScore],
                    ["High", report.summary.highSeverity],
                    ["Medium", report.summary.mediumSeverity],
                    ["Images", report.summary.snapshotCount],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="text-xl font-bold">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 mb-6">
                  These signals show what the browser observed, not what the candidate
                  intended. A tab switch may be an accident and a missing face may be
                  bad lighting. Review the whole picture before acting.
                </div>

                {report.summary.snapshotCount > 0 && (
                  <>
                    <h3 className="font-semibold text-sm mb-2">Captured images</h3>
                    <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
                      {report.snapshots.map(s => (
                        <button key={s.id} onClick={() => openSnapshot(s.id)}
                          className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs border
                            ${s.flagged ? "border-red-300 bg-red-50 text-red-700" : "border-gray-200"}`}>
                          {new Date(s.capturedAt).toLocaleTimeString()}
                          {s.flagged && " ⚠"}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <h3 className="font-semibold text-sm mb-2">Event log</h3>
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Time</th>
                        <th className="px-3 py-2 text-left">Event</th>
                        <th className="px-3 py-2 text-center">Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.events.map(e => (
                        <tr key={e.id} className="border-t">
                          <td className="px-3 py-2 text-xs text-gray-500 font-mono">
                            {new Date(e.occurredAt).toLocaleTimeString()}
                          </td>
                          <td className="px-3 py-2 text-xs">{e.eventType.replace(/_/g, " ")}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold
                              ${e.severity === "HIGH" ? "bg-red-100 text-red-700"
                                : e.severity === "MEDIUM" ? "bg-amber-100 text-amber-700"
                                : "bg-gray-100 text-gray-500"}`}>
                              {e.severity}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {report.events.length === 0 && (
                        <tr><td colSpan={3} className="px-3 py-5 text-center text-gray-400 text-xs">
                          No events recorded
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Snapshot viewer ═══════════════════════════════════════ */}
      {snapshotView && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60] p-4"
          onClick={() => setSnapshotView(null)}>
          <div className="bg-white rounded-2xl p-4 max-w-lg" onClick={e => e.stopPropagation()}>
            <img src={snapshotView.imageData} alt="Captured frame" className="rounded-xl w-full" />
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-gray-500">
                {new Date(snapshotView.capturedAt).toLocaleString()}
                {snapshotView.flagReason && ` · ${snapshotView.flagReason}`}
              </p>
              <button onClick={() => setSnapshotView(null)}
                className="text-xs border px-3 py-1 rounded-lg">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Admin 