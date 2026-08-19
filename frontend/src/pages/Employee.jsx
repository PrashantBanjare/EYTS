import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"

const NAVY = "#0a1628"
const GOLD = "#c9a84c"

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "enrollments", label: "My Enrollments" },
  { id: "earnings", label: "Earnings & Payouts" },
  { id: "tools", label: "Referral Tools" },
  { id: "notifications", label: "Notifications" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "profile", label: "My Profile" },
]

function Employee() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [tab, setTab] = useState(searchParams.get("tab") || "dashboard")
  const [summary, setSummary] = useState(null)
  const [enrollments, setEnrollments] = useState(null)
  const [earnings, setEarnings] = useState(null)
  const [notifications, setNotifications] = useState(null)
  const [leaderboard, setLeaderboard] = useState(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState("")

  const [enrollFilter, setEnrollFilter] = useState("all")
  const [search, setSearch] = useState("")

  const [kyc, setKyc] = useState({
    panNumber: "", bankAccountName: "", bankAccountNumber: "",
    bankIfsc: "", upiId: "",
    emergencyContactName: "", emergencyContactPhone: "",
  })
  const [kycEdit, setKycEdit] = useState(false)
  const [kycSaving, setKycSaving] = useState(false)
  const [kycMsg, setKycMsg] = useState("")
  const [kycError, setKycError] = useState("")

  // ── Guard ───────────────────────────────────────────────────────
  useEffect(() => {
    if (user && user.role !== "EMPLOYEE" && user.role !== "ADMIN") {
      navigate("/dashboard")
    }
  }, [user, navigate])

  const changeTab = (id) => {
    setTab(id)
    setSearchParams({ tab: id })
  }

  // ── Load everything the portal needs ────────────────────────────
  const loadAll = async () => {
    setLoading(true)
    setError("")
    try {
      const [sumRes, enrRes, earnRes, notifRes] = await Promise.all([
        api.get("/employees/me/summary"),
        api.get("/employees/me/enrollments"),
        api.get("/employees/me/earnings"),
        api.get("/employees/me/notifications"),
      ])
      setSummary(sumRes.data)
      setEnrollments(enrRes.data)
      setEarnings(earnRes.data)
      setNotifications(notifRes.data)

      const e = sumRes.data?.employee || {}
      setKyc({
        panNumber: e.panNumber || "",
        bankAccountName: e.bankAccountName || "",
        bankAccountNumber: e.bankAccountNumber || "",
        bankIfsc: e.bankIfsc || "",
        upiId: e.upiId || "",
        emergencyContactName: e.emergencyContactName || "",
        emergencyContactPhone: e.emergencyContactPhone || "",
      })
    } catch (err) {
      setError(err.response?.data?.message || "Could not load your portal. Please try again.")
      console.error("Employee portal error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    if (tab !== "leaderboard" || leaderboard) return
    api.get("/employees/leaderboard")
      .then((r) => setLeaderboard(r.data?.leaderboard || []))
      .catch(() => setLeaderboard([]))
  }, [tab, leaderboard])

  // ── Actions ─────────────────────────────────────────────────────
  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(""), 2000)
    } catch {
      setCopied("")
    }
  }

  const saveKyc = async () => {
    setKycError("")
    setKycMsg("")
    if (!kyc.upiId && !kyc.bankAccountNumber) {
      setKycError("Add either a UPI ID or a bank account so the office can pay you")
      return
    }
    setKycSaving(true)
    try {
      await api.patch("/employees/me/kyc", kyc)
      setKycMsg("Payout details saved")
      setKycEdit(false)
      setTimeout(() => setKycMsg(""), 3000)
    } catch (err) {
      setKycError(err.response?.data?.message || "Could not save your details")
    } finally {
      setKycSaving(false)
    }
  }

  const markRead = async (id) => {
    try {
      await api.patch(`/employees/me/notifications/${id}/read`)
      setNotifications((n) => ({
        ...n,
        unread: Math.max((n.unread || 1) - 1, 0),
        notifications: n.notifications.map((x) => (x.id === id ? { ...x, isRead: true } : x)),
      }))
    } catch (err) {
      console.error("markRead error:", err)
    }
  }

  const markAllRead = async () => {
    try {
      await api.patch("/employees/me/notifications/read-all")
      setNotifications((n) => ({
        ...n,
        unread: 0,
        notifications: n.notifications.map((x) => ({ ...x, isRead: true })),
      }))
    } catch (err) {
      console.error("markAllRead error:", err)
    }
  }

  // ── Formatters ──────────────────────────────────────────────────
  const rupees = (n) => `₹${(n ?? 0).toLocaleString("en-IN")}`
  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"
  const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("en-IN") : "—")

  // ── Loading / error ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin mb-4" />
          <p className="text-gray-500 font-medium">Loading your portal…</p>
        </div>
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Portal unavailable</h2>
          <p className="text-gray-600 mb-6 text-sm">{error}</p>
          <button
            onClick={loadAll}
            style={{ background: NAVY }}
            className="text-white px-6 py-2 rounded-lg font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const emp = summary?.employee || {}
  const rates = summary?.rates || {}
  const week = summary?.thisWeek || {}
  const life = summary?.lifetime || {}
  const task = summary?.currentTask || {}
  const link = summary?.referralLink || ""
  const kycComplete = !!(kyc.panNumber && (kyc.bankAccountNumber || kyc.upiId))

  const whatsappMessage =
    `Hello! I'm ${emp.name || "an EYTS representative"} from Excellence Youth Talent Search LLP.\n\n` +
    `Registration is open for TalentExam National 2026 — an all-India competitive examination with scholarships and prizes for top performers.\n\n` +
    `• 60 MCQ questions, 50 minutes\n` +
    `• Registration fee ₹299\n` +
    `• Results, rank and percentile published online\n\n` +
    `Register here: ${link}\n\n` +
    `Message me if you have any questions.`

  const filteredEnrollments = (enrollments?.enrollments || []).filter((r) => {
    if (enrollFilter === "paid" && !r.hasPaid) return false
    if (enrollFilter === "pending" && r.hasPaid) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return r.name?.toLowerCase().includes(q) || r.institutionName?.toLowerCase().includes(q)
  })

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── HEADER ── */}
      <header style={{ background: NAVY }} className="text-white">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <div
              style={{ background: GOLD, color: NAVY }}
              className="w-9 h-9 rounded-lg flex items-center justify-center font-black"
            >
              T
            </div>
            <div className="leading-tight">
              <p className="font-bold text-sm">
                ExcellenceYouth<span style={{ color: GOLD }}>TalentSearch LLP</span>
              </p>
              <p className="text-xs text-white/50">
                Employee portal · {emp.employeeCode || "—"}
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-2 flex-wrap text-sm">
            <button onClick={() => navigate("/")} className="px-3 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition">
              Home
            </button>
            <button
              onClick={() => changeTab("notifications")}
              className="px-3 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition relative"
            >
              Alerts
              {notifications?.unread > 0 && (
                <span
                  style={{ background: GOLD, color: NAVY }}
                  className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-bold"
                >
                  {notifications.unread}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                if (confirm("Log out of your account?")) {
                  logout()
                  navigate("/login")
                }
              }}
              style={{ background: GOLD, color: NAVY }}
              className="px-4 py-1.5 rounded-lg font-bold"
            >
              Log out
            </button>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        {/* ── KYC BANNER ── */}
        {!kycComplete && (
          <div
            style={{ borderLeftColor: GOLD }}
            className="bg-white border border-gray-200 border-l-4 rounded-r-xl p-4 mb-6 flex items-start justify-between gap-4 flex-wrap"
          >
            <div>
              <p className="font-semibold text-sm text-gray-900">Add your payout details</p>
              <p className="text-sm text-gray-600 mt-1">
                Your earnings are being tracked, but the office cannot transfer money until your PAN
                and either a bank account or UPI ID are on file.
              </p>
            </div>
            <button
              onClick={() => changeTab("profile")}
              style={{ background: NAVY }}
              className="text-white text-xs px-4 py-2 rounded-lg font-medium whitespace-nowrap"
            >
              Add details
            </button>
          </div>
        )}

        {/* ── TABS ── */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map((t) => {
            const active = tab === t.id
            const badge = t.id === "notifications" ? notifications?.unread : null
            return (
              <button
                key={t.id}
                onClick={() => changeTab(t.id)}
                style={active ? { background: NAVY } : {}}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  active ? "text-white" : "bg-white text-gray-600 border hover:bg-gray-50"
                }`}
              >
                {t.label}
                {badge ? (
                  <span
                    style={{ background: active ? GOLD : NAVY, color: active ? NAVY : "#fff" }}
                    className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-bold"
                  >
                    {badge}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {/* ═══════════ DASHBOARD ═══════════ */}
        {tab === "dashboard" && (
          <div className="space-y-6">
            {/* This week */}
            <div className="bg-white rounded-2xl shadow p-6">
              <div className="flex items-baseline justify-between flex-wrap gap-2 mb-5">
                <h2 className="font-semibold text-lg">This week</h2>
                <p className="text-xs text-gray-500">
                  {fmtDate(week.periodStart)} – {fmtDate(week.periodEnd)} · paid out after Sunday
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  ["Paid enrollments", week.enrollments ?? 0],
                  ["Commission", rupees(week.commissionAmount)],
                  ["Task salary", rupees(week.bonusAmount)],
                  ["Week total", rupees(week.totalAmount)],
                ].map(([label, value], i) => (
                  <div
                    key={label}
                    style={i === 3 ? { background: NAVY, color: "#fff" } : {}}
                    className={`rounded-xl p-4 ${i === 3 ? "" : "bg-gray-50"}`}
                  >
                    <p className={`text-xs mb-1 ${i === 3 ? "text-white/60" : "text-gray-500"}`}>
                      {label}
                    </p>
                    <p
                      className="text-2xl font-bold"
                      style={i === 3 ? { color: GOLD } : { color: NAVY }}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Task progress */}
            <div className="bg-white rounded-2xl shadow p-6">
              <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
                <h2 className="font-semibold text-lg">Task {task.number}</h2>
                <p className="text-sm text-gray-500">
                  {task.progress} of {task.target} paid enrollments
                </p>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Each completed task of {rates.taskTarget} paid enrollments pays{" "}
                {rupees(rates.taskBonus)} salary, on top of {rupees(rates.perEnrollment)} per
                enrollment.
              </p>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  style={{
                    width: `${Math.min(((task.progress || 0) / (task.target || 1)) * 100, 100)}%`,
                    background: GOLD,
                  }}
                  className="h-3 rounded-full transition-all"
                />
              </div>
              <p className="text-xs text-gray-500 mt-3">
                {task.remaining} more to finish this task · {life.tasksCompleted || 0} completed so far
              </p>
            </div>

            {/* Lifetime + payout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow p-6">
                <h2 className="font-semibold text-lg mb-4">Lifetime</h2>
                <div className="space-y-1 text-sm">
                  {[
                    ["Students referred", life.referred ?? 0],
                    ["Paid (qualifying)", life.qualified ?? 0],
                    ["Signed up, not yet paid", life.awaitingPayment ?? 0],
                    ["Tasks completed", life.tasksCompleted ?? 0],
                    ["Total earned", rupees(life.earned)],
                    ["Already paid to you", rupees(life.paidOut)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between py-2.5 border-b last:border-0">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-semibold">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow p-6">
                  <h2 className="font-semibold text-lg mb-1">Awaiting transfer</h2>
                  <p className="text-3xl font-bold mt-2" style={{ color: NAVY }}>
                    {rupees(summary?.pendingPayable)}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Earned but not yet transferred. Payouts run weekly.
                  </p>
                </div>

                <div className="bg-white rounded-2xl shadow p-6">
                  <h2 className="font-semibold text-lg mb-1">Last payout</h2>
                  {summary?.lastPayout ? (
                    <>
                      <p className="text-2xl font-bold mt-2" style={{ color: NAVY }}>
                        {rupees(summary.lastPayout.totalAmount)}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Paid {fmtDate(summary.lastPayout.paidAt)}
                        {summary.lastPayout.reference ? ` · ref ${summary.lastPayout.reference}` : ""}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 mt-2">
                      No payout yet. Your first one arrives after your first full week.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Follow-up prompt */}
            {life.awaitingPayment > 0 && (
              <div
                style={{ borderLeftColor: GOLD }}
                className="bg-white border border-gray-200 border-l-4 rounded-r-xl p-4 flex items-start justify-between gap-4 flex-wrap"
              >
                <div>
                  <p className="font-semibold text-sm text-gray-900">
                    {life.awaitingPayment} student{life.awaitingPayment === 1 ? "" : "s"} signed up
                    without paying
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Commission is credited only once the ₹299 fee is paid. A reminder often closes these.
                  </p>
                </div>
                <button
                  onClick={() => { changeTab("enrollments"); setEnrollFilter("pending") }}
                  style={{ background: NAVY }}
                  className="text-white text-xs px-4 py-2 rounded-lg font-medium whitespace-nowrap"
                >
                  See who
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════ ENROLLMENTS ═══════════ */}
        {tab === "enrollments" && (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="p-6 pb-4">
              <h2 className="font-semibold text-lg">My enrollments</h2>
              <p className="text-xs text-gray-500 mt-1">
                Everyone who registered through your link. Contact details are partly hidden to
                protect student privacy.
              </p>

              <div className="flex gap-2 mt-4 flex-wrap">
                {[
                  ["all", `All (${enrollments?.count || 0})`],
                  ["paid", `Paid (${enrollments?.qualified || 0})`],
                  ["pending", `Not paid (${enrollments?.awaitingPayment || 0})`],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setEnrollFilter(id)}
                    style={enrollFilter === id ? { background: NAVY } : {}}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      enrollFilter === id ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Search by name or institution…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-300 p-2.5 rounded-lg text-sm mt-4 focus:outline-none focus:border-black"
              />
            </div>

            {filteredEnrollments.length === 0 ? (
              <div className="px-6 pb-8 pt-2">
                <p className="text-sm text-gray-500">
                  {enrollments?.count === 0
                    ? "No one has registered through your link yet. Share it from the Referral Tools tab to get started."
                    : "No enrollments match this filter."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-6 py-3 text-left">Student</th>
                      <th className="px-6 py-3 text-left">Institution</th>
                      <th className="px-6 py-3 text-left">Registered</th>
                      <th className="px-6 py-3 text-center">Payment</th>
                      <th className="px-6 py-3 text-right">You earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEnrollments.map((r) => (
                      <tr key={r.studentId} className="border-t">
                        <td className="px-6 py-3">
                          <p className="font-medium">{r.name}</p>
                          <p className="text-xs text-gray-400">
                            {r.email} · {r.whatsappNumber}
                          </p>
                        </td>
                        <td className="px-6 py-3 text-gray-500">{r.institutionName}</td>
                        <td className="px-6 py-3 text-gray-500">{fmtDate(r.registeredAt)}</td>
                        <td className="px-6 py-3 text-center">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                              r.hasPaid
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {r.hasPaid ? `Paid ₹${r.amountPaid}` : "Not paid"}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right font-semibold">
                          {r.commissionStatus === "REVERSED" ? (
                            <span className="text-red-500 text-xs">Reversed</span>
                          ) : r.qualifies ? (
                            rupees(r.commissionAmount)
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══════════ EARNINGS ═══════════ */}
        {tab === "earnings" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-semibold text-lg mb-1">Awaiting transfer</h2>
              <p className="text-3xl font-bold mt-2" style={{ color: NAVY }}>
                {rupees(earnings?.pendingPayable)}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {rupees(rates.perEnrollment)} per paid enrollment, plus {rupees(rates.taskBonus)} for
                each completed task of {rates.taskTarget}.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <div className="p-6 pb-4">
                <h2 className="font-semibold text-lg">Weekly payouts</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Each row is one week's transfer from the office.
                </p>
              </div>
              {!earnings?.payouts?.length ? (
                <p className="px-6 pb-8 pt-2 text-sm text-gray-500">
                  No payouts yet. Your first arrives after your first full week of enrollments.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>
                        <th className="px-6 py-3 text-left">Week</th>
                        <th className="px-6 py-3 text-center">Enrollments</th>
                        <th className="px-6 py-3 text-right">Commission</th>
                        <th className="px-6 py-3 text-right">Task salary</th>
                        <th className="px-6 py-3 text-right">Total</th>
                        <th className="px-6 py-3 text-center">Status</th>
                        <th className="px-6 py-3 text-left">Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {earnings.payouts.map((p) => (
                        <tr key={p.id} className="border-t">
                          <td className="px-6 py-3 text-gray-600">
                            {fmtDate(p.periodStart)} – {fmtDate(p.periodEnd)}
                          </td>
                          <td className="px-6 py-3 text-center">{p.enrollmentCount}</td>
                          <td className="px-6 py-3 text-right">{rupees(p.commissionAmount)}</td>
                          <td className="px-6 py-3 text-right">{rupees(p.bonusAmount)}</td>
                          <td className="px-6 py-3 text-right font-bold">{rupees(p.totalAmount)}</td>
                          <td className="px-6 py-3 text-center">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                p.status === "PAID"
                                  ? "bg-green-100 text-green-700"
                                  : p.status === "PENDING"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {p.status === "PAID" ? `Paid ${fmtDate(p.paidAt)}` : p.status}
                            </span>
                          </td>
                          <td className="px-6 py-3 font-mono text-xs">{p.reference || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <div className="p-6 pb-4">
                <h2 className="font-semibold text-lg">Earnings ledger</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Every rupee credited to you, newest first.
                </p>
              </div>
              {!earnings?.commissions?.length ? (
                <p className="px-6 pb-8 pt-2 text-sm text-gray-500">Nothing credited yet.</p>
              ) : (
                <div className="divide-y max-h-[520px] overflow-y-auto">
                  {earnings.commissions.map((c) => (
                    <div
                      key={c.id}
                      className="px-6 py-3 flex items-center justify-between gap-4 flex-wrap"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {c.type === "TASK_BONUS" ? "Task salary" : "Enrollment commission"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {fmtDateTime(c.earnedAt)}
                          {c.note ? ` · ${c.note}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-bold ${
                            c.status === "REVERSED" ? "text-red-500 line-through" : ""
                          }`}
                        >
                          {rupees(c.amount)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {c.status === "PAID"
                            ? "Paid out"
                            : c.status === "REVERSED"
                            ? "Reversed"
                            : "Awaiting transfer"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════ REFERRAL TOOLS ═══════════ */}
        {tab === "tools" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-semibold text-lg mb-1">Your referral link</h2>
              <p className="text-xs text-gray-500 mb-5">
                Anyone who registers through this link is recorded against your ID. Commission is
                credited when they pay the ₹299 fee.
              </p>

              <div style={{ background: NAVY }} className="rounded-xl p-5 mb-4">
                <p className="text-xs text-white/50 uppercase tracking-wide mb-2">Referral code</p>
                <p className="text-3xl font-black tracking-wider" style={{ color: GOLD }}>
                  {emp.referralCode || "—"}
                </p>
              </div>

              <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                Share link
              </label>
              <div className="flex gap-2 flex-wrap">
                <input
                  readOnly
                  value={link}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-[220px] border border-gray-300 p-2.5 rounded-lg text-sm bg-gray-50 font-mono text-xs"
                />
                <button
                  onClick={() => copy(link, "link")}
                  style={{ background: NAVY }}
                  className="text-white px-5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap"
                >
                  {copied === "link" ? "Copied" : "Copy link"}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-semibold text-lg mb-1">Ready-to-send message</h2>
              <p className="text-xs text-gray-500 mb-4">
                Copy this into WhatsApp, or open WhatsApp with it already filled in.
              </p>
              <textarea
                readOnly
                value={whatsappMessage}
                rows={12}
                className="w-full border border-gray-300 p-3 rounded-lg text-sm bg-gray-50 font-mono text-xs"
              />
              <div className="flex gap-2 mt-3 flex-wrap">
                <button
                  onClick={() => copy(whatsappMessage, "msg")}
                  className="border px-5 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
                >
                  {copied === "msg" ? "Copied" : "Copy message"}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ background: "#25D366" }}
                  className="text-white px-5 py-2 rounded-lg text-sm font-medium"
                >
                  Open in WhatsApp
                </a>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-semibold text-lg mb-4">How you get paid</h2>
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  <span className="font-semibold text-gray-900">
                    {rupees(rates.perEnrollment)} per paid enrollment.
                  </span>{" "}
                  Credited the moment the student's ₹299 payment succeeds.
                </p>
                <p>
                  <span className="font-semibold text-gray-900">
                    {rupees(rates.taskBonus)} per completed task.
                  </span>{" "}
                  One task is {rates.taskTarget} paid enrollments. The bonus is added automatically
                  when you cross the mark.
                </p>
                <p>
                  <span className="font-semibold text-gray-900">Paid weekly.</span> Everything earned
                  Monday to Sunday is transferred after the week closes, to the account on your profile.
                </p>
                <p className="text-xs text-gray-500 pt-2 border-t">
                  A registration alone earns nothing — the fee must be paid. If a student is later
                  refunded, that commission is reversed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ NOTIFICATIONS ═══════════ */}
        {tab === "notifications" && (
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <div>
                <h2 className="font-semibold text-lg">Notifications</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Enrollments, payouts, milestones and announcements from the office.
                </p>
              </div>
              {notifications?.unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-sm border px-4 py-1.5 rounded-lg hover:bg-gray-50 transition"
                >
                  Mark all read
                </button>
              )}
            </div>

            {!notifications?.notifications?.length ? (
              <p className="text-sm text-gray-500 py-6">Nothing yet.</p>
            ) : (
              <div className="space-y-3">
                {notifications.notifications.map((n) => {
                  const stripe =
                    n.type === "PAYOUT" ? "#16a34a"
                    : n.type === "MILESTONE" ? GOLD
                    : n.type === "ENROLLMENT" ? "#2563eb"
                    : "#94a3b8"
                  return (
                    <div
                      key={n.id}
                      style={{ borderLeftColor: stripe }}
                      className={`border border-gray-200 border-l-4 rounded-r-xl p-4 flex items-start justify-between gap-4 flex-wrap ${
                        n.isRead ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-[200px]">
                        <p className="font-semibold text-sm text-gray-900">
                          {n.title}
                          {!n.isRead && (
                            <span
                              style={{ background: GOLD }}
                              className="ml-2 inline-block w-2 h-2 rounded-full align-middle"
                            />
                          )}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">{n.body}</p>
                        <p className="text-xs text-gray-400 mt-1">{fmtDateTime(n.createdAt)}</p>
                      </div>
                      <div className="flex gap-2">
                        {n.link && (
                          <button
                            onClick={() => {
                              const t = new URLSearchParams(n.link.split("?")[1] || "").get("tab")
                              if (t) changeTab(t)
                              else navigate(n.link)
                            }}
                            style={{ background: NAVY }}
                            className="text-white text-xs px-4 py-2 rounded-lg font-medium whitespace-nowrap"
                          >
                            Open
                          </button>
                        )}
                        {!n.isRead && (
                          <button
                            onClick={() => markRead(n.id)}
                            className="text-xs border px-3 py-2 rounded-lg hover:bg-gray-50 whitespace-nowrap"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════ LEADERBOARD ═══════════ */}
        {tab === "leaderboard" && (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="p-6 pb-4">
              <h2 className="font-semibold text-lg">Team leaderboard</h2>
              <p className="text-xs text-gray-500 mt-1">
                Ranked by qualifying (paid) enrollments.
              </p>
            </div>
            {leaderboard === null ? (
              <p className="px-6 pb-8 text-sm text-gray-500">Loading…</p>
            ) : leaderboard.length === 0 ? (
              <p className="px-6 pb-8 text-sm text-gray-500">No employees on the board yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-6 py-3 text-left">Rank</th>
                      <th className="px-6 py-3 text-left">Employee</th>
                      <th className="px-6 py-3 text-center">Paid enrollments</th>
                      <th className="px-6 py-3 text-center">Tasks done</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((r) => {
                      const isMe = r.employeeId === emp.id
                      return (
                        <tr
                          key={r.employeeId}
                          className={`border-t ${isMe ? "bg-amber-50" : ""}`}
                          style={isMe ? { borderLeft: `4px solid ${GOLD}` } : {}}
                        >
                          <td className="px-6 py-3 font-bold">#{r.rank}</td>
                          <td className="px-6 py-3">
                            <p className="font-medium">
                              {r.name}
                              {isMe && (
                                <span
                                  style={{ background: GOLD, color: NAVY }}
                                  className="ml-2 text-xs px-2 py-0.5 rounded font-bold"
                                >
                                  You
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400">{r.employeeCode}</p>
                          </td>
                          <td className="px-6 py-3 text-center font-semibold">{r.qualified}</td>
                          <td className="px-6 py-3 text-center">{r.tasksCompleted}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══════════ PROFILE / KYC ═══════════ */}
        {tab === "profile" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow p-6">
              <div className="flex items-center gap-5 flex-wrap">
                <div
                  style={{ background: NAVY, color: GOLD, borderColor: GOLD }}
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black border-2 flex-shrink-0"
                >
                  {emp.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-[180px]">
                  <h1 className="text-2xl font-bold text-gray-900">{emp.name || "—"}</h1>
                  <p className="text-sm text-gray-500">{emp.email || "—"}</p>
                </div>
                <div className="text-sm">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Employee ID</p>
                  <p className="font-bold" style={{ color: NAVY }}>
                    {emp.employeeCode || "—"}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-1 text-sm">
                {[
                  ["WhatsApp number", emp.whatsappNumber ? `+91 ${emp.whatsappNumber}` : "—"],
                  ["Referral code", emp.referralCode || "—"],
                  ["Status", emp.isActive === false ? "Deactivated" : "Active"],
                  ["Joined", fmtDate(emp.createdAt)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2.5 border-b last:border-0">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Name, email and employee ID are managed by the office. Contact them to change these.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
                <h2 className="font-semibold text-lg">Payout details</h2>
                {!kycEdit && (
                  <button
                    onClick={() => setKycEdit(true)}
                    className="text-sm border px-4 py-1.5 rounded-lg hover:bg-gray-50 transition"
                  >
                    {kycComplete ? "Edit" : "Add details"}
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-5">
                Weekly payments are sent to whichever of these you provide. UPI is usually fastest.
              </p>

              {kycMsg && <p className="text-green-600 text-sm mb-3 font-medium">{kycMsg}</p>}
              {kycError && <p className="text-red-500 text-sm mb-3">{kycError}</p>}

              {kycEdit ? (
                <div className="space-y-4">
                  {[
                    ["panNumber", "PAN number", "ABCDE1234F", 10],
                    ["upiId", "UPI ID", "yourname@bank", 60],
                    ["bankAccountName", "Account holder name", "As printed in the passbook", 100],
                    ["bankAccountNumber", "Bank account number", "9–18 digits", 18],
                    ["bankIfsc", "IFSC code", "SBIN0001234", 11],
                    ["emergencyContactName", "Emergency contact name", "Full name", 100],
                    ["emergencyContactPhone", "Emergency contact number", "10 digits", 10],
                  ].map(([key, label, placeholder, maxLength]) => (
                    <div key={key}>
                      <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                        {label}
                      </label>
                      <input
                        className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:outline-none focus:border-black"
                        placeholder={placeholder}
                        maxLength={maxLength}
                        value={kyc[key]}
                        onChange={(e) => {
                          let v = e.target.value
                          if (key === "bankAccountNumber" || key === "emergencyContactPhone") {
                            v = v.replace(/\D/g, "")
                          }
                          if (key === "panNumber" || key === "bankIfsc") {
                            v = v.toUpperCase()
                          }
                          setKyc((k) => ({ ...k, [key]: v }))
                        }}
                      />
                    </div>
                  ))}

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={saveKyc}
                      disabled={kycSaving}
                      style={{ background: NAVY }}
                      className="text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {kycSaving ? "Saving…" : "Save details"}
                    </button>
                    <button
                      onClick={() => { setKycEdit(false); setKycError(""); setKycMsg("") }}
                      disabled={kycSaving}
                      className="border px-5 py-2 rounded-lg text-sm disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-sm">
                  {[
                    ["PAN number", kyc.panNumber],
                    ["UPI ID", kyc.upiId],
                    ["Account holder", kyc.bankAccountName],
                    [
                      "Bank account",
                      kyc.bankAccountNumber
                        ? `••••${kyc.bankAccountNumber.slice(-4)}`
                        : "",
                    ],
                    ["IFSC", kyc.bankIfsc],
                    ["Emergency contact", kyc.emergencyContactName],
                    [
                      "Emergency number",
                      kyc.emergencyContactPhone ? `+91 ${kyc.emergencyContactPhone}` : "",
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between py-2.5 border-b last:border-0">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-medium">{value || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-semibold text-lg mb-4">Account & support</h2>
              <div className="flex justify-between items-center py-3 border-b gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-medium">Password</p>
                  <p className="text-xs text-gray-500">
                    Reset it by email using a one-time code.
                  </p>
                </div>
                <button
                  onClick={() => navigate("/forgot-password")}
                  className="text-sm border px-4 py-1.5 rounded-lg hover:bg-gray-50 transition whitespace-nowrap"
                >
                  Reset password
                </button>
              </div>
              <div className="flex justify-between items-center py-3 gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-medium">Query about your earnings?</p>
                  <p className="text-xs text-gray-500">
                    Write to the office with your employee ID and the week in question.
                  </p>
                </div>
                <a
                  href={`mailto:priyanksha1803@gmail.com?subject=Earnings query — ${
                    emp.employeeCode || ""
                  }&body=Employee ID: ${emp.employeeCode || ""}%0D%0AWeek: %0D%0A%0D%0ADetails:`}
                  style={{ background: NAVY }}
                  className="text-white text-sm px-4 py-2 rounded-lg font-medium whitespace-nowrap"
                >
                  Email the office
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer style={{ background: NAVY }} className="text-white/50 mt-8">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 flex items-center justify-between gap-4 flex-wrap text-xs">
          <p>© {new Date().getFullYear()} Excellence Youth Talent Search LLP. All rights reserved.</p>
          <button onClick={() => navigate("/")} className="hover:text-white transition">
            Company home page
          </button>
        </div>
      </footer>
    </div>
  )
}

export default Employee