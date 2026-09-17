const express = require("express")
const router = express.Router()

const {
  getActiveExam, getAllExams, createExam, updateExam,
} = require("../controllers/examController")

const {
  addQuestion, updateQuestion, deleteQuestion,
  addSection, updateSection, deleteSection,
} = require("../controllers/questionController")

const { protect, adminOnly } = require("../middleware/authMiddleware")

// ── Student ───────────────────────────────────────────────────────
// Note: getActiveExam deliberately withholds isCorrect and explanation.
router.get("/active", protect, getActiveExam)

// ── Admin: exams ──────────────────────────────────────────────────
router.get("/", protect, adminOnly, getAllExams)
router.post("/", protect, adminOnly, createExam)
router.patch("/:id", protect, adminOnly, updateExam)

// ── Admin: sections ───────────────────────────────────────────────
// These must be declared before "/:id" patterns that could swallow them.
router.post("/sections", protect, adminOnly, addSection)
router.patch("/sections/:id", protect, adminOnly, updateSection)
router.delete("/sections/:id", protect, adminOnly, deleteSection)

// ── Admin: questions ──────────────────────────────────────────────
router.post("/questions", protect, adminOnly, addQuestion)
router.patch("/questions/:id", protect, adminOnly, updateQuestion)
router.delete("/questions/:id", protect, adminOnly, deleteQuestion)

module.exports = router