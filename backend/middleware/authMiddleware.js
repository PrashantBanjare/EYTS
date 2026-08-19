const jwt = require("jsonwebtoken")

const protect = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized, no token" })
  }

  const token = authHeader.split(" ")[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded  // { id, role }
    next()
  } catch (error) {
    return res.status(401).json({ message: "Token is invalid or expired" })
  }
}

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin access only" })
  }
  next()
}

module.exports = { protect, adminOnly }