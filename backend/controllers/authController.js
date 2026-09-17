const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const { PrismaClient } = require("@prisma/client")
const { sendEmail } = require("../utils/emailService")
const { otpEmailTemplate } = require("../utils/emailTemplates")

const prisma = new PrismaClient()

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  )
}

// POST /api/auth/signup
const signup = async (req, res) => {
  try {
    const {
      name, fatherName, motherName, qualification,
      institutionName, passingYear, occupation, occupationField,
      aadharNumber, address, gender, age,
      email, whatsappNumber, password, referralCode
    } = req.body

    // Validate required fields
    const required = { name, fatherName, motherName, qualification, institutionName, passingYear, occupation, aadharNumber, address, gender, age, email, whatsappNumber, password }
    for (const [key, val] of Object.entries(required)) {
      if (!val && val !== 0) {
        return res.status(400).json({ message: `${key} is required` })
      }
    }

    // Check duplicate email
    const existingEmail = await prisma.user.findUnique({ where: { email } })
    if (existingEmail) {
      return res.status(409).json({ message: "Email already registered" })
    }

    // Check duplicate aadhar
    const existingAadhar = await prisma.user.findUnique({ where: { aadharNumber } })
    if (existingAadhar) {
      return res.status(409).json({ message: "Aadhar number already registered" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    // ── Link this student to the employee who referred them ──
    // An unrecognised code is ignored rather than rejected: never block a
    // paying student because an agent mistyped their own code.
    let referredById = null
    if (referralCode) {
      const referrer = await prisma.user.findFirst({
        where: {
          referralCode: referralCode.toUpperCase(),
          role: "EMPLOYEE",
          isActive: true
        },
        select: { id: true }
      })
      if (referrer) referredById = referrer.id
    }

    const user = await prisma.user.create({
      data: {
        name, fatherName, motherName, qualification,
        institutionName, passingYear, occupation,
        occupationField: occupationField || null,
        aadharNumber, address, gender,
        age: parseInt(age),
        email, whatsappNumber, password: hashedPassword,
        referredById
      }
    })

    const token = generateToken(user)

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        id: user.id, name: user.name, email: user.email,
        whatsappNumber: user.whatsappNumber, role: user.role
      }
    })
  } catch (error) {
    console.error("Signup error:", error)
    res.status(500).json({ message: "Something went wrong" })
  }
}

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" })
    }

    // Find user 
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" })
    }

    // Deactivated employees keep their records but cannot sign in
    if (user.isActive === false) {
      return res.status(403).json({ message: "This account has been deactivated. Please contact the office." })
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" })
    }

    const token = generateToken(user)

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        whatsappNumber: user.whatsappNumber,
        role: user.role,
        employeeCode: user.employeeCode,
        referralCode: user.referralCode
      }
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ message: "Something went wrong" })
  }
}

// GET /api/auth/me  (protected)
const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        whatsappNumber: true,
        role: true,
        createdAt: true,

        // student records — shown on the Profile page
        fatherName: true,
        motherName: true,
        gender: true,
        age: true,
        aadharNumber: true,
        address: true,
        qualification: true,
        occupation: true,
        occupationField: true,
        institutionName: true,
        passingYear: true,

        // employee fields
        employeeCode: true,
        referralCode: true,
        isActive: true,
        photoUrl: true,
        panNumber: true,
        bankAccountName: true,
        bankAccountNumber: true,
        bankIfsc: true,
        upiId: true,
        emergencyContactName: true,
        emergencyContactPhone: true
      }
    })
    res.status(200).json({ user })
  } catch (error) {
    console.error("GetMe error:", error)
    res.status(500).json({ message: "Something went wrong" })
  }
}

// GET /api/auth/students — admin gets all students
const getStudents = async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: "STUDENT" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        whatsappNumber: true,
        institutionName: true,
        createdAt: true,
        // who recruited them, so the office can see referral performance
        referredBy: {
          select: { id: true, name: true, employeeCode: true }
        }
      }
    })
    res.status(200).json({ students })
  } catch (error) {
    console.error("getStudents error:", error)
    res.status(500).json({ message: "Something went wrong" })
  }
}

// PATCH /api/auth/profile — student updates their profile
const updateProfile = async (req, res) => {
  try {
    const { name, whatsappNumber } = req.body
    const userId = req.user.id

    // Validate inputs
    if (!name || !whatsappNumber) {
      return res.status(400).json({ message: "Name and WhatsApp number are required" })
    }

    if (!/^[a-zA-Z\s.]+$/.test(name.trim())) {
      return res.status(400).json({ message: "Name can contain only letters, spaces and full stops" })
    }

    if (!/^\d{10}$/.test(whatsappNumber)) {
      return res.status(400).json({ message: "WhatsApp number must be exactly 10 digits" })
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name: name.trim(), whatsappNumber },
      select: { 
        id: true, 
        name: true, 
        email: true, 
        whatsappNumber: true, 
        role: true, 
        createdAt: true 
      }
    })

    res.status(200).json({ message: "Profile updated successfully", user })
  } catch (error) {
    console.error("updateProfile error:", error)
    res.status(500).json({ message: "Something went wrong" })
  }
}

// POST /api/auth/forgot-password — request OTP
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: "Email is required" })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      // Don't reveal whether the email exists
      return res.status(200).json({ message: "If this email is registered, an OTP has been sent." })
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: { resetOtp: otp, resetOtpExpiry }
    })

    await sendEmail({
      to: user.email,
      subject: "TalentExam — Password Reset OTP",
      html: otpEmailTemplate({ name: user.name, otp })
    })

    res.status(200).json({ message: "If this email is registered, an OTP has been sent." })
  } catch (error) {
    console.error("forgotPassword error:", error)
    res.status(500).json({ message: "Something went wrong" })
  }
}

// POST /api/auth/verify-otp — verify OTP only
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.resetOtp || !user.resetOtpExpiry) {
      return res.status(400).json({ message: "Invalid or expired OTP" })
    }

    if (user.resetOtp !== otp) {
      return res.status(400).json({ message: "Incorrect OTP" })
    }

    if (new Date() > user.resetOtpExpiry) {
      return res.status(400).json({ message: "OTP has expired" })
    }

    res.status(200).json({ message: "OTP verified successfully" })
  } catch (error) {
    console.error("verifyOtp error:", error)
    res.status(500).json({ message: "Something went wrong" })
  }
}

// POST /api/auth/reset-password — set new password after OTP verification
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP and new password are required" })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.resetOtp || !user.resetOtpExpiry) {
      return res.status(400).json({ message: "Invalid or expired OTP" })
    }

    if (user.resetOtp !== otp) {
      return res.status(400).json({ message: "Incorrect OTP" })
    }

    if (new Date() > user.resetOtpExpiry) {
      return res.status(400).json({ message: "OTP has expired" })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, resetOtp: null, resetOtpExpiry: null }
    })

    res.status(200).json({ message: "Password reset successfully" })
  } catch (error) {
    console.error("resetPassword error:", error)
    res.status(500).json({ message: "Something went wrong" })
  }
}

// POST /api/auth/send-registration-otp
const sendRegistrationOtp = async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: "Email is required" })

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(409).json({ message: "Email already registered" })

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiry = new Date(Date.now() + 10 * 60 * 1000)

    global.pendingRegistrationOtps = global.pendingRegistrationOtps || {}
    global.pendingRegistrationOtps[email] = { otp, expiry, verified: false }

    await sendEmail({
      to: email,
      subject: "TalentExam — Verify Your Email",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
          <div style="background:#000;color:#fff;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="margin:0;font-size:20px;">Email Verification</h1>
          </div>
          <div style="background:#f9f9f9;padding:24px;border-radius:0 0 12px 12px;">
            <p>Use the OTP below to verify your email and complete registration.</p>
            <div style="background:#fff;padding:20px;border-radius:10px;text-align:center;margin:20px 0;">
              <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#000;">${otp}</span>
            </div>
            <p style="font-size:13px;color:#999;">This OTP expires in 10 minutes. Do not share it with anyone.</p>
            <p style="font-size:13px;color:#999;">— TalentExam Team</p>
          </div>
        </div>
      `
    })

    res.status(200).json({ message: "OTP sent to your email" })
  } catch (error) {
    console.error("sendRegistrationOtp error:", error)
    res.status(500).json({ message: "Something went wrong" })
  }
}

// POST /api/auth/verify-registration-otp
const verifyRegistrationOtp = async (req, res) => {
  try {
    const { email, otp } = req.body
    if (!email || !otp) return res.status(400).json({ message: "Email and OTP required" })

    const pending = global.pendingRegistrationOtps?.[email]
    if (!pending) return res.status(400).json({ message: "No OTP found. Please request a new one." })

    if (new Date() > pending.expiry) {
      delete global.pendingRegistrationOtps[email]
      return res.status(400).json({ message: "OTP has expired. Please request a new one." })
    }

    if (pending.otp !== otp) return res.status(400).json({ message: "Incorrect OTP" })

    global.pendingRegistrationOtps[email].verified = true

    res.status(200).json({ message: "Email verified successfully" })
  } catch (error) {
    console.error("verifyRegistrationOtp error:", error)
    res.status(500).json({ message: "Something went wrong" })
  }
}


module.exports = { signup, login, getMe, getStudents, updateProfile, forgotPassword, verifyOtp, resetPassword, sendRegistrationOtp, verifyRegistrationOtp }