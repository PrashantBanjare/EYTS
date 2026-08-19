import { useState, useEffect } from "react"
import api from "../services/api"

const NAVY = "#0a1628"
const GOLD = "#c9a84c"

const rupees = (n) => `₹${(n ?? 0).toLocaleString("en-IN")}`
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"

// Clipboard with a fallback: navigator.clipboard is unavailable on
// non-HTTPS origins in several browsers, which is why the copy button
// silently did nothing on http://localhost.
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
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand("copy")
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

// ═══════════════════════════════════════════════════════════════
//  EMPLOYEES TAB
//  Usage in Admin.jsx:  {tab === "employees" && <AdminEmployees />}
// ═══════════════════════════════════════════════════════════════
export function AdminEmployees() {
  const [employees, setEmployees] = useState([])
  const [meta, setMeta] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState("")
  const [copied, setCopied] = useState("")
  const [copyFailed, setCopyFailed] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: "", email: "", password: "", whatsappNumber: "",
    taskDeadline: "", taskTarget: "",
  })
  const [created, setCreated] = useState(null)

  // Task editing
  const [taskFor, setTaskFor] = useState(null)      // employee id
  const [taskForm, setTaskForm] = useState({ taskStartAt: "", taskDeadline: "", taskTarget: "" })

  const fetchEmployees = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await api.get("/employees")
      setEmployees(Array.isArray(res.data?.employees) ? res.data.employees : [])
      setMeta({
        referralDiscount: res.data?.referralDiscount,
        ratePerEnrollment: res.data?.ratePerEnrollment,
        defaultTaskTarget: res.data?.defaultTaskTarget,
        taskBonus: res.data?.taskBonus,
        missPenaltyPercent: res.data?.missPenaltyPercent,
      })
    } catch (err) {
      setError(err.response?.data?.message || "Could not load employees")
      console.error("fetchEmployees error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEmployees() }, [])

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

  const handleCreate = async (e) => {
    e.preventDefault()
    setError(""); setSuccess(""); setCreated(null)

    const { name, email, password, whatsappNumber, taskDeadline, taskTarget } = form

    if (!name.trim()) return setError("Enter the employee's name")
    if (!/^[a-zA-Z\s.]+$/.test(name.trim()))
      return setError("Name can contain only letters, spaces and full stops")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email address")
    if (password.length < 6) return setError("Password must be at least 6 characters")
    if (!/^\d{10}$/.test(whatsappNumber)) return setError("WhatsApp number must be 10 digits")
    if (taskDeadline && new Date(taskDeadline) <= new Date())
      return setError("The task deadline must be in the future")
    if (taskTarget && parseInt(taskTarget) < 1) return setError("Target must be at least 1")

    setBusy(true)
    try {
      const res = await api.post("/employees", {
        name: name.trim(),
        email: email.trim(),
        password,
        whatsappNumber,
        taskDeadline: taskDeadline || undefined,
        taskTarget: taskTarget || undefined,
      })
      setCreated({ ...res.data.employee, referralLink: res.data.referralLink, password })
      setSuccess(res.data.message || "Employee created")
      setForm({ name: "", email: "", password: "", whatsappNumber: "", taskDeadline: "", taskTarget: "" })
      setShowForm(false)
      await fetchEmployees()
    } catch (err) {
      setError(err.response?.data?.message || "Could not create employee")
    } finally {
      setBusy(false)
    }
  }

  const openTask = (emp) => {
    setTaskFor(emp.id)
    setTaskForm({
      taskStartAt: emp.taskStartAt ? new Date(emp.taskStartAt).toISOString().slice(0, 10) : "",
      taskDeadline: emp.taskDeadline ? new Date(emp.taskDeadline).toISOString().slice(0, 10) : "",
      taskTarget: emp.taskTarget || "",
    })
  }

  const saveTask = async (emp) => {
    setError(""); setSuccess("")
    if (taskForm.taskStartAt && taskForm.taskDeadline &&
        new Date(taskForm.taskStartAt) > new Date(taskForm.taskDeadline)) {
      return setError("The deadline must fall after the start date")
    }

    setBusy(true)
    try {
      const res = await api.patch(`/employees/${emp.id}/task`, {
        taskStartAt: taskForm.taskStartAt || null,
        taskDeadline: taskForm.taskDeadline || null,
        taskTarget: taskForm.taskTarget === "" ? null : taskForm.taskTarget,
      })
      setSuccess(res.data.message)
      setTaskFor(null)
      await fetchEmployees()
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError(err.response?.data?.message || "Could not update the task")
    } finally {
      setBusy(false)
    }
  }

  const handleToggle = async (emp) => {
    const action = emp.isActive ? "Deactivate" : "Reactivate"
    if (!confirm(
      `${action} ${emp.name} (${emp.employeeCode})?\n\n` +
      (emp.isActive
        ? "Their referral code stops working and they cannot sign in. Earnings already recorded stay payable."
        : "Their referral code and login start working again.")
    )) return

    setBusy(true); setError("")
    try {
      const res = await api.patch(`/employees/${emp.id}/toggle-active`)
      setSuccess(res.data.message)
      setTimeout(() => setSuccess(""), 3000)
      await fetchEmployees()
    } catch (err) {
      setError(err.response?.data?.message || "Could not update employee")
    } finally {
      setBusy(false)
    }
  }

  const filtered = employees.filter((e) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return [e.name, e.email, e.employeeCode, e.referralCode]
      .some((v) => v?.toLowerCase().includes(q))
  })

  const totals = employees.reduce((a, e) => ({
    active: a.active + (e.isActive ? 1 : 0),
    qualified: a.qualified + (e.qualified || 0),
    commission: a.commission + (e.commissionEarned || 0),
    pending: a.pending + (e.pendingPayable || 0),
    kycMissing: a.kycMissing + (e.kycComplete ? 0 : 1),
    noTask: a.noTask + (e.task?.isSet ? 0 : 1),
  }), { active: 0, qualified: 0, commission: 0, pending: 0, kycMissing: 0, noTask: 0 })

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow p-12 text-center">
        <div className="inline-block w-6 h-6 border-4 border-gray-300 border-t-black rounded-full animate-spin mb-3" />
        <p className="text-gray-500 text-sm">Loading employees…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-400">✕</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl text-sm flex items-start justify-between gap-3">
          <span>{success}</span>
          <button onClick={() => setSuccess("")} className="text-green-400">✕</button>
        </div>
      )}
      {copyFailed && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-sm">
          Your browser blocked the copy. Tap the text to select it, then copy manually.
        </div>
      )}

      {/* Credentials, shown once */}
      {created && (
        <div style={{ borderColor: GOLD }} className="bg-white border-2 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <h3 className="font-bold text-lg">{created.employeeCode} created</h3>
              <p className="text-xs text-gray-500 mt-1">
                Pass these to {created.name} now — the password cannot be shown again.
              </p>
            </div>
            <button onClick={() => setCreated(null)}
              className="text-sm border px-3 py-1.5 rounded-lg hover:bg-gray-50">Done</button>
          </div>
          <div className="space-y-3 text-sm">
            {[
              ["Login email", created.email],
              ["Temporary password", created.password],
              ["Employee ID", created.employeeCode],
              ["Referral code", created.referralCode],
              ["Task deadline", created.taskDeadline ? fmtDate(created.taskDeadline) : "Not set"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 py-2 border-b">
                <span className="text-gray-500">{label}</span>
                <span className="font-mono font-semibold">{value}</span>
              </div>
            ))}
            <div>
              <p className="text-gray-500 mb-1">Referral link</p>
              <div className="flex gap-2 flex-wrap">
                <input readOnly value={created.referralLink || ""} onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-[200px] border border-gray-300 p-2 rounded-lg text-xs font-mono bg-gray-50" />
                <button onClick={() => copy(created.referralLink, "newlink")} style={{ background: NAVY }}
                  className="text-white px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap">
                  {copied === "newlink" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          ["Employees", `${totals.active} / ${employees.length}`, "active"],
          ["Paid enrollments", totals.qualified, "all time"],
          ["Commission earned", rupees(totals.commission), "all time"],
          ["Awaiting transfer", rupees(totals.pending), "unpaid"],
          ["Needs attention", totals.kycMissing + totals.noTask,
            `${totals.kycMissing} no bank · ${totals.noTask} no task`],
        ].map(([label, value, sub], i) => (
          <div key={label} className="bg-white rounded-2xl shadow p-4"
            style={i === 4 && (totals.kycMissing + totals.noTask) > 0
              ? { borderLeft: `4px solid ${GOLD}` } : {}}>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-2xl font-bold" style={{ color: NAVY }}>{value}</p>
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Create */}
      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-lg">Add an employee</h2>
            <p className="text-xs text-gray-500 mt-1">
              Employee ID and referral code are generated automatically. The code is the first four
              letters of their name plus a number.
            </p>
          </div>
          <button onClick={() => setShowForm((s) => !s)}
            style={showForm ? {} : { background: NAVY }}
            className={`px-5 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              showForm ? "border hover:bg-gray-50" : "text-white"}`}>
            {showForm ? "Cancel" : "New employee"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Full name</label>
                <input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm"
                  placeholder="Prashant Banjare" value={form.name} disabled={busy} maxLength={100}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Login email</label>
                <input type="email" className="w-full border border-gray-300 p-2.5 rounded-lg text-sm"
                  placeholder="name@example.com" value={form.email} disabled={busy}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Temporary password</label>
                <input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm"
                  placeholder="At least 6 characters" value={form.password} disabled={busy}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">WhatsApp number</label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm font-medium">+91</span>
                  <input className="flex-1 border border-gray-300 p-2.5 rounded-lg text-sm"
                    placeholder="9876543210" maxLength={10} value={form.whatsappNumber} disabled={busy}
                    onChange={(e) => setForm((f) => ({
                      ...f, whatsappNumber: e.target.value.replace(/\D/g, "").slice(0, 10) }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Task deadline</label>
                <input type="date" className="w-full border border-gray-300 p-2.5 rounded-lg text-sm"
                  value={form.taskDeadline} disabled={busy}
                  onChange={(e) => setForm((f) => ({ ...f, taskDeadline: e.target.value }))} />
                <p className="text-xs text-gray-400 mt-1">Optional — can be set later</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Task target</label>
                <input type="number" min="1"
                  className="w-full border border-gray-300 p-2.5 rounded-lg text-sm"
                  placeholder={meta.defaultTaskTarget || 1000} value={form.taskTarget} disabled={busy}
                  onChange={(e) => setForm((f) => ({ ...f, taskTarget: e.target.value }))} />
                <p className="text-xs text-gray-400 mt-1">
                  Blank uses the standard {meta.defaultTaskTarget || 1000}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
              Pays {rupees(meta.ratePerEnrollment)} per paid enrollment and {rupees(meta.taskBonus)} per
              completed task. Missing the deadline deducts {meta.missPenaltyPercent}% of commission.
              Students using their code get {rupees(meta.referralDiscount)} off.
            </div>

            <button type="submit" disabled={busy} style={{ background: NAVY }}
              className="text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
              {busy ? "Creating…" : "Create employee"}
            </button>
          </form>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="p-6 pb-4">
          <h2 className="font-semibold text-lg">All employees</h2>
          <input type="text" placeholder="Search by name, email, ID or code…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-300 p-2.5 rounded-lg text-sm mt-3" />
        </div>

        {filtered.length === 0 ? (
          <p className="px-6 pb-8 pt-2 text-sm text-gray-500">
            {employees.length === 0
              ? "No employees yet. Add one above to start tracking referrals."
              : "No employees match that search."}
          </p>
        ) : (
          <div className="divide-y">
            {filtered.map((e) => {
              const t = e.task || {}
              const tone = t.complete ? "#16a34a" : t.expired ? "#dc2626" : GOLD
              const isEditing = taskFor === e.id
              return (
                <div key={e.id} className={`px-6 py-5 ${e.isActive ? "" : "opacity-50"}`}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-[200px]">
                      <p className="font-semibold">
                        {e.name}
                        <span className="text-gray-400 font-normal ml-2 text-sm">{e.employeeCode}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{e.email}</p>
                      <div className="flex gap-2 mt-2 flex-wrap items-center">
                        <button onClick={() => copy(e.referralCode, e.id)}
                          style={{ background: GOLD, color: NAVY }}
                          className="text-xs px-2 py-1 rounded font-bold" title="Tap to copy">
                          {copied === e.id ? "Copied" : e.referralCode}
                        </button>
                        <span className={`text-xs px-2 py-1 rounded font-semibold ${
                          e.kycComplete ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {e.kycComplete ? "Bank on file" : "No bank details"}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded font-semibold ${
                          e.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                          {e.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-6 text-sm flex-wrap">
                      {[
                        ["Referred", e.referred],
                        ["Paid", e.qualified],
                        ["Commission", rupees(e.commissionEarned)],
                        ["Collected", rupees(e.revenueCollected)],
                        ["Owed", rupees(e.pendingPayable)],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-gray-500 text-xs uppercase tracking-wide">{label}</p>
                          <p className="font-bold" style={{ color: NAVY }}>{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => (isEditing ? setTaskFor(null) : openTask(e))}
                        className="text-xs border px-3 py-1.5 rounded-lg hover:bg-gray-50">
                        {isEditing ? "Close" : "Set task"}
                      </button>
                      <button onClick={() => handleToggle(e)} disabled={busy}
                        className={`text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 ${
                          e.isActive ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                        {e.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  </div>

                  {/* Task progress */}
                  <div className="mt-4">
                    <div className="flex items-baseline justify-between text-xs mb-1">
                      <span className="text-gray-500">
                        Task: <strong>{t.progress || 0} / {t.target}</strong> paid enrollments
                        {t.deadline && <> by {fmtDate(t.deadline)}</>}
                        {t.isSet && t.daysLeft !== null && !t.complete && (
                          <> · {t.daysLeft < 0 ? "overdue" : `${t.daysLeft} days left`}</>
                        )}
                      </span>
                      <span className="font-semibold" style={{ color: tone }}>
                        {t.complete ? "Complete" : t.expired ? "Missed" : t.isSet ? `${t.percent}%` : "No deadline"}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div style={{ width: `${t.percent || 0}%`, background: tone }}
                        className="h-2 rounded-full transition-all" />
                    </div>
                    {t.penaltyApplied > 0 && (
                      <p className="text-xs text-red-600 mt-1.5 font-medium">
                        {rupees(t.penaltyApplied)} deducted for missing the deadline
                      </p>
                    )}
                  </div>

                  {/* Task editor */}
                  {isEditing && (
                    <div className="mt-4 bg-gray-50 rounded-xl p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                            Start date
                          </label>
                          <input type="date" value={taskForm.taskStartAt}
                            className="w-full border border-gray-300 p-2 rounded-lg text-sm"
                            onChange={(ev) => setTaskForm((f) => ({ ...f, taskStartAt: ev.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                            Deadline
                          </label>
                          <input type="date" value={taskForm.taskDeadline}
                            className="w-full border border-gray-300 p-2 rounded-lg text-sm"
                            onChange={(ev) => setTaskForm((f) => ({ ...f, taskDeadline: ev.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                            Target
                          </label>
                          <input type="number" min="1" value={taskForm.taskTarget}
                            placeholder={meta.defaultTaskTarget || 1000}
                            className="w-full border border-gray-300 p-2 rounded-lg text-sm"
                            onChange={(ev) => setTaskForm((f) => ({ ...f, taskTarget: ev.target.value }))} />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-3">
                        Only enrollments inside this window count. Missing the deadline deducts{" "}
                        {meta.missPenaltyPercent}% of commission earned in it — applied automatically
                        on the next payout run. Clear the deadline to remove the penalty risk.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => saveTask(e)} disabled={busy} style={{ background: NAVY }}
                          className="text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                          {busy ? "Saving…" : "Save task"}
                        </button>
                        <button onClick={() => setTaskFor(null)} disabled={busy}
                          className="border px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  REFERRAL CODES PANEL — for the Coupons tab
//  Usage in Admin.jsx:  <AdminReferralCodes />
// ═══════════════════════════════════════════════════════════════
export function AdminReferralCodes() {
  const [data, setData] = useState(null)
  const [error, setError] = useState("")

  useEffect(() => {
    api.get("/payments/coupons")
      .then((r) => setData(r.data))
      .catch((err) => setError(err.response?.data?.message || "Could not load referral codes"))
  }, [])

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-sm">
        {error}
      </div>
    )
  }
  if (!data) return null

  const codes = data.referralCodes || []

  return (
    <div className="bg-white rounded-2xl shadow overflow-hidden mb-6">
      <div className="p-6 pb-4">
        <h2 className="font-semibold text-lg">Employee referral codes</h2>
        <p className="text-xs text-gray-500 mt-1">
          These work in the same field as coupons at checkout. A student entering one gets{" "}
          {rupees(data.referralDiscount)} off, and the employee earns their commission. They are
          created with the employee, not here.
        </p>
      </div>

      {codes.length === 0 ? (
        <p className="px-6 pb-8 pt-2 text-sm text-gray-500">No employees with referral codes yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Code</th>
                <th className="px-6 py-3 text-left">Employee</th>
                <th className="px-6 py-3 text-center">Discount</th>
                <th className="px-6 py-3 text-center">Student pays</th>
                <th className="px-6 py-3 text-center">Times used</th>
                <th className="px-6 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className={`border-t ${c.isActive ? "" : "opacity-50"}`}>
                  <td className="px-6 py-3 font-mono font-bold">{c.code}</td>
                  <td className="px-6 py-3">
                    <p className="font-medium">{c.employeeName}</p>
                    <p className="text-xs text-gray-400">{c.employeeCode}</p>
                  </td>
                  <td className="px-6 py-3 text-center text-green-600 font-semibold">
                    {rupees(c.discount)}
                  </td>
                  <td className="px-6 py-3 text-center font-semibold">
                    {rupees((data.basePrice || 299) - c.discount)}
                  </td>
                  <td className="px-6 py-3 text-center">{c.usedCount}</td>
                  <td className="px-6 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      c.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                      {c.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-6 py-4 text-xs text-gray-400 border-t">
            To disable one, deactivate the employee in the Employees tab.
          </p>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  PAYOUTS TAB
//  Usage in Admin.jsx:  {tab === "payouts" && <AdminPayouts />}
// ═══════════════════════════════════════════════════════════════
export function AdminPayouts() {
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState("PENDING")

  const [customPeriod, setCustomPeriod] = useState(false)
  const [periodStart, setPeriodStart] = useState("")
  const [periodEnd, setPeriodEnd] = useState("")

  const [payingId, setPayingId] = useState(null)
  const [reference, setReference] = useState("")

  const fetchPayouts = async () => {
    setLoading(true); setError("")
    try {
      const res = await api.get("/employees/payouts")
      setPayouts(Array.isArray(res.data?.payouts) ? res.data.payouts : [])
    } catch (err) {
      setError(err.response?.data?.message || "Could not load payouts")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPayouts() }, [])

  const handleGenerate = async () => {
    setError(""); setSuccess("")
    if (customPeriod && (!periodStart || !periodEnd))
      return setError("Choose both a start and end date, or switch back to last week")
    if (customPeriod && new Date(periodStart) > new Date(periodEnd))
      return setError("The start date must fall before the end date")

    const label = customPeriod
      ? `${fmtDate(periodStart)} – ${fmtDate(periodEnd)}`
      : "the week just ended"

    if (!confirm(
      `Generate payouts for ${label}?\n\n` +
      "This groups unpaid commission into one payout per employee, and applies a deduction to " +
      "anyone who missed their task deadline. No money moves — you mark each transfer paid " +
      "afterwards.\n\nRe-running the same period is safe."
    )) return

    setBusy(true)
    try {
      const res = await api.post("/employees/payouts/generate",
        customPeriod ? { periodStart, periodEnd } : {})
      const made = (res.data?.payouts || []).filter((p) => !p.skipped).length
      const pens = (res.data?.penaltiesApplied || []).length
      setSuccess(
        (made > 0
          ? `${made} payout${made === 1 ? "" : "s"} generated for ${fmtDate(res.data.periodStart)} – ${fmtDate(res.data.periodEnd)}`
          : res.data?.message || "Nothing to generate for that period") +
        (pens > 0 ? ` · ${pens} missed-task deduction${pens === 1 ? "" : "s"} applied` : "")
      )
      setFilter("PENDING")
      await fetchPayouts()
    } catch (err) {
      setError(err.response?.data?.message || "Could not generate payouts")
    } finally {
      setBusy(false)
    }
  }

  const handleMarkPaid = async (payout) => {
    setError("")
    if (!confirm(
      `Confirm you have transferred ${rupees(payout.totalAmount)} to ${payout.employee?.name}?\n\n` +
      "Only do this after the money has left the account. This cannot be undone."
    )) return

    setBusy(true)
    try {
      const res = await api.patch(`/employees/payouts/${payout.id}/pay`, {
        reference: reference.trim() || undefined,
      })
      setSuccess(res.data.message)
      setPayingId(null); setReference("")
      setTimeout(() => setSuccess(""), 4000)
      await fetchPayouts()
    } catch (err) {
      setError(err.response?.data?.message || "Could not update the payout")
    } finally {
      setBusy(false)
    }
  }

  const visible = payouts.filter((p) => (filter === "ALL" ? true : p.status === filter))
  const pendingTotal = payouts.filter((p) => p.status === "PENDING")
    .reduce((s, p) => s + p.totalAmount, 0)
  const paidTotal = payouts.filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.totalAmount, 0)

  const payMethod = (emp) => {
    if (emp?.upiId) return { label: "UPI", value: emp.upiId }
    if (emp?.bankAccountNumber) return {
      label: "Bank",
      value: `${emp.bankAccountName || "—"} · ${emp.bankAccountNumber} · ${emp.bankIfsc || "—"}`,
    }
    return null
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow p-12 text-center">
        <div className="inline-block w-6 h-6 border-4 border-gray-300 border-t-black rounded-full animate-spin mb-3" />
        <p className="text-gray-500 text-sm">Loading payouts…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-400">✕</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl text-sm flex items-start justify-between gap-3">
          <span>{success}</span>
          <button onClick={() => setSuccess("")} className="text-green-400">✕</button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="font-semibold text-lg">Weekly payout run</h2>
        <p className="text-xs text-gray-500 mt-1 mb-5">
          Run this on Monday. It groups the week's unpaid commission per employee and applies any
          missed-task deductions. No money moves — you transfer it, then mark each one paid.
        </p>

        <div className="flex gap-2 mb-4 flex-wrap">
          {[[false, "Week just ended"], [true, "Choose dates"]].map(([val, label]) => (
            <button key={label} onClick={() => setCustomPeriod(val)}
              style={customPeriod === val ? { background: NAVY } : {}}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${
                customPeriod === val ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {label}
            </button>
          ))}
        </div>

        {customPeriod && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Period start</label>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full border border-gray-300 p-2.5 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Period end</label>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full border border-gray-300 p-2.5 rounded-lg text-sm" />
            </div>
          </div>
        )}

        <button onClick={handleGenerate} disabled={busy} style={{ background: NAVY }}
          className="text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
          {busy ? "Working…" : "Generate payouts"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          ["To be transferred", rupees(pendingTotal),
            `${payouts.filter((p) => p.status === "PENDING").length} payout(s)`],
          ["Paid to date", rupees(paidTotal),
            `${payouts.filter((p) => p.status === "PAID").length} payout(s)`],
          ["All payouts", payouts.length, "all periods"],
        ].map(([label, value, sub], i) => (
          <div key={label} className="bg-white rounded-2xl shadow p-5"
            style={i === 0 && pendingTotal > 0 ? { borderLeft: `4px solid ${GOLD}` } : {}}>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-2xl font-bold" style={{ color: NAVY }}>{value}</p>
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="p-6 pb-4">
          <h2 className="font-semibold text-lg">Payouts</h2>
          <div className="flex gap-2 mt-3 flex-wrap">
            {[
              ["PENDING", `To pay (${payouts.filter((p) => p.status === "PENDING").length})`],
              ["PAID", `Paid (${payouts.filter((p) => p.status === "PAID").length})`],
              ["ALL", `All (${payouts.length})`],
            ].map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)}
                style={filter === id ? { background: NAVY } : {}}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  filter === id ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="px-6 pb-8 pt-2 text-sm text-gray-500">
            {payouts.length === 0
              ? "No payouts yet. Run the weekly payout above once employees have earned something."
              : "Nothing in this view."}
          </p>
        ) : (
          <div className="divide-y">
            {visible.map((p) => {
              const method = payMethod(p.employee)
              const isPaying = payingId === p.id
              return (
                <div key={p.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-[200px]">
                      <p className="font-semibold text-sm">
                        {p.employee?.name}
                        <span className="text-gray-400 font-normal ml-2">{p.employee?.employeeCode}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {fmtDate(p.periodStart)} – {fmtDate(p.periodEnd)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {p.enrollmentCount} enrollment{p.enrollmentCount === 1 ? "" : "s"} ·{" "}
                        {rupees(p.commissionAmount)} commission
                        {p.bonusAmount > 0 && ` · ${rupees(p.bonusAmount)} task salary`}
                        {p.bonusAmount < 0 && (
                          <span className="text-red-600 font-medium">
                            {" "}· {rupees(Math.abs(p.bonusAmount))} deducted
                          </span>
                        )}
                      </p>
                      {method ? (
                        <p className="text-xs text-gray-600 mt-1.5">
                          <span className="font-semibold">{method.label}:</span>{" "}
                          <span className="font-mono">{method.value}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-amber-600 mt-1.5 font-medium">
                          No payout details on file — ask them to add UPI or bank details first
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-xl font-bold" style={{ color: NAVY }}>
                        {rupees(p.totalAmount)}
                      </p>
                      {p.status === "PAID" ? (
                        <>
                          <p className="text-xs text-green-600 font-semibold mt-1">
                            Paid {fmtDate(p.paidAt)}
                          </p>
                          {p.reference && (
                            <p className="text-xs text-gray-400 font-mono mt-0.5">{p.reference}</p>
                          )}
                        </>
                      ) : (
                        !isPaying && (
                          <button onClick={() => { setPayingId(p.id); setReference("") }}
                            disabled={busy || !method}
                            title={method ? "" : "Add payout details first"}
                            style={{ background: NAVY }}
                            className="mt-2 text-white text-xs px-4 py-2 rounded-lg font-medium disabled:opacity-40 whitespace-nowrap">
                            Mark as paid
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {isPaying && (
                    <div className="mt-4 bg-gray-50 rounded-xl p-4">
                      <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                        Transaction reference (optional)
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        <input value={reference} onChange={(e) => setReference(e.target.value)}
                          placeholder="UTR or UPI reference"
                          className="flex-1 min-w-[180px] border border-gray-300 p-2 rounded-lg text-sm" />
                        <button onClick={() => handleMarkPaid(p)} disabled={busy}
                          className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 whitespace-nowrap">
                          {busy ? "Saving…" : "Confirm paid"}
                        </button>
                        <button onClick={() => { setPayingId(null); setReference("") }} disabled={busy}
                          className="border px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                          Cancel
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Saving this notifies {p.employee?.name} that the money has been sent.
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
