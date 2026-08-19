const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

// ═══════════════════════════════════════════════════════════════════
//  BULK QUESTION IMPORT
//
//  Expected columns (header row required, order is fixed):
//    section, question, optionA, optionB, optionC, optionD, correct, explanation
//
//  `section` matches an existing section name on the exam, case-insensitively.
//  `correct` is A, B, C or D. `explanation` is optional.
// ═══════════════════════════════════════════════════════════════════

const EXPECTED = [
  "section", "question", "optiona", "optionb", "optionc", "optiond", "correct", "explanation",
]

// A hand-rolled parser rather than a dependency, because question text
// routinely contains commas, quoted strings and the odd newline. Handles
// RFC-4180 style quoting: "" inside a quoted field is a literal quote.
const parseCsv = (text) => {
  const rows = []
  let row = []
  let field = ""
  let inQuotes = false
  let i = 0

  // Strip a UTF-8 BOM, which Excel adds and which otherwise corrupts the
  // first header name.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += ch; i++; continue
    }

    if (ch === '"') { inQuotes = true; i++; continue }
    if (ch === ",") { row.push(field); field = ""; i++; continue }
    if (ch === "\r") { i++; continue }
    if (ch === "\n") {
      row.push(field); field = ""
      if (row.some((c) => c.trim() !== "")) rows.push(row)
      row = []
      i++; continue
    }
    field += ch; i++
  }

  row.push(field)
  if (row.some((c) => c.trim() !== "")) rows.push(row)
  return rows
}

// ── GET /api/bulk/questions/template ────────────────────────────────
const getTemplate = async (req, res) => {
  try {
    const csv = [
      "section,question,optionA,optionB,optionC,optionD,correct,explanation",
      'Quantitative Aptitude,"What is 15% of 240?",36,32,40,48,A,"15% of 240 = 0.15 x 240 = 36"',
      'Quantitative Aptitude,"A train covers 120 km in 2 hours. What is its speed?","50 km/h","60 km/h","70 km/h","80 km/h",B,',
      'Reasoning,"Which number comes next: 2, 6, 12, 20, ?",28,30,32,36,B,"Differences are 4, 6, 8, then 10, so 20 + 10 = 30"',
      'General Knowledge,"Which state is Kawardha located in?",Chhattisgarh,"Madhya Pradesh",Jharkhand,Odisha,A,',
    ].join("\n")

    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader("Content-Disposition", 'attachment; filename="question_template.csv"')
    res.status(200).send("\uFEFF" + csv)   // BOM keeps Excel in UTF-8
  } catch (error) {
    console.error("getTemplate error:", error)
    res.status(500).json({ message: "Could not generate the template" })
  }
}

// ── POST /api/bulk/questions/validate ───────────────────────────────
//  Dry run. Parses and checks everything, writes nothing. The admin sees
//  exactly what would be imported and what is wrong before committing.
const validateImport = async (req, res) => {
  try {
    const { examId, csv } = req.body

    if (!examId) return res.status(400).json({ message: "Select an examination first" })
    if (!csv || !csv.trim()) return res.status(400).json({ message: "The file is empty" })

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { sections: { include: { questions: { select: { id: true, text: true } } } } },
    })
    if (!exam) return res.status(404).json({ message: "Examination not found" })
    if (exam.sections.length === 0) {
      return res.status(400).json({
        message: "This examination has no sections. Add at least one section before importing questions.",
      })
    }

    const rows = parseCsv(csv)
    if (rows.length < 2) {
      return res.status(400).json({ message: "The file needs a header row and at least one question" })
    }

    // ── Header check ──
    const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, ""))
    const missing = EXPECTED.slice(0, 7).filter((c) => !header.includes(c))
    if (missing.length > 0) {
      return res.status(400).json({
        message: `The header row is missing: ${missing.join(", ")}. Download the template to see the expected format.`,
      })
    }

    const idx = {}
    EXPECTED.forEach((c) => { idx[c] = header.indexOf(c) })

    // Section lookup, case-insensitive and whitespace-tolerant
    const sectionByName = {}
    exam.sections.forEach((s) => {
      sectionByName[s.name.trim().toLowerCase()] = s
    })

    // Existing question text, to warn about duplicates
    const existingText = new Set()
    exam.sections.forEach((s) =>
      s.questions.forEach((q) => existingText.add(q.text.trim().toLowerCase()))
    )

    const seenInFile = new Set()
    const valid = []
    const errors = []
    const warnings = []

    for (let r = 1; r < rows.length; r++) {
      const line = r + 1                 // 1-based, matching a spreadsheet
      const cells = rows[r]
      const get = (col) => (cells[idx[col]] ?? "").trim()

      const sectionName = get("section")
      const text = get("question")
      const options = {
        A: get("optiona"), B: get("optionb"),
        C: get("optionc"), D: get("optiond"),
      }
      const correct = get("correct").toUpperCase()
      const explanation = idx.explanation >= 0 ? get("explanation") : ""

      const rowErrors = []

      if (!sectionName) rowErrors.push("section is empty")
      else if (!sectionByName[sectionName.toLowerCase()]) {
        rowErrors.push(
          `section "${sectionName}" does not exist on this exam (available: ${exam.sections.map(s => s.name).join(", ")})`
        )
      }

      if (!text) rowErrors.push("question is empty")
      else if (text.length < 5) rowErrors.push("question is too short")

      const emptyOptions = Object.entries(options)
        .filter(([, v]) => !v)
        .map(([k]) => k)
      if (emptyOptions.length > 0) {
        rowErrors.push(`option ${emptyOptions.join(", ")} is empty`)
      }

      if (!correct) rowErrors.push("correct is empty")
      else if (!["A", "B", "C", "D"].includes(correct)) {
        rowErrors.push(`correct must be A, B, C or D (found "${correct}")`)
      }

      // Two identical options make the question unanswerable
      const optValues = Object.values(options).map((v) => v.trim().toLowerCase()).filter(Boolean)
      if (new Set(optValues).size !== optValues.length) {
        rowErrors.push("two or more options are identical")
      }

      if (rowErrors.length > 0) {
        errors.push({ line, question: text.slice(0, 60), problems: rowErrors })
        continue
      }

      const key = text.trim().toLowerCase()
      if (existingText.has(key)) {
        warnings.push({ line, message: `already exists on this exam and will be skipped: "${text.slice(0, 50)}…"` })
        continue
      }
      if (seenInFile.has(key)) {
        warnings.push({ line, message: `duplicated earlier in this file and will be skipped: "${text.slice(0, 50)}…"` })
        continue
      }
      seenInFile.add(key)

      valid.push({
        line,
        sectionId: sectionByName[sectionName.toLowerCase()].id,
        sectionName: sectionByName[sectionName.toLowerCase()].name,
        text,
        explanation: explanation || null,
        correct,
        options,
      })
    }

    // Per-section tally, so the admin can see the paper is balanced
    const bySection = {}
    valid.forEach((v) => {
      bySection[v.sectionName] = (bySection[v.sectionName] || 0) + 1
    })

    res.status(200).json({
      examTitle: exam.title,
      totalRows: rows.length - 1,
      readyToImport: valid.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      bySection,
      errors: errors.slice(0, 50),
      warnings: warnings.slice(0, 50),
      preview: valid.slice(0, 5).map((v) => ({
        sectionName: v.sectionName,
        text: v.text,
        options: v.options,
        correct: v.correct,
      })),
      existingQuestionCount: existingText.size,
    })
  } catch (error) {
    console.error("validateImport error:", error)
    res.status(500).json({ message: "Could not read the file" })
  }
}

// ── POST /api/bulk/questions/import ─────────────────────────────────
//  Commits the rows that passed validation. Refuses outright if any row
//  has an error, so a paper is never half-imported.
const commitImport = async (req, res) => {
  try {
    const { examId, csv } = req.body

    if (!examId) return res.status(400).json({ message: "Select an examination first" })
    if (!csv || !csv.trim()) return res.status(400).json({ message: "The file is empty" })

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { sections: { include: { questions: { select: { text: true, order: true } } } } },
    })
    if (!exam) return res.status(404).json({ message: "Examination not found" })

    // An exam that students have already sat must not gain questions —
    // it would invalidate every score already recorded.
    const attemptCount = await prisma.examAttempt.count({ where: { examId } })
    if (attemptCount > 0) {
      return res.status(400).json({
        message: `${attemptCount} student(s) have already attempted this examination. Adding questions now would invalidate their scores. Create a new examination instead.`,
      })
    }

    const rows = parseCsv(csv)
    const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, ""))
    const idx = {}
    EXPECTED.forEach((c) => { idx[c] = header.indexOf(c) })

    const sectionByName = {}
    exam.sections.forEach((s) => { sectionByName[s.name.trim().toLowerCase()] = s })

    const existingText = new Set()
    const nextOrder = {}
    exam.sections.forEach((s) => {
      s.questions.forEach((q) => existingText.add(q.text.trim().toLowerCase()))
      nextOrder[s.id] = s.questions.length
    })

    const seen = new Set()
    const toCreate = []
    const problems = []

    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r]
      const get = (col) => (cells[idx[col]] ?? "").trim()

      const sectionName = get("section")
      const text = get("question")
      const correct = get("correct").toUpperCase()
      const opts = {
        A: get("optiona"), B: get("optionb"),
        C: get("optionc"), D: get("optiond"),
      }
      const section = sectionByName[sectionName.toLowerCase()]

      if (!section || !text || !["A", "B", "C", "D"].includes(correct) ||
          Object.values(opts).some((v) => !v)) {
        problems.push(r + 1)
        continue
      }

      const key = text.toLowerCase()
      if (existingText.has(key) || seen.has(key)) continue
      seen.add(key)

      toCreate.push({
        sectionId: section.id,
        text,
        explanation: idx.explanation >= 0 ? (get("explanation") || null) : null,
        order: nextOrder[section.id]++,
        options: ["A", "B", "C", "D"].map((k) => ({
          key: k, text: opts[k], isCorrect: k === correct,
        })),
      })
    }

    if (problems.length > 0) {
      return res.status(400).json({
        message: `${problems.length} row(s) still have errors (lines ${problems.slice(0, 10).join(", ")}${problems.length > 10 ? "…" : ""}). Fix them and re-upload — nothing has been imported.`,
      })
    }

    if (toCreate.length === 0) {
      return res.status(400).json({ message: "Nothing new to import — every question already exists on this exam" })
    }

    // One transaction: either the whole paper lands or none of it does.
    // A half-imported exam is worse than a failed import.
    let created = 0
    await prisma.$transaction(async (tx) => {
      for (const q of toCreate) {
        await tx.question.create({
          data: {
            text: q.text,
            sectionId: q.sectionId,
            order: q.order,
            explanation: q.explanation,
            options: { create: q.options },
          },
        })
        created++
      }
    }, { timeout: 120000 })   // 200+ questions can exceed the 5s default

    const total = await prisma.question.count({ where: { section: { examId } } })

    res.status(201).json({
      message: `${created} question(s) imported into ${exam.title}`,
      imported: created,
      totalOnExam: total,
    })
  } catch (error) {
    console.error("commitImport error:", error)
    res.status(500).json({ message: "The import failed. Nothing was saved." })
  }
}

// ── DELETE /api/bulk/questions/:examId — clear all questions ─────────
//  For when an import went in wrong and the paper needs starting over.
const clearQuestions = async (req, res) => {
  try {
    const { examId } = req.params
    const { confirm } = req.body || {}

    const exam = await prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) return res.status(404).json({ message: "Examination not found" })

    if (confirm !== exam.title) {
      return res.status(400).json({
        message: "Type the examination title exactly to confirm deletion",
      })
    }

    const attemptCount = await prisma.examAttempt.count({ where: { examId } })
    if (attemptCount > 0) {
      return res.status(400).json({
        message: `${attemptCount} student(s) have attempted this examination. Their answers reference these questions, so they cannot be deleted.`,
      })
    }

    const questions = await prisma.question.findMany({
      where: { section: { examId } },
      select: { id: true },
    })
    const ids = questions.map((q) => q.id)

    if (ids.length === 0) {
      return res.status(400).json({ message: "This examination has no questions to clear" })
    }

    await prisma.$transaction([
      prisma.questionOption.deleteMany({ where: { questionId: { in: ids } } }),
      prisma.question.deleteMany({ where: { id: { in: ids } } }),
    ])

    res.status(200).json({
      message: `${ids.length} question(s) removed from ${exam.title}`,
      deleted: ids.length,
    })
  } catch (error) {
    console.error("clearQuestions error:", error)
    res.status(500).json({ message: "Could not clear the questions" })
  }
}

module.exports = { getTemplate, validateImport, commitImport, clearQuestions }
