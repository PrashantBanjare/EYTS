const express = require("express")
const router = express.Router()

const { protect, adminOnly } = require("../middleware/authMiddleware")
const {
  getTemplate,
  validateImport,
  commitImport,
  clearQuestions,
} = require("../controllers/bulkController")

// Every route here is admin-only: these write and delete exam content.
router.get("/questions/template", protect, adminOnly, getTemplate)
router.post("/questions/validate", protect, adminOnly, validateImport)
router.post("/questions/import", protect, adminOnly, commitImport)
router.delete("/questions/:examId", protect, adminOnly, clearQuestions)

module.exports = router
