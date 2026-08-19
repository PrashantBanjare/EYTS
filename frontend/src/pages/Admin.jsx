import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"
import { AdminEmployees, AdminPayouts, AdminReferralCodes } from "./AdminEmployees"
import { AdminExamManager } from "./AdminExamManager"

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

      if (exam?.id) {
        try {
          const lbRes = await api.get(`/attempts/leaderboard/${exam.id}`)
          setLeaderboard(lbRes.data.leaderboard || [])
        } catch {
          // Results not released yet, or no submissions — not an error here.
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
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                ["Students", students.length],
                ["Paid", payments.filter(p => p.status === "PAID").length],
                ["Submissions", leaderboard.length],
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
                        <td className="px-4 py-3 font-medium">{s.name}</td>
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
                          <div className="flex gap-1 justify-center">
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

        {/* Payments */}
        {tab === "payments" && (
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
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium">{p.user?.name}</p>
                        <p className="text-xs text-gray-400">{p.user?.email}</p>
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
                          ${p.status === "PAID" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(p.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                        No payments yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
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

        {/* Questions */}
        {tab === "questions" && (
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="mb-6">
              <h2 className="font-semibold mb-3">
                Existing Questions ({sections.reduce((a, s) => a + (s.questions?.length || 0), 0)})
              </h2>
              {sections.length === 0 && (
                <p className="text-sm text-gray-400">No sections found for this exam.</p>
              )}
              {sections.map(sec => (
                <div key={sec.id} className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{sec.name}</p>
                  {(sec.questions || []).map((q, i) => (
                    <div key={q.id} className="flex items-center justify-between py-2 border-b text-sm">
                      <span className="text-gray-700 flex-1 pr-4">
                        {i + 1}. {q.text.length > 80 ? `${q.text.slice(0, 80)}…` : q.text}
                      </span>
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
                        className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-lg flex-shrink-0"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <hr className="mb-6" />

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
            {qError && <p className="text-red-500 text-sm mb-3">{qError}</p>}
            {qSuccess && <p className="text-green-600 text-sm mb-3">{qSuccess}</p>}
            <button onClick={handleAddQuestion}
              className="bg-black text-white px-6 py-2 rounded-lg text-sm">
              Add Question
            </button>
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
    </div>
  )
}

export default Admin