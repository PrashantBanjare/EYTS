import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    // Validation
    if (!email || !password) {
      setError("Email and password are required")
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setLoading(true)

    try {
      const user = await login(email, password)
      
      // Check user role and redirect
      if (user.role === "ADMIN") {
        navigate("/admin")
      }else if (user.role === "EMPLOYEE") {
        navigate("/employee")
      }else {
        navigate("/dashboard")
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Login failed. Please try again."
      setError(errorMessage)
      console.error("Login error:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-lg w-[400px]">
        <h1 className="text-3xl font-bold mb-6 text-center">Login</h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm border border-red-300">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
              Email Address
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full border border-gray-300 p-3 rounded-lg text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full border border-gray-300 p-3 rounded-lg text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white p-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition hover:bg-gray-900 active:scale-95"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Logging in...
              </span>
            ) : (
              "Login"
            )}
          </button>
        </form>

        <div className="mt-4 space-y-3 text-center text-sm">
          <div>
            <Link 
              to="/forgot-password" 
              className="text-black underline hover:text-gray-700 transition"
            >
              Forgot Password?
            </Link>
          </div>

          <div className="border-t pt-3">
            <p className="text-gray-600 mb-2">
              Don't have an account?{" "}
              <Link 
                to="/signup" 
                className="text-black font-semibold underline hover:text-gray-700 transition"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-500 text-center">
          Demo credentials: use your registered email and password
        </div>
      </div>
    </div>
  )
}

export default Login