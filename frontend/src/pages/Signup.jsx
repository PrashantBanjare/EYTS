import { useState, useEffect } from "react"
import { useNavigate, Link, useSearchParams } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"

const STEPS = ["Personal", "Education", "Contact & Login"]

function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [searchParams] = useSearchParams()
  const referralCode = searchParams.get("ref") || ""
  const [referredByName, setReferredByName] = useState("")

  useEffect(() => {
    if (!referralCode) return
    api.get(`/employees/referral/${referralCode}`)
      .then(r => setReferredByName(r.data?.referredByName || ""))
      .catch(() => setReferredByName(""))
  }, [referralCode])

  const [form, setForm] = useState({
    name: "", fatherName: "", motherName: "", gender: "",
    age: "", aadharNumber: "", address: "",
    qualification: "", occupation: "student",
    institutionName: "", passingYear: "", occupationField: "",
    email: "", whatsappNumber: "", password: "", confirmPassword: ""
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validateStep = () => {
    if (step === 0) {
      if (!form.name || !form.fatherName || !form.motherName || !form.gender || !form.age || !form.aadharNumber || !form.address)
        return "All fields in this step are required"
      if (form.aadharNumber.length !== 12 || !/^\d+$/.test(form.aadharNumber))
        return "Aadhar number must be exactly 12 digits"
      if (isNaN(form.age) || form.age < 5 || form.age > 100)
        return "Please enter a valid age"
    }
    if (step === 1) {
      if (!form.qualification || !form.institutionName || !form.passingYear)
        return "All fields in this step are required"
      if (form.occupation === "working" && !form.occupationField)
        return "Please enter your work field"
    }
    if (step === 2) {
      if (!form.email || !form.whatsappNumber || !form.password || !form.confirmPassword)
        return "All fields are required"
      if (!/\S+@\S+\.\S+/.test(form.email))
        return "Please enter a valid email"
      if (!/^\d{10}$/.test(form.whatsappNumber))
        return "WhatsApp number must be 10 digits"
      if (form.password.length < 6)
        return "Password must be at least 6 characters"
      if (form.password !== form.confirmPassword)
        return "Passwords do not match"
    }
    return ""
  }

  const next = () => {
    const err = validateStep()
    if (err) { setError(err); return }
    setError("")
    setStep(s => s + 1)
  }

  const handleSubmit = async () => {
    const err = validateStep()
    if (err) { setError(err); return }
    setError(""); setLoading(true)
    try {
      await signup(
        form.name, form.email, form.password, form.whatsappNumber,
        {
          fatherName: form.fatherName, motherName: form.motherName,
          gender: form.gender, age: parseInt(form.age),
          aadharNumber: form.aadharNumber, address: form.address,
          qualification: form.qualification, occupation: form.occupation,
          institutionName: form.institutionName, passingYear: form.passingYear,
          occupationField: form.occupationField,
          referralCode: referralCode || undefined
        }
      )
      navigate("/dashboard")
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-xl p-8">

        <h1 className="text-2xl font-bold mb-1 text-center">Create Your Account</h1>
        <p className="text-gray-500 text-sm text-center mb-6">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>

        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                ${i < step ? "bg-green-500 text-white" : i === step ? "bg-black text-white" : "bg-gray-200 text-gray-500"}`}>
                {i < step ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`w-12 h-0.5 ${i < step ? "bg-green-500" : "bg-gray-200"}`}/>}
            </div>
          ))}
        </div>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        {referredByName && (
          <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-xl mb-4 text-sm">
            Referred by <strong>{referredByName}</strong>
          </div>
        )}

        {/* Step 0 — Personal */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Full Name *</label><input className="w-full border p-2.5 rounded-lg text-sm" placeholder="Prashant Banjare" value={form.name} onChange={e=>set("name",e.target.value)}/></div>
              <div><label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Age *</label><input type="number" className="w-full border p-2.5 rounded-lg text-sm" placeholder="21" value={form.age} onChange={e=>set("age",e.target.value)}/></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Father's Name *</label><input className="w-full border p-2.5 rounded-lg text-sm" placeholder="Father's full name" value={form.fatherName} onChange={e=>set("fatherName",e.target.value)}/></div>
              <div><label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Mother's Name *</label><input className="w-full border p-2.5 rounded-lg text-sm" placeholder="Mother's full name" value={form.motherName} onChange={e=>set("motherName",e.target.value)}/></div>
            </div>
            <div><label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Gender *</label>
              <select className="w-full border p-2.5 rounded-lg text-sm" value={form.gender} onChange={e=>set("gender",e.target.value)}>
                <option value="">Select gender</option>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
            <div><label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Aadhar Card Number *</label><input className="w-full border p-2.5 rounded-lg text-sm" placeholder="12-digit Aadhar number" maxLength={12} value={form.aadharNumber} onChange={e=>set("aadharNumber",e.target.value.replace(/\D/g,""))}/></div>
            <div><label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Permanent Address *</label><textarea className="w-full border p-2.5 rounded-lg text-sm" rows={3} placeholder="Full permanent address" value={form.address} onChange={e=>set("address",e.target.value)}/></div>
          </div>
        )}

        {/* Step 1 — Education */}
        {step === 1 && (
          <div className="space-y-4">
            <div><label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Highest Qualification *</label>
              <select className="w-full border p-2.5 rounded-lg text-sm" value={form.qualification} onChange={e=>set("qualification",e.target.value)}>
                <option value="">Select qualification</option>
                <option>10th Pass</option><option>12th Pass</option>
                <option>Diploma</option><option>Graduate</option>
                <option>Post Graduate</option><option>Doctorate</option>
              </select>
            </div>
            <div><label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Currently *</label>
              <div className="flex gap-4">
                {["student","working"].map(o=>(
                  <label key={o} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="occupation" checked={form.occupation===o} onChange={()=>set("occupation",o)}/>
                    <span className="text-sm font-medium capitalize">{o}</span>
                  </label>
                ))}
              </div>
            </div>
            {form.occupation === "student" ? (
              <>
                <div><label className="text-xs font-semibold text-gray-600 uppercase block mb-1">School / College Name *</label><input className="w-full border p-2.5 rounded-lg text-sm" placeholder="Institution name" value={form.institutionName} onChange={e=>set("institutionName",e.target.value)}/></div>
                <div><label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Year of Passing *</label>
                  <select className="w-full border p-2.5 rounded-lg text-sm" value={form.passingYear} onChange={e=>set("passingYear",e.target.value)}>
                    <option value="">Select year</option>
                    {Array.from({length:10},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y}>{y}</option>)}
                    <option>Appearing</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div><label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Organisation Name *</label><input className="w-full border p-2.5 rounded-lg text-sm" placeholder="Where do you work?" value={form.institutionName} onChange={e=>set("institutionName",e.target.value)}/></div>
                <div><label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Field / Designation *</label><input className="w-full border p-2.5 rounded-lg text-sm" placeholder="e.g. Software Engineer, Teacher" value={form.occupationField} onChange={e=>set("occupationField",e.target.value)}/></div>
                <div><label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Year of Joining *</label>
                  <select className="w-full border p-2.5 rounded-lg text-sm" value={form.passingYear} onChange={e=>set("passingYear",e.target.value)}>
                    <option value="">Select year</option>
                    {Array.from({length:20},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y}>{y}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 2 — Contact & Login */}
        {step === 2 && (
          <div className="space-y-4">
            <div><label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Email Address *</label><input type="email" className="w-full border p-2.5 rounded-lg text-sm" placeholder="you@email.com" value={form.email} onChange={e=>set("email",e.target.value)}/></div>
            <div><label className="text-xs font-semibold text-gray-600 uppercase block mb-1">WhatsApp Number *</label><input type="tel" className="w-full border p-2.5 rounded-lg text-sm" placeholder="10-digit mobile number" maxLength={10} value={form.whatsappNumber} onChange={e=>set("whatsappNumber",e.target.value.replace(/\D/g,""))}/></div>
            <div><label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Password *</label><input type="password" className="w-full border p-2.5 rounded-lg text-sm" placeholder="Min 6 characters" value={form.password} onChange={e=>set("password",e.target.value)}/></div>
            <div><label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Confirm Password *</label><input type="password" className="w-full border p-2.5 rounded-lg text-sm" placeholder="Re-enter password" value={form.confirmPassword} onChange={e=>set("confirmPassword",e.target.value)}/></div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
              💳 Payment will be required after registration to access the examination.
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <button onClick={()=>{setStep(s=>s-1);setError("")}} className="flex-1 border border-gray-300 py-3 rounded-xl text-sm font-medium">
              ← Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={next} className="flex-1 bg-black text-white py-3 rounded-xl text-sm font-medium">
              Next →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading} className="flex-1 bg-black text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50">
              {loading ? "Creating Account..." : "Create Account →"}
            </button>
          )}
        </div>

        <p className="text-center text-sm mt-4 text-gray-500">
          Already have an account? <Link to="/login" className="text-black font-semibold underline">Login</Link>
        </p>
      </div>
    </div>
  )
}

export default Signup 