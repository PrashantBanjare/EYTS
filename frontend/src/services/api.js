import axios from "axios"

const api = axios.create({
  baseURL: "http://localhost:5000/api",
})

// Automatically attach token to every request if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const authService = {
  signup: (data) => api.post("/auth/signup", data),
  login: (data) => api.post("/auth/login", data),
  getMe: () => api.get("/auth/me"),
  sendRegistrationOtp: (email) => api.post("/auth/send-registration-otp", { email }),
  verifyRegistrationOtp: (email, otp) => api.post("/auth/verify-registration-otp", { email, otp }),
}

export const paymentService = {
  validateCoupon: (code) => api.post("/payments/validate-coupon", { code }),
  createOrder: (couponCode) => api.post("/payments/create-order", { couponCode }),
  verifyPayment: (razorpay_order_id, razorpay_payment_id, razorpay_signature) =>
    api.post("/payments/verify", { razorpay_order_id, razorpay_payment_id, razorpay_signature }),
  getStatus: () => api.get("/payments/status"),
  getMyPayments: () => api.get("/payments/my"),
  getAllPayments: () => api.get("/payments/all"),
  grantFreeAccess: (userId) => api.post("/payments/grant-access", { userId }),
  createCoupon: (data) => api.post("/payments/coupons", data),
  getCoupons: () => api.get("/payments/coupons"),
  toggleCoupon: (id) => api.patch(`/payments/coupons/${id}`),
  refund: (paymentId, reason, note) =>
    api.post("/payments/refund", { paymentId, reason, note }),
}

export const examService = {
  getActive: () => api.get("/exams/active"),
}

export const attemptService = {
  start: (examId) => api.post("/attempts/start", { examId }),
  submit: (attemptId, answers, timeTaken) =>
    api.post("/attempts/submit", { attemptId, answers, timeTaken }),
  getMyAttempts: () => api.get("/attempts/my"),
  getResult: (attemptId) => api.get(`/attempts/${attemptId}/result`),
  getLeaderboard: (examId) => api.get(`/attempts/leaderboard/${examId}`),
}

// ═══════════════════════════════════════════════════════════════
//  PROCTORING
//
//  recordEvents is deliberately fire-and-forget: a failed write must
//  never surface as an error to a candidate mid-examination. The
//  server returns 200 even when it cannot store the batch, and this
//  catch is a second line of defence for network failures.
// ═══════════════════════════════════════════════════════════════
export const proctoringService = {
  // Student — before starting
  getConfig: (examId) => api.get(`/proctoring/config/${examId}`),

  // Student — during the sitting
  recordEvents: (attemptId, events) =>
    api.post("/proctoring/events", { attemptId, events }).catch(() => null),

  recordSnapshot: (attemptId, imageData, flagged, flagReason) =>
    api.post("/proctoring/snapshot", { attemptId, imageData, flagged, flagReason })
      .catch(() => null),

  // Parental consent
  requestConsent: (data) => api.post("/proctoring/consent/request", data),
  verifyConsent: (otp) => api.post("/proctoring/consent/verify", { otp }),
  getConsentStatus: () => api.get("/proctoring/consent/status"),

  // Admin
  getFlagged: () => api.get("/proctoring/flagged"),
  getReport: (attemptId) => api.get(`/proctoring/report/${attemptId}`),
  getSnapshot: (id) => api.get(`/proctoring/snapshot/${id}`),
  getAllConsents: () => api.get("/proctoring/consents"),
  setStudentProctoring: (userId, data) =>
    api.patch(`/proctoring/student/${userId}`, data),
}

export default api