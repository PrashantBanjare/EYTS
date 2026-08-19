import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"

const NAVY = "#0a1628"
const GOLD = "#c9a84c"

const TABS = [
  { id: "details", label: "Personal Details" },
  { id: "payments", label: "Payment History" },
  { id: "exams", label: "Examination History" },
  { id: "notifications", label: "Notifications" },
  { id: "support", label: "Contact & Support" },
]

function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState("details")
  const [profile, setProfile] = useState(null)
  const [payments, setPayments] = useState([])
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Edit state — only fields the backend accepts
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({ name: "", whatsappNumber: "" })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")
  const [saveError, setSaveError] = useState("")

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      setError("")
      try {
        const [meRes, payRes, attRes] = await Promise.all([
          api.get("/auth/me"),
          api.get("/payments/my"),
          api.get("/attempts/my"),
        ])
        const me = meRes.data?.user || null
        setProfile(me)
        setPayments(Array.isArray(payRes.data?.payments) ? payRes.data.payments : [])
        setAttempts(Array.isArray(attRes.data?.attempts) ? attRes.data.attempts : [])
        setForm({
          name: me?.name || "",
          whatsappNumber: me?.whatsappNumber || "",
        })
      } catch (err) {
        setError(err.response?.data?.message || "Could not load your profile. Please try again.")
        console.error("Profile fetch error:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const handleSave = async () => {
    setSaveError("")
    setSaveMsg("")

    if (!form.name.trim()) {
      setSaveError("Name cannot be empty")
      return
    }
    if (!/^[a-zA-Z\s.]+$/.test(form.name.trim())) {
      setSaveError("Name can contain only letters, spaces and full stops")
      return
    }
    if (!/^\d{10}$/.test(form.whatsappNumber)) {
      setSaveError("WhatsApp number must be exactly 10 digits")
      return
    }

    setSaving(true)
    try {
      const res = await api.patch("/auth/profile", {
        name: form.name.trim(),
        whatsappNumber: form.whatsappNumber,
      })
      setProfile((p) => ({ ...p, ...(res.data?.user || {}) }))
      setSaveMsg("Saved")
      setEditMode(false)
      setTimeout(() => setSaveMsg(""), 3000)
    } catch (err) {
      setSaveError(err.response?.data?.message || "Could not save your changes")
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = () => {
    setForm({
      name: profile?.name || "",
      whatsappNumber: profile?.whatsappNumber || "",
    })
    setEditMode(false)
    setSaveError("")
    setSaveMsg("")
  }

  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"

  const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("en-IN") : "—")

  const fmtTime = (s) =>
    typeof s === "number" ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : "—"

  const maskAadhar = (a) => (a && a.length === 12 ? `XXXX XXXX ${a.slice(8)}` : "—")

  const hasPaid = payments.some((p) => p.status === "PAID")
  const submitted = attempts.filter((a) => a.isSubmitted)
  const bestAttempt = submitted
    .filter((a) => a.result)
    .sort((a, b) => (b.result?.totalScore || 0) - (a.result?.totalScore || 0))[0]

  // Notifications derived from real account state — no separate backend feed exists yet
  const notifications = []
  if (!hasPaid) {
    notifications.push({
      tone: "action",
      title: "Payment pending",
      body: "Complete the ₹299 registration payment to unlock your examination.",
      action: { label: "Pay now", to: "/payment" },
    })
  } else {
    const paidRecord = payments.find((p) => p.status === "PAID")
    notifications.push({
      tone: "done",
      title: "Examination access active",
      body: paidRecord?.isFreeAccess
        ? "Free access was granted to your account by the administrator."
        : `Payment of ₹${paidRecord?.amount} received on ${fmtDate(paidRecord?.createdAt)}.`,
    })
  }
  if (hasPaid && submitted.length === 0) {
    notifications.push({
      tone: "action",
      title: "Examination not attempted",
      body: "Your seat is confirmed. Start whenever you are ready — the timer begins on the first question.",
      action: { label: "Start examination", to: "/exam" },
    })
  }
  attempts.forEach((a) => {
    if (!a.isSubmitted) return
    if (a.result) {
      notifications.push({
        tone: "done",
        title: `Result published — ${a.exam?.title || "Examination"}`,
        body: `You scored ${a.result.totalScore}/${a.result.totalQuestions} (${a.result.percentage}%). Rank #${a.result.rank ?? "—"}.`,
        action: { label: "View result", to: `/result/${a.id}` },
      })
    } else {
      notifications.push({
        tone: "waiting",
        title: `Result awaited — ${a.exam?.title || "Examination"}`,
        body: a.resultReleaseAt
          ? `Results are released on ${fmtDateTime(a.resultReleaseAt)}.`
          : "The release date has not been announced yet.",
      })
    }
  })

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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── HEADER ── */}
      <header style={{ background: NAVY }} className="text-white">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate("/")}
            title="Go to the EYTS home page"
          >
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
              <p className="text-xs text-white/50">Student portal</p>
            </div>
          </div>

          <nav className="flex items-center gap-2 flex-wrap text-sm">
            <button onClick={() => navigate("/")} className="px-3 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition">
              Home
            </button>
            <button onClick={() => navigate("/dashboard")} className="px-3 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition">
              Dashboard
            </button>
            <button onClick={() => navigate("/leaderboard")} className="px-3 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition">
              Leaderboard
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

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
        {/* ── IDENTITY STRIP ── */}
        <div className="bg-white rounded-2xl shadow p-6 mb-6 flex items-center gap-5 flex-wrap">
          <div
            style={{ background: NAVY, color: GOLD, borderColor: GOLD }}
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black border-2 flex-shrink-0"
          >
            {profile?.name?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="flex-1 min-w-[180px]">
            <h1 className="text-2xl font-bold text-gray-900">{profile?.name || "—"}</h1>
            <p className="text-sm text-gray-500">{profile?.email || "—"}</p>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide">Access</p>
              <p className={`font-bold ${hasPaid ? "text-green-600" : "text-red-500"}`}>
                {hasPaid ? "Active" : "Not paid"}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide">Attempts</p>
              <p className="font-bold text-gray-900">{submitted.length}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide">Best score</p>
              <p className="font-bold text-gray-900">
                {bestAttempt?.result
                  ? `${bestAttempt.result.totalScore}/${bestAttempt.result.totalQuestions}`
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* ── TABS ── */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map((t) => {
            const active = tab === t.id
            const count = t.id === "notifications" ? notifications.length : null
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={active ? { background: NAVY } : {}}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  active ? "text-white" : "bg-white text-gray-600 border hover:bg-gray-50"
                }`}
              >
                {t.label}
                {count ? (
                  <span
                    style={{ background: active ? GOLD : NAVY, color: active ? NAVY : "#fff" }}
                    className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-bold"
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {/* ── PERSONAL DETAILS ── */}
        {tab === "details" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow p-6">
              <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
                <h2 className="font-semibold text-lg">Editable details</h2>
                {!editMode && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="text-sm border px-4 py-1.5 rounded-lg hover:bg-gray-50 transition"
                  >
                    Edit
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-5">
                Your name and WhatsApp number can be changed here. Identity and education records are
                locked after registration to keep examination records verifiable.
              </p>

              {saveMsg && (
                <p className="text-green-600 text-sm mb-3 font-medium">{saveMsg}</p>
              )}
              {saveError && (
                <p className="text-red-500 text-sm mb-3">{saveError}</p>
              )}

              {editMode ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                      Full name
                    </label>
                    <input
                      className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:outline-none focus:border-black"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                      WhatsApp number
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm font-medium">+91</span>
                      <input
                        className="flex-1 border border-gray-300 p-2.5 rounded-lg text-sm focus:outline-none focus:border-black"
                        value={form.whatsappNumber}
                        maxLength={10}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            whatsappNumber: e.target.value.replace(/\D/g, "").slice(0, 10),
                          }))
                        }
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {form.whatsappNumber.length}/10 digits
                    </p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      style={{ background: NAVY }}
                      className="text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="border px-5 py-2 rounded-lg text-sm disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {[
                    ["Full name", profile?.name],
                    ["WhatsApp number", profile?.whatsappNumber ? `+91 ${profile.whatsappNumber}` : null],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex justify-between py-2.5 border-b last:border-0 text-sm"
                    >
                      <span className="text-gray-500">{label}</span>
                      <span className="font-medium">{value || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-semibold text-lg mb-1">Locked records</h2>
              <p className="text-xs text-gray-500 mb-5">
                These were captured at registration. To correct an error, write to the examination
                office using the Contact &amp; Support tab.
              </p>
              <div className="space-y-1">
                {[
                  ["Email address", profile?.email],
                  ["Father's name", profile?.fatherName],
                  ["Mother's name", profile?.motherName],
                  ["Gender", profile?.gender],
                  ["Age", profile?.age],
                  ["Aadhar number", maskAadhar(profile?.aadharNumber)],
                  ["Permanent address", profile?.address],
                  ["Highest qualification", profile?.qualification],
                  ["Currently", profile?.occupation],
                  ["Institution / organisation", profile?.institutionName],
                  ["Field / designation", profile?.occupationField],
                  ["Year of passing / joining", profile?.passingYear],
                  ["Account type", profile?.role],
                  ["Registered on", fmtDate(profile?.createdAt)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-6 py-2.5 border-b last:border-0 text-sm">
                    <span className="text-gray-500 flex-shrink-0">{label}</span>
                    <span className="font-medium text-right">{value || "—"}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-semibold text-lg mb-4">Account &amp; security</h2>
              <div className="flex justify-between items-center py-3 border-b gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-medium">Password</p>
                  <p className="text-xs text-gray-500">
                    Reset it by email using a one-time code sent to {profile?.email || "your address"}.
                  </p>
                </div>
                <Link
                  to="/forgot-password"
                  className="text-sm border px-4 py-1.5 rounded-lg hover:bg-gray-50 transition whitespace-nowrap"
                >
                  Reset password
                </Link>
              </div>
              <div className="flex justify-between items-center py-3 gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-medium">Delete my data</p>
                  <p className="text-xs text-gray-500">
                    Examination and payment records are retained for audit. Send a written request and
                    the office will confirm what can be removed.
                  </p>
                </div>
                <a
                  href={`mailto:priyanksha1803@gmail.com?subject=Data deletion request&body=Registered email: ${
                    profile?.email || ""
                  }%0D%0A%0D%0APlease describe what you would like removed:`}
                  className="text-sm border border-red-200 text-red-600 px-4 py-1.5 rounded-lg hover:bg-red-50 transition whitespace-nowrap"
                >
                  Request deletion
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ── PAYMENT HISTORY ── */}
        {tab === "payments" && (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="p-6 pb-4">
              <h2 className="font-semibold text-lg">Payment history</h2>
              <p className="text-xs text-gray-500 mt-1">
                Every transaction on your account, most recent first.
              </p>
            </div>

            {payments.length === 0 ? (
              <div className="px-6 pb-8 pt-2">
                <p className="text-sm text-gray-500 mb-4">
                  No transactions yet. Registration costs ₹299 and unlocks the examination.
                </p>
                <button
                  onClick={() => navigate("/payment")}
                  style={{ background: NAVY }}
                  className="text-white px-5 py-2 rounded-lg text-sm font-medium"
                >
                  Make payment
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-6 py-3 text-left">Date</th>
                      <th className="px-6 py-3 text-left">Amount</th>
                      <th className="px-6 py-3 text-left">Coupon</th>
                      <th className="px-6 py-3 text-left">Transaction ID</th>
                      <th className="px-6 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="px-6 py-3 text-gray-500">{fmtDate(p.createdAt)}</td>
                        <td className="px-6 py-3 font-semibold">
                          ₹{p.amount}
                          {p.discount > 0 && (
                            <span className="text-xs text-green-600 ml-1">(−₹{p.discount})</span>
                          )}
                          {p.isFreeAccess && (
                            <span className="text-xs text-blue-600 ml-1">(granted)</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-gray-500">{p.couponCode || "—"}</td>
                        <td className="px-6 py-3 font-mono text-xs">{p.transactionId || "—"}</td>
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
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── EXAMINATION HISTORY ── */}
        {tab === "exams" && (
          <div className="space-y-6">
            {bestAttempt?.result && (
              <div className="bg-white rounded-2xl shadow p-6">
                <h2 className="font-semibold text-lg mb-4">Best performance</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                  {[
                    ["Score", `${bestAttempt.result.totalScore}/${bestAttempt.result.totalQuestions}`],
                    ["Percentage", `${bestAttempt.result.percentage}%`],
                    ["Rank", bestAttempt.result.rank ? `#${bestAttempt.result.rank}` : "—"],
                    [
                      "Percentile",
                      bestAttempt.result.percentile != null
                        ? `${bestAttempt.result.percentile}th`
                        : "—",
                    ],
                    ["Time taken", fmtTime(bestAttempt.result.timeTaken)],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-gray-50 rounded-xl py-3 px-2">
                      <p className="text-xs text-gray-500 mb-1">{label}</p>
                      <p className="font-bold" style={{ color: NAVY }}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <div className="p-6 pb-4">
                <h2 className="font-semibold text-lg">Examination history</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Every attempt on your account, most recent first.
                </p>
              </div>

              {attempts.length === 0 ? (
                <div className="px-6 pb-8 pt-2">
                  <p className="text-sm text-gray-500 mb-4">
                    You have not attempted an examination yet.
                  </p>
                  <button
                    onClick={() => navigate(hasPaid ? "/exam" : "/payment")}
                    style={{ background: NAVY }}
                    className="text-white px-5 py-2 rounded-lg text-sm font-medium"
                  >
                    {hasPaid ? "Start examination" : "Complete payment first"}
                  </button>
                </div>
              ) : (
                <div className="divide-y">
                  {attempts.map((a, i) => (
                    <div key={a.id} className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <p className="font-medium text-sm">
                          {a.exam?.title || "Examination"}
                          <span className="text-gray-400 font-normal"> · attempt {attempts.length - i}</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Started {fmtDateTime(a.startedAt)}
                          {a.submittedAt ? ` · submitted ${fmtDateTime(a.submittedAt)}` : ""}
                        </p>
                      </div>

                      {!a.isSubmitted ? (
                        <span className="text-xs font-semibold text-amber-600">In progress</span>
                      ) : a.result ? (
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-bold">
                              {a.result.totalScore}/{a.result.totalQuestions}
                            </p>
                            <p className="text-xs text-gray-400">
                              {a.result.percentage}%
                              {a.result.rank ? ` · rank #${a.result.rank}` : ""}
                            </p>
                          </div>
                          <button
                            onClick={() => navigate(`/result/${a.id}`)}
                            className="text-xs border px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
                          >
                            View result
                          </button>
                        </div>
                      ) : (
                        <div className="text-right">
                          <p className="text-xs font-semibold text-amber-600">Result awaited</p>
                          {a.resultReleaseAt && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {fmtDateTime(a.resultReleaseAt)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── NOTIFICATIONS ── */}
        {tab === "notifications" && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="font-semibold text-lg">Notifications</h2>
            <p className="text-xs text-gray-500 mt-1 mb-5">
              Updates on your payment, examination and results.
            </p>

            {notifications.length === 0 ? (
              <p className="text-sm text-gray-500 py-6">Nothing needs your attention right now.</p>
            ) : (
              <div className="space-y-3">
                {notifications.map((n, i) => {
                  const stripe =
                    n.tone === "action" ? GOLD : n.tone === "waiting" ? "#f59e0b" : "#16a34a"
                  return (
                    <div
                      key={i}
                      style={{ borderLeftColor: stripe }}
                      className="border border-gray-200 border-l-4 rounded-r-xl p-4 flex items-start justify-between gap-4 flex-wrap"
                    >
                      <div className="flex-1 min-w-[200px]">
                        <p className="font-semibold text-sm text-gray-900">{n.title}</p>
                        <p className="text-sm text-gray-600 mt-1">{n.body}</p>
                      </div>
                      {n.action && (
                        <button
                          onClick={() => navigate(n.action.to)}
                          style={{ background: NAVY }}
                          className="text-white text-xs px-4 py-2 rounded-lg font-medium whitespace-nowrap"
                        >
                          {n.action.label}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── CONTACT & SUPPORT ── */}
        {tab === "support" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-semibold text-lg mb-1">Examination office</h2>
              <p className="text-xs text-gray-500 mb-5">
                Quote your registered email when you write, so we can find your record quickly.
              </p>
              {[
                ["Head office", "EYTS LLP\nKawardha, Chhattisgarh — 491995\nIndia"],
                ["Email", "priyanksha1803@gmail.com"],
                ["Phone", "+91 7999832476"],
                ["Support hours", "Monday to Saturday\n9:00 AM – 6:00 PM IST"],
              ].map(([label, value]) => (
                <div key={label} className="py-3 border-b last:border-0">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    {label}
                  </p>
                  <p className="text-sm text-gray-800 whitespace-pre-line">{value}</p>
                </div>
              ))}
              <a
                href={`mailto:priyanksha1803@gmail.com?subject=Support request&body=Registered email: ${
                  profile?.email || ""
                }%0D%0A%0D%0AHow can we help?`}
                style={{ background: NAVY }}
                className="mt-5 inline-block text-white px-5 py-2 rounded-lg text-sm font-medium"
              >
                Email the office
              </a>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-semibold text-lg mb-1">Quick links</h2>
              <p className="text-xs text-gray-500 mb-5">
                Everything else on the EYTS platform.
              </p>
              <div className="space-y-2">
                {[
                  ["Company home page", "/"],
                  ["Student dashboard", "/dashboard"],
                  ["Leaderboard", "/leaderboard"],
                  ["Make a payment", "/payment"],
                  ["Reset password", "/forgot-password"],
                ].map(([label, to]) => (
                  <button
                    key={to}
                    onClick={() => navigate(to)}
                    className="w-full text-left text-sm border rounded-lg px-4 py-2.5 hover:bg-gray-50 transition flex items-center justify-between"
                  >
                    <span>{label}</span>
                    <span className="text-gray-400">→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ background: NAVY }} className="text-white/50 mt-8">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 flex items-center justify-between gap-4 flex-wrap text-xs">
          <p>© {new Date().getFullYear()} Excellence Youth Talent Search LLP. All rights reserved.</p>
          <div className="flex gap-5">
            <button onClick={() => navigate("/")} className="hover:text-white transition">
              Home
            </button>
            <button onClick={() => setTab("support")} className="hover:text-white transition">
              Contact
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Profile