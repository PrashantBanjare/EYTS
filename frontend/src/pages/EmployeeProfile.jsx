import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"

const NAVY = "#0a1628"
const GOLD = "#c9a84c"

const rupees = (n) => `₹${(n ?? 0).toLocaleString("en-IN")}`
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }) : "—"

// Clipboard with a fallback: navigator.clipboard is unavailable on
// non-HTTPS origins in several browsers, which is why the copy button
// silently did nothing on http://localhost and on a plain-http server.
const copyText = async (text) => {
  if (!text) return false
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* fall through */ }

  try {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.setAttribute("readonly", "")
    ta.style.position = "fixed"
    ta.style.top = "-1000px"
    ta.style.opacity = "0"
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, text.length)   // iOS Safari
    const ok = document.execCommand("copy")
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

function EmployeeProfile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [summary, setSummary] = useState(null)
  const [enrollments, setEnrollments] = useState(null)
  const [earnings, setEarnings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState("")
  const [copyFailed, setCopyFailed] = useState(false)

  // Editable personal details
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: "", whatsappNumber: "", address: "" })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")
  const [saveError, setSaveError] = useState("")

  // Payout details
  const [kyc, setKyc] = useState({
    panNumber: "", bankAccountName: "", bankAccountNumber: "",
    bankIfsc: "", upiId: "", emergencyContactName: "", emergencyContactPhone: "",
  })
  const [kycEdit, setKycEdit] = useState(false)
  const [kycSaving, setKycSaving] = useState(false)
  const [kycMsg, setKycMsg] = useState("")
  const [kycError, setKycError] = useState("")

  const [enrollFilter, setEnrollFilter] = useState("all")

  useEffect(() => {
    if (user && user.role !== "EMPLOYEE" && user.role !== "ADMIN") {
      navigate("/dashboard")
    }
  }, [user, navigate])

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const [s, e, ea] = await Promise.all([
        api.get("/employees/me/summary"),
        api.get("/employees/me/enrollments"),
        api.get("/employees/me/earnings"),
      ])
      setSummary(s.data)
      setEnrollments(e.data)
      setEarnings(ea.data)

      const emp = s.data?.employee || {}
      setForm({
        name: emp.name || "",
        whatsappNumber: emp.whatsappNumber || "",
        address: emp.address || "",
      })
      setKyc({
        panNumber: emp.panNumber || "",
        bankAccountName: emp.bankAccountName || "",
        bankAccountNumber: emp.bankAccountNumber || "",
        bankIfsc: emp.bankIfsc || "",
        upiId: emp.upiId || "",
        emergencyContactName: emp.emergencyContactName || "",
        emergencyContactPhone: emp.emergencyContactPhone || "",
      })
    } catch (err) {
      setError(err.response?.data?.message || "Could not load your profile")
      console.error("EmployeeProfile error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const copy = async (text, label) => {
    const ok = await copyText(text)
    if (ok) {
      setCopied(label)
      setCopyFailed(false)
      setTimeout(() => setCopied(""), 2000)
    } else {
      setCopyFailed(true)
      setTimeout(() => setCopyFailed(false), 4000)
    }
  }

  const saveProfile = async () => {
    setSaveError("")
    setSaveMsg("")
    if (!form.name.trim()) return setSaveError("Name cannot be empty")
    if (!/^[a-zA-Z\s.]+$/.test(form.name.trim()))
      return setSaveError("Name can contain only letters, spaces and full stops")
    if (!/^\d{10}$/.test(form.whatsappNumber))
      return setSaveError("WhatsApp number must be exactly 10 digits")

    setSaving(true)
    try {
      await api.patch("/employees/me/profile", {
        name: form.name.trim(),
        whatsappNumber: form.whatsappNumber,
        address: form.address,
      })
      setSaveMsg("Saved")
      setEditing(false)
      await load()
      setTimeout(() => setSaveMsg(""), 3000)
    } catch (err) {
      setSaveError(err.response?.data?.message || "Could not save your details")
    } finally {
      setSaving(false)
    }
  }

  const saveKyc = async () => {
    setKycError("")
    setKycMsg("")
    if (!kyc.upiId && !kyc.bankAccountNumber)
      return setKycError("Add either a UPI ID or a bank account so the office can pay you")

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin mb-4" />
          <p className="text-gray-500 font-medium">Loading your profile…</p>
        </div>
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-bold mb-2">Profile unavailable</h2>
          <p className="text-gray-600 text-sm mb-6">{error}</p>
          <button onClick={load} style={{ background: NAVY }}
            className="text-white px-6 py-2 rounded-lg font-medium">
            Try again
          </button>
        </div>
      </div>
    )
  }

  const emp = summary?.employee || {}
  const rates = summary?.rates || {}
  const task = summary?.task || {}
  const life = summary?.lifetime || {}
  const week = summary?.thisWeek || {}
  const link = summary?.referralLink || ""
  const kycComplete = !!(kyc.panNumber && (kyc.bankAccountNumber || kyc.upiId))

  const rows = (enrollments?.enrollments || []).filter((r) => {
    if (enrollFilter === "paid") return r.hasPaid
    if (enrollFilter === "pending") return !r.hasPaid
    return true
  })

  const taskTone = task.complete ? "#16a34a" : task.expired ? "#dc2626" : GOLD

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── HEADER ── */}
      <header style={{ background: NAVY }} className="text-white">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <div style={{ background: GOLD, color: NAVY }}
              className="w-9 h-9 rounded-lg flex items-center justify-center font-black">T</div>
            <div className="leading-tight">
              <p className="font-bold text-sm">
                ExcellenceYouth<span style={{ color: GOLD }}>TalentSearch LLP</span>
              </p>
              <p className="text-xs text-white/50">Employee profile</p>
            </div>
          </div>
          <nav className="flex items-center gap-2 flex-wrap text-sm">
            <button onClick={() => navigate("/employee")}
              className="px-3 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition">
              Portal
            </button>
            <button onClick={() => navigate("/")}
              className="px-3 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition">
              Home
            </button>
            <button
              onClick={() => { if (confirm("Log out?")) { logout(); navigate("/login") } }}
              style={{ background: GOLD, color: NAVY }}
              className="px-4 py-1.5 rounded-lg font-bold">
              Log out
            </button>
          </nav>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-6">
        {copyFailed && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-sm">
            Your browser blocked the copy. Tap the text to select it, then copy manually.
          </div>
        )}

        {/* ── IDENTITY ── */}
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center gap-5 flex-wrap">
            <div style={{ background: NAVY, color: GOLD, borderColor: GOLD }}
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black border-2 flex-shrink-0">
              {emp.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-[180px]">
              <h1 className="text-2xl font-bold text-gray-900">{emp.name || "—"}</h1>
              <p className="text-sm text-gray-500">{emp.email || "—"}</p>
              <div className="flex gap-2 mt-2 flex-wrap">
                <span style={{ background: NAVY }} className="text-white text-xs px-2 py-1 rounded font-bold">
                  {emp.employeeCode || "—"}
                </span>
                <button
                  onClick={() => copy(emp.referralCode, "code")}
                  style={{ background: GOLD, color: NAVY }}
                  className="text-xs px-2 py-1 rounded font-bold"
                  title="Tap to copy">
                  {copied === "code" ? "Copied" : emp.referralCode || "—"}
                </button>
                <span className={`text-xs px-2 py-1 rounded font-semibold ${
                  emp.isActive === false ? "bg-gray-200 text-gray-600" : "bg-green-100 text-green-700"
                }`}>
                  {emp.isActive === false ? "Deactivated" : "Active"}
                </span>
              </div>
            </div>
            <div className="text-sm text-right">
              <p className="text-gray-500 text-xs uppercase tracking-wide">Joined</p>
              <p className="font-semibold">{fmtDate(emp.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* ── MY TASK ── */}
        <div className="bg-white rounded-2xl shadow p-6" style={{ borderTop: `4px solid ${taskTone}` }}>
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
            <h2 className="font-semibold text-lg">My task</h2>
            {task.isSet ? (
              <span className={`text-xs px-2 py-1 rounded font-bold ${
                task.complete ? "bg-green-100 text-green-700"
                : task.expired ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-700"
              }`}>
                {task.complete ? "Complete" : task.expired ? "Deadline missed" : "In progress"}
              </span>
            ) : (
              <span className="text-xs px-2 py-1 rounded font-bold bg-gray-100 text-gray-600">
                Not assigned
              </span>
            )}
          </div>

          <p className="text-sm text-gray-700 mb-1">
            Enroll <strong>{task.target}</strong> students with completed payment
            {task.deadline && <> by <strong>{fmtDate(task.deadline)}</strong></>}.
          </p>
          <p className="text-xs text-gray-500 mb-5">
            A signup alone does not count — the ₹299 fee must be paid. Completing the task pays{" "}
            {rupees(task.bonus)} salary. Missing the deadline deducts {task.penaltyPercent}% of your
            commission.
          </p>

          <div className="flex items-baseline justify-between mb-2">
            <p className="text-3xl font-bold" style={{ color: NAVY }}>
              {task.progress}
              <span className="text-lg text-gray-400 font-normal"> / {task.target}</span>
            </p>
            <p className="text-sm font-semibold" style={{ color: taskTone }}>{task.percent}%</p>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div style={{ width: `${task.percent}%`, background: taskTone }}
              className="h-3 rounded-full transition-all" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 text-sm">
            {[
              ["Started", fmtDate(task.startAt)],
              ["Deadline", task.deadline ? fmtDate(task.deadline) : "Not set"],
              ["Remaining", task.complete ? "Done" : `${task.remaining} students`],
              ["Days left",
                task.complete ? "—"
                : task.daysLeft === null ? "No deadline"
                : task.daysLeft < 0 ? "Overdue"
                : `${task.daysLeft} days`],
            ].map(([label, value]) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="font-semibold">{value}</p>
              </div>
            ))}
          </div>

          {task.penaltyApplied > 0 && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl text-sm">
              <strong>{rupees(task.penaltyApplied)} deducted</strong> — the task target was not met by
              the deadline.
            </div>
          )}

          {!task.isSet && (
            <div className="mt-4 bg-gray-50 border border-gray-200 text-gray-600 p-3 rounded-xl text-sm">
              The office has not set a deadline yet. Your enrollments and commission are still being
              tracked in full.
            </div>
          )}
        </div>

        {/* ── INCOME ── */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-semibold text-lg mb-1">Income</h2>
          <p className="text-xs text-gray-500 mb-5">
            {rupees(rates.perEnrollment)} per paid enrollment, plus {rupees(rates.taskBonus)} per
            completed task. Transferred weekly.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            {[
              ["This week", rupees(week.totalAmount), `${week.enrollments || 0} enrollments`],
              ["Awaiting transfer", rupees(summary?.pendingPayable), "not yet paid"],
              ["Total earned", rupees(life.earned), "all time"],
              ["Already received", rupees(life.paidOut), "paid out"],
            ].map(([label, value, sub], i) => (
              <div key={label}
                style={i === 1 ? { background: NAVY } : {}}
                className={`rounded-xl p-4 ${i === 1 ? "" : "bg-gray-50"}`}>
                <p className={`text-xs mb-1 ${i === 1 ? "text-white/60" : "text-gray-500"}`}>{label}</p>
                <p className="text-xl font-bold" style={i === 1 ? { color: GOLD } : { color: NAVY }}>
                  {value}
                </p>
                <p className={`text-xs mt-1 ${i === 1 ? "text-white/50" : "text-gray-400"}`}>{sub}</p>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-sm">
            {[
              ["Students referred", life.referred ?? 0],
              ["Paid (earning you commission)", life.qualified ?? 0],
              ["Signed up, not yet paid", life.awaitingPayment ?? 0],
              ["Fees collected through you", rupees(enrollments?.totalCollected)],
              ["Tasks completed", life.tasksCompleted ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-2.5 border-b last:border-0">
                <span className="text-gray-500">{label}</span>
                <span className="font-semibold">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── ENROLLMENTS ── */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <div className="p-6 pb-4">
            <h2 className="font-semibold text-lg">Students enrolled through me</h2>
            <p className="text-xs text-gray-500 mt-1">
              Contact details are partly hidden to protect student privacy.
            </p>
            <div className="flex gap-2 mt-4 flex-wrap">
              {[
                ["all", `All (${enrollments?.count || 0})`],
                ["paid", `Paid (${enrollments?.qualified || 0})`],
                ["pending", `Not paid (${enrollments?.awaitingPayment || 0})`],
              ].map(([id, label]) => (
                <button key={id} onClick={() => setEnrollFilter(id)}
                  style={enrollFilter === id ? { background: NAVY } : {}}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    enrollFilter === id ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="px-6 pb-8 pt-2">
              <p className="text-sm text-gray-500 mb-4">
                {enrollments?.count === 0
                  ? "Nobody has registered through your link yet."
                  : "No students match this filter."}
              </p>
              {enrollments?.count === 0 && (
                <button onClick={() => navigate("/employee?tab=tools")}
                  style={{ background: NAVY }}
                  className="text-white px-5 py-2 rounded-lg text-sm font-medium">
                  Get my referral link
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-6 py-3 text-left">Student</th>
                    <th className="px-6 py-3 text-left">Registered</th>
                    <th className="px-6 py-3 text-left">Paid on</th>
                    <th className="px-6 py-3 text-center">Status</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                    <th className="px-6 py-3 text-right">My commission</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.studentId} className="border-t">
                      <td className="px-6 py-3">
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-gray-400">
                          {r.institutionName} · {r.whatsappNumber}
                        </p>
                      </td>
                      <td className="px-6 py-3 text-gray-500 text-xs">
                        {fmtDateTime(r.registeredAt)}
                      </td>
                      <td className="px-6 py-3 text-gray-500 text-xs">
                        {r.paidAt ? fmtDateTime(r.paidAt) : "—"}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          r.isFreeAccess ? "bg-blue-100 text-blue-700"
                          : r.hasPaid ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                        }`}>
                          {r.isFreeAccess ? "Free access" : r.hasPaid ? "Paid" : "Unpaid"}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        {r.amountPaid !== null ? (
                          <>
                            <span className="font-semibold">{rupees(r.amountPaid)}</span>
                            {r.codeUsed && (
                              <p className="text-xs text-gray-400">via {r.codeUsed}</p>
                            )}
                          </>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold">
                        {r.commissionStatus === "REVERSED"
                          ? <span className="text-red-500 text-xs">Reversed</span>
                          : r.qualifies
                            ? rupees(r.commissionAmount)
                            : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── PAYOUTS ── */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <div className="p-6 pb-4">
            <h2 className="font-semibold text-lg">Payments received</h2>
            <p className="text-xs text-gray-500 mt-1">One row per weekly transfer from the office.</p>
          </div>
          {!earnings?.payouts?.length ? (
            <p className="px-6 pb-8 pt-2 text-sm text-gray-500">
              No payouts yet. The first arrives after your first full week.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-6 py-3 text-left">Week</th>
                    <th className="px-6 py-3 text-center">Enrollments</th>
                    <th className="px-6 py-3 text-right">Commission</th>
                    <th className="px-6 py-3 text-right">Salary / deduction</th>
                    <th className="px-6 py-3 text-right">Total</th>
                    <th className="px-6 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.payouts.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-6 py-3 text-gray-600 text-xs">
                        {fmtDate(p.periodStart)} – {fmtDate(p.periodEnd)}
                      </td>
                      <td className="px-6 py-3 text-center">{p.enrollmentCount}</td>
                      <td className="px-6 py-3 text-right">{rupees(p.commissionAmount)}</td>
                      <td className={`px-6 py-3 text-right ${p.bonusAmount < 0 ? "text-red-600" : ""}`}>
                        {p.bonusAmount === 0 ? "—" : rupees(p.bonusAmount)}
                      </td>
                      <td className="px-6 py-3 text-right font-bold">{rupees(p.totalAmount)}</td>
                      <td className="px-6 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          p.status === "PAID" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {p.status === "PAID" ? `Paid ${fmtDate(p.paidAt)}` : p.status}
                        </span>
                        {p.reference && (
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{p.reference}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── MY DETAILS ── */}
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
            <h2 className="font-semibold text-lg">My details</h2>
            {!editing && (
              <button onClick={() => setEditing(true)}
                className="text-sm border px-4 py-1.5 rounded-lg hover:bg-gray-50 transition">
                Edit
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-5">
            Your employee ID, referral code and email are set by the office and cannot be changed here.
          </p>

          {saveMsg && <p className="text-green-600 text-sm mb-3 font-medium">{saveMsg}</p>}
          {saveError && <p className="text-red-500 text-sm mb-3">{saveError}</p>}

          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                  Full name
                </label>
                <input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:outline-none focus:border-black"
                  value={form.name} maxLength={100}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                  WhatsApp number
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm font-medium">+91</span>
                  <input className="flex-1 border border-gray-300 p-2.5 rounded-lg text-sm focus:outline-none focus:border-black"
                    value={form.whatsappNumber} maxLength={10}
                    onChange={(e) => setForm((f) => ({
                      ...f, whatsappNumber: e.target.value.replace(/\D/g, "").slice(0, 10),
                    }))} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{form.whatsappNumber.length}/10 digits</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                  Address
                </label>
                <textarea rows={3}
                  className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:outline-none focus:border-black"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={saveProfile} disabled={saving} style={{ background: NAVY }}
                  className="text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false); setSaveError(""); setSaveMsg("")
                    setForm({
                      name: emp.name || "",
                      whatsappNumber: emp.whatsappNumber || "",
                      address: emp.address || "",
                    })
                  }}
                  disabled={saving}
                  className="border px-5 py-2 rounded-lg text-sm disabled:opacity-50">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              {[
                ["Full name", emp.name],
                ["Email", emp.email],
                ["WhatsApp number", emp.whatsappNumber ? `+91 ${emp.whatsappNumber}` : null],
                ["Address", emp.address],
                ["Employee ID", emp.employeeCode],
                ["Referral code", emp.referralCode],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-6 py-2.5 border-b last:border-0">
                  <span className="text-gray-500 flex-shrink-0">{label}</span>
                  <span className="font-medium text-right">{value || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── PAYOUT DETAILS ── */}
        <div className="bg-white rounded-2xl shadow p-6"
          style={!kycComplete ? { borderLeft: `4px solid ${GOLD}` } : {}}>
          <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
            <h2 className="font-semibold text-lg">Payout details</h2>
            {!kycEdit && (
              <button onClick={() => setKycEdit(true)}
                className="text-sm border px-4 py-1.5 rounded-lg hover:bg-gray-50 transition">
                {kycComplete ? "Edit" : "Add details"}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-5">
            {kycComplete
              ? "Weekly payments go to the account below."
              : "Your earnings are tracked, but the office cannot transfer money until these are on file."}
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
                    placeholder={placeholder} maxLength={maxLength} value={kyc[key]}
                    onChange={(e) => {
                      let v = e.target.value
                      if (key === "bankAccountNumber" || key === "emergencyContactPhone") {
                        v = v.replace(/\D/g, "")
                      }
                      if (key === "panNumber" || key === "bankIfsc") v = v.toUpperCase()
                      setKyc((k) => ({ ...k, [key]: v }))
                    }} />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button onClick={saveKyc} disabled={kycSaving} style={{ background: NAVY }}
                  className="text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {kycSaving ? "Saving…" : "Save details"}
                </button>
                <button onClick={() => { setKycEdit(false); setKycError(""); setKycMsg("") }}
                  disabled={kycSaving}
                  className="border px-5 py-2 rounded-lg text-sm disabled:opacity-50">
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
                ["Bank account", kyc.bankAccountNumber ? `••••${kyc.bankAccountNumber.slice(-4)}` : ""],
                ["IFSC", kyc.bankIfsc],
                ["Emergency contact", kyc.emergencyContactName],
                ["Emergency number", kyc.emergencyContactPhone ? `+91 ${kyc.emergencyContactPhone}` : ""],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-2.5 border-b last:border-0">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium">{value || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── REFERRAL LINK ── */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-semibold text-lg mb-1">My referral link</h2>
          <p className="text-xs text-gray-500 mb-4">
            Students who register through this link, or enter your code at payment, get{" "}
            {rupees(rates.referralDiscount)} off — and count towards your task.
          </p>
          <div className="flex gap-2 flex-wrap">
            <input readOnly value={link} onFocus={(e) => e.target.select()}
              className="flex-1 min-w-[220px] border border-gray-300 p-2.5 rounded-lg text-xs bg-gray-50 font-mono" />
            <button onClick={() => copy(link, "link")} style={{ background: NAVY }}
              className="text-white px-5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap">
              {copied === "link" ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>

        {/* ── SUPPORT ── */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-semibold text-lg mb-4">Account & support</h2>
          <div className="flex justify-between items-center py-3 border-b gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-gray-500">Reset it by email using a one-time code.</p>
            </div>
            <button onClick={() => navigate("/forgot-password")}
              className="text-sm border px-4 py-1.5 rounded-lg hover:bg-gray-50 transition whitespace-nowrap">
              Reset password
            </button>
          </div>
          <div className="flex justify-between items-center py-3 gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium">Query about your task or earnings?</p>
              <p className="text-xs text-gray-500">Quote your employee ID when you write.</p>
            </div>
            <a href={`mailto:priyanksha1803@gmail.com?subject=Query — ${emp.employeeCode || ""}&body=Employee ID: ${emp.employeeCode || ""}%0D%0A%0D%0ADetails:`}
              style={{ background: NAVY }}
              className="text-white text-sm px-4 py-2 rounded-lg font-medium whitespace-nowrap">
              Email the office
            </a>
          </div>
        </div>
      </div>

      <footer style={{ background: NAVY }} className="text-white/50 mt-8">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 flex items-center justify-between gap-4 flex-wrap text-xs">
          <p>© {new Date().getFullYear()} Excellence Youth Talent Search LLP. All rights reserved.</p>
          <button onClick={() => navigate("/")} className="hover:text-white transition">
            Company home page
          </button>
        </div>
      </footer>
    </div>
  )
}

export default EmployeeProfile
