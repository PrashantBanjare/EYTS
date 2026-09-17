import { BrowserRouter, Routes, Route } from "react-router-dom"
import Home from "./pages/Home"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import Dashboard from "./pages/Dashboard"
import Payment from "./pages/Payment"
import ProtectedRoute from "./routes/ProtectedRoute"
import Exam from "./pages/Exam"
import Result from "./pages/Result"
import Leaderboard from "./pages/Leaderboard"
import Admin from "./pages/Admin"
import Profile from "./pages/Profile"
import ForgotPassword from "./pages/ForgotPassword"
import Employee from "./pages/Employee"
import EmployeeProfile from "./pages/EmployeeProfile"
import ParentalConsent from "./pages/ParentalConsent"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/employee" element={<ProtectedRoute><Employee /></ProtectedRoute>} />
        <Route path="/payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
        <Route path="/exam" element={<ProtectedRoute><Exam /></ProtectedRoute>} />
        {/* Consent is collected before the exam, so it needs a login but
            not a payment or an attempt. Exam.jsx redirects here when the
            server refuses to start a minor's camera-monitored sitting. */}
        <Route path="/parental-consent" element={<ProtectedRoute><ParentalConsent /></ProtectedRoute>} />
        <Route path="/result/:attemptId" element={<ProtectedRoute><Result /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly={true}><Admin /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/employee/profile" element={<ProtectedRoute><EmployeeProfile /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App