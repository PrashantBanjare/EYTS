import { createContext, useContext, useState, useEffect } from "react"
import { authService } from "../services/api"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // On app load, check if token exists and fetch user
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) {
      authService.getMe()
        .then((res) => setUser(res.data.user))
        .catch(() => localStorage.removeItem("token"))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    const res = await authService.login({ email, password })
    localStorage.setItem("token", res.data.token)
    setUser(res.data.user)
    return res.data.user
  }

  const signup = async (name, email, password, phone, extraFields = {}) => {
    const res = await authService.signup({
      name, email, password,
      whatsappNumber: phone,
      ...extraFields
    })
    localStorage.setItem("token", res.data.token)
    setUser(res.data.user)
    return res.data.user
  }

  const logout = () => {
    localStorage.removeItem("token")
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}