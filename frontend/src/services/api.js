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

export default api