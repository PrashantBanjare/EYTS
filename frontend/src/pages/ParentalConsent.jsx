import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { proctoringService } from "../services/api"

const NAVY = "#0a1628"
const GOLD = "#c9a84c"

const STEPS = ["Parent details", "Verify code", "Done"]

function ParentalConsent() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [existing, setExisting] = useState(null)

  const [form, setForm] = useState({
    parentName: "",
    parentEmail: "",
    parentPhone: "",
    relationship: "Father",
  })

  const [otp, setOtp] = useState("")
  const [sentTo, setSentTo] = useState("")
  const [resendTimer, setResendTimer] = useState(0)

  // ── Existing consent, if any ─────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await proctoringService.getConsentStatus()
        const c = res.data?.consent
        if (c) {
          setExisting(c)
          if (c.verified) {
            setStep(2)
          } else {
            // A request was started but never verified — resume it rather
            // than making the parent go through the form again.
            setForm({
              parentName: c.parentName || "",
              parentEmail: c.parentEmail || "",
              parentPhone: c.parentPhone || "",
              relationship: c.relationship || "Father",
            })
            setSentTo(c.parentEmail || "")
            setStep(1)
          }
        }
      } catch (err) {
        console.error("consent status error:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const startTimer = () => {
    setResendTimer(60)
    const t = setInterval(() => {
      setResendTimer((n) => {
        if (n <= 1) { clearInterval(t); return 0 }
        return n - 1
      })
    }, 1000)
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  // ── Send the code to the parent ──────────────────────────────────
  const handleRequest = async () => {
    setError("")

    if (!form.parentName.trim()) return setError("Enter your parent or guardian's name")
    if (!/\S+@\S+\.\S+/.test(form.parentEmail)) return setError("Enter a valid email address")
    if (!/^\d{10}$/.test(form.parentPhone)) return setError("Phone number must be 10 digits")
    if (form.parentEmail.trim().toLowerCase() === (user?.email || "").toLowerCase()) {
      return setError("This must be your parent's email, not your own")
    }

    setBusy(true)
    try {
      const res = await proctoringService.requestConsent(form)
      setSentTo(res.data?.parentEmail || form.parentEmail)
      setStep(1)
      startTimer()
    } catch (err) {
      setError(err.response?.data?.message || "Could not send the consent request")
    } finally {
      setBusy(false)
    }
  }

  // ── Verify the code the parent received ──────────────────────────
  const handleVerify = async () => {
    setError("")
    if (otp.length !== 6) return setError("Enter the 6-digit code from the email")

    setBusy(true)
    try {
      await proctoringService.verifyConsent(otp)
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.message || "That code could not be verified")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin mb-4" />
          <p className="text-gray-500 font-medium">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div style={{ background: NAVY }} className="rounded-t-2xl p-6 text-white">
          <p className="text-xs uppercase tracking-widest" style={{ color: GOLD }}>
            Excellence Youth Talent Search LLP
          </p>
          <h1 className="text-2xl font-bold mt-1">Parental consent</h1>
          <p className="text-sm text-white/60 mt-1">
            Required before a candidate under 18 sits a camera-monitored examination
          </p>
        </div>

        <div className="bg-white rounded-b-2xl shadow-lg p-6 md:p-8">

          {/* Steps */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    background: i < step ? "#16a34a" : i === step ? NAVY : "#e5e7eb",
                    color: i <= step ? "#fff" : "#6b7280",
                  }}>
                  {i < step ? "✓" : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className="w-10 h-0.5" style={{ background: i < step ? "#16a34a" : "#e5e7eb" }} />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-5 text-sm">{error}</div>
          )}

          {/* ── Step 0: parent details ── */}
          {step === 0 && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-900">
                <p className="font-bold mb-2">Why this is needed</p>
                <p className="leading-relaxed mb-2">
                  Your examination is monitored using your webcam. Under Indian law, a
                  parent or guardian must agree to this before we may do so for anyone
                  under 18.
                </p>
                <p className="leading-relaxed">
                  We will email a six-digit code to your parent. They give consent by
                  sharing that code with you. You cannot approve this yourself.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                    Parent or guardian's full name *
                  </label>
                  <input className="w-full border p-2.5 rounded-lg text-sm"
                    placeholder="As it appears on their records"
                    value={form.parentName}
                    onChange={(e) => set("parentName", e.target.value)} />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                    Relationship *
                  </label>
                  <select className="w-full border p-2.5 rounded-lg text-sm"
                    value={form.relationship}
                    onChange={(e) => set("relationship", e.target.value)}>
                    <option>Father</option>
                    <option>Mother</option>
                    <option>Legal guardian</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                    Their email address *
                  </label>
                  <input type="email" className="w-full border p-2.5 rounded-lg text-sm"
                    placeholder="parent@email.com"
                    value={form.parentEmail}
                    onChange={(e) => set("parentEmail", e.target.value)} />
                  <p className="text-xs text-gray-400 mt-1">
                    The consent code is sent here. It must not be your own email.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                    Their phone number *
                  </label>
                  <input type="tel" maxLength={10} className="w-full border p-2.5 rounded-lg text-sm"
                    placeholder="10-digit mobile number"
                    value={form.parentPhone}
                    onChange={(e) => set("parentPhone", e.target.value.replace(/\D/g, ""))} />
                </div>
              </div>

              <button onClick={handleRequest} disabled={busy}
                style={{ background: NAVY }}
                className="w-full text-white py-3 rounded-xl font-bold mt-6 disabled:opacity-50">
                {busy ? "Sending…" : "Send consent request →"}
              </button>

              <button onClick={() => navigate("/dashboard")}
                className="w-full border border-gray-300 py-2.5 rounded-xl text-sm font-medium mt-3">
                Back to dashboard
              </button>
            </>
          )}

          {/* ── Step 1: verify ── */}
          {step === 1 && (
            <>
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">📧</div>
                <h2 className="font-bold text-lg mb-1">Ask your parent for the code</h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  We have emailed a six-digit consent code to
                </p>
                <p className="font-semibold text-sm mt-1" style={{ color: NAVY }}>{sentTo}</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-xs text-amber-900">
                The email explains what will be monitored. Your parent should read it
                before sharing the code. The code expires in 15 minutes.
              </div>

              <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">
                Consent code
              </label>
              <input type="text" maxLength={6}
                className="w-full border p-3 rounded-lg text-center text-2xl font-bold tracking-[0.4em]"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />

              <button onClick={handleVerify} disabled={busy || otp.length !== 6}
                style={{ background: otp.length === 6 ? NAVY : "#cbd5e1" }}
                className="w-full text-white py-3 rounded-xl font-bold mt-5 disabled:cursor-not-allowed">
                {busy ? "Verifying…" : "Confirm consent →"}
              </button>

              <div className="flex gap-3 mt-3">
                <button onClick={handleRequest} disabled={busy || resendTimer > 0}
                  className="flex-1 border border-gray-300 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
                </button>
                <button onClick={() => { setStep(0); setOtp(""); setError("") }}
                  className="flex-1 border border-gray-300 py-2.5 rounded-xl text-sm font-medium">
                  Change details
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: done ── */}
          {step === 2 && (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="font-bold text-xl mb-2">Consent recorded</h2>
              <p className="text-sm text-gray-600 leading-relaxed mb-6">
                Your parent or guardian has given permission for this examination to be
                monitored. You may begin whenever you are ready.
              </p>

              {existing?.parentName && (
                <div className="bg-gray-50 rounded-xl p-4 mb-6 text-sm text-left">
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Consent given by</span>
                    <span className="font-medium">{existing.parentName}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Relationship</span>
                    <span className="font-medium">{existing.relationship || "—"}</span>
                  </div>
                  {existing.verifiedAt && (
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500">Recorded on</span>
                      <span className="font-medium">
                        {new Date(existing.verifiedAt).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <button onClick={() => navigate("/exam")} style={{ background: NAVY }}
                className="w-full text-white py-3 rounded-xl font-bold mb-3">
                Go to the examination →
              </button>
              <button onClick={() => navigate("/dashboard")}
                className="w-full border border-gray-300 py-2.5 rounded-xl text-sm font-medium">
                Back to dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ParentalConsent