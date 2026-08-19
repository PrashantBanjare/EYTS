const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

// Adding, editing or removing a question after students have sat the paper
// would invalidate every score already recorded, so each write checks first.
const attemptCountForSection = async (sectionId) => {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { examId: true },
  })
  if (!section) return { exists: false, count: 0, examId: null }
  const count = await prisma.examAttempt.count({ where: { examId: section.examId } })
  return { exists: true, count, examId: section.examId }
}

// ═══════════════════════════════════════════════════════════════════
//  POST /api/exams/questions — admin adds a question
// ═══════════════════════════════════════════════════════════════════
const addQuestion = async (req, res) => {
  try {
    const { sectionId, text, explanation, options } = req.body

    if (!sectionId || !text || !Array.isArray(options) || options.length !== 4) {
      return res.status(400).json({ message: "sectionId, text and exactly 4 options are required" })
    }

    if (!text.trim() || text.trim().length < 5) {
      return res.status(400).json({ message: "The question text is too short" })
    }

    const { exists, count } = await attemptCountForSection(sectionId)
    if (!exists) return res.status(404).json({ message: "Section not found" })
    if (count > 0) {
      return res.status(400).json({
        message: `${count} student(s) have already attempted this examination. Adding a question now would invalidate their scores.`,
      })
    }

    // Keys must be exactly A, B, C, D — one of each.
    const keys = options.map((o) => (o.key || "").toUpperCase())
    if (["A", "B", "C", "D"].some((k) => keys.filter((x) => x === k).length !== 1)) {
      return res.status(400).json({ message: "Options must be keyed A, B, C and D, one of each" })
    }

    const empty = options.filter((o) => !o.text || !o.text.trim())
    if (empty.length > 0) {
      return res.status(400).json({ message: "Every option needs text" })
    }

    // Two identical options make the question unanswerable.
    const texts = options.map((o) => o.text.trim().toLowerCase())
    if (new Set(texts).size !== texts.length) {
      return res.status(400).json({ message: "Two or more options are identical" })
    }

    // EXACTLY one correct, not "at least one". submitAttempt scores with
    // options.find(o => o.isCorrect), which silently takes whichever row
    // comes back first — so two correct answers make the question
    // unscoreable in a way nobody would notice until results were disputed.
    const correctCount = options.filter((o) => o.isCorrect).length
    if (correctCount === 0) {
      return res.status(400).json({ message: "Mark one option as the correct answer" })
    }
    if (correctCount > 1) {
      return res.status(400).json({
        message: `${correctCount} options are marked correct. Exactly one must be.`,
      })
    }

    // Duplicate question text within the same exam
    const { examId } = await attemptCountForSection(sectionId)
    const duplicate = await prisma.question.findFirst({
      where: { section: { examId }, text: text.trim() },
      select: { id: true },
    })
    if (duplicate) {
      return res.status(409).json({ message: "This question already exists on this examination" })
    }

    const existingInSection = await prisma.question.count({ where: { sectionId } })

    const question = await prisma.question.create({
      data: {
        sectionId,
        text: text.trim(),
        explanation: explanation?.trim() || null,
        order: existingInSection,
        options: {
          create: options.map((o) => ({
            key: o.key.toUpperCase(),
            text: o.text.trim(),
            isCorrect: !!o.isCorrect,
          })),
        },
      },
      include: { options: { orderBy: { key: "asc" } } },
    })

    res.status(201).json({ message: "Question added", question })
  } catch (error) {
    console.error("addQuestion error:", error)
    res.status(500).json({ message: "Something went wrong" })
  }
}

// ═══════════════════════════════════════════════════════════════════
//  PATCH /api/exams/questions/:id — admin edits a question
//  Previously the only way to fix a typo was delete and retype.
// ═══════════════════════════════════════════════════════════════════
const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params
    const { text, explanation, options, correctKey } = req.body

    const question = await prisma.question.findUnique({
      where: { id },
      include: { options: true, section: { select: { examId: true } } },
    })
    if (!question) return res.status(404).json({ message: "Question not found" })

    const answered = await prisma.attemptAnswer.count({ where: { questionId: id } })
    if (answered > 0) {
      return res.status(400).json({
        message: `${answered} student(s) have already answered this question. Editing it would change what they were marked against.`,
      })
    }

    // ── Text ──
    if (text !== undefined) {
      if (!text.trim() || text.trim().length < 5) {
        return res.status(400).json({ message: "The question text is too short" })
      }
      const clash = await prisma.question.findFirst({
        where: {
          section: { examId: question.section.examId },
          text: text.trim(),
          id: { not: id },
        },
        select: { id: true },
      })
      if (clash) {
        return res.status(409).json({ message: "Another question on this examination has the same text" })
      }
    }

    // ── Options ──
    // Accepts either a full replacement array, or just correctKey to move
    // the answer without retyping the options.
    if (options !== undefined) {
      if (!Array.isArray(options) || options.length !== 4) {
        return res.status(400).json({ message: "Exactly 4 options are required" })
      }
      if (options.some((o) => !o.text || !o.text.trim())) {
        return res.status(400).json({ message: "Every option needs text" })
      }
      const texts = options.map((o) => o.text.trim().toLowerCase())
      if (new Set(texts).size !== texts.length) {
        return res.status(400).json({ message: "Two or more options are identical" })
      }
      const correctCount = options.filter((o) => o.isCorrect).length
      if (correctCount !== 1) {
        return res.status(400).json({
          message: correctCount === 0
            ? "Mark one option as the correct answer"
            : `${correctCount} options are marked correct. Exactly one must be.`,
        })
      }
    } else if (correctKey !== undefined) {
      if (!["A", "B", "C", "D"].includes(String(correctKey).toUpperCase())) {
        return res.status(400).json({ message: "correctKey must be A, B, C or D" })
      }
    }

    // Replace options wholesale rather than diffing — four rows, and a
    // partial update could momentarily leave zero or two correct answers.
    await prisma.$transaction(async (tx) => {
      await tx.question.update({
        where: { id },
        data: {
          ...(text !== undefined ? { text: text.trim() } : {}),
          ...(explanation !== undefined ? { explanation: explanation?.trim() || null } : {}),
        },
      })

      if (options !== undefined) {
        await tx.questionOption.deleteMany({ where: { questionId: id } })
        await tx.questionOption.createMany({
          data: options.map((o) => ({
            questionId: id,
            key: (o.key || "").toUpperCase(),
            text: o.text.trim(),
            isCorrect: !!o.isCorrect,
          })),
        })
      } else if (correctKey !== undefined) {
        const target = String(correctKey).toUpperCase()
        await tx.questionOption.updateMany({
          where: { questionId: id },
          data: { isCorrect: false },
        })
        await tx.questionOption.updateMany({
          where: { questionId: id, key: target },
          data: { isCorrect: true },
        })
      }
    })

    const updated = await prisma.question.findUnique({
      where: { id },
      include: { options: { orderBy: { key: "asc" } } },
    })

    res.status(200).json({ message: "Question updated", question: updated })
  } catch (error) {
    console.error("updateQuestion error:", error)
    res.status(500).json({ message: "Something went wrong" })
  }
}

// ═══════════════════════════════════════════════════════════════════
//  DELETE /api/exams/questions/:id — admin deletes a question
// ═══════════════════════════════════════════════════════════════════
const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params

    const question = await prisma.question.findUnique({
      where: { id },
      select: { id: true, sectionId: true, text: true },
    })
    if (!question) return res.status(404).json({ message: "Question not found" })

    // AttemptAnswer rows reference this question. Deleting it would either
    // fail on the foreign key or orphan a student's answer, so refuse.
    const answered = await prisma.attemptAnswer.count({ where: { questionId: id } })
    if (answered > 0) {
      return res.status(400).json({
        message: `${answered} student(s) have answered this question. It cannot be deleted without destroying their answer sheets.`,
      })
    }

    await prisma.$transaction([
      prisma.questionOption.deleteMany({ where: { questionId: id } }),
      prisma.question.delete({ where: { id } }),
    ])

    // Close the gap left in the ordering.
    const remaining = await prisma.question.findMany({
      where: { sectionId: question.sectionId },
      orderBy: { order: "asc" },
      select: { id: true },
    })
    await Promise.all(
      remaining.map((q, i) => prisma.question.update({ where: { id: q.id }, data: { order: i } }))
    )

    res.status(200).json({ message: "Question deleted" })
  } catch (error) {
    console.error("deleteQuestion error:", error)
    res.status(500).json({ message: "Something went wrong" })
  }
}

// ═══════════════════════════════════════════════════════════════════
//  POST /api/exams/sections — admin adds a section
// ═══════════════════════════════════════════════════════════════════
const addSection = async (req, res) => {
  try {
    const { examId, name, order } = req.body

    if (!examId || !name || !name.trim()) {
      return res.status(400).json({ message: "examId and name are required" })
    }

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { sections: { select: { id: true, name: true } } },
    })
    if (!exam) return res.status(404).json({ message: "Examination not found" })

    // Section names are matched by name in the bulk importer, so duplicates
    // would make a CSV row ambiguous.
    const clash = exam.sections.find(
      (s) => s.name.trim().toLowerCase() === name.trim().toLowerCase()
    )
    if (clash) {
      return res.status(409).json({ message: `A section named "${name.trim()}" already exists on this examination` })
    }

    const attempts = await prisma.examAttempt.count({ where: { examId } })
    if (attempts > 0) {
      return res.status(400).json({
        message: `${attempts} student(s) have attempted this examination. Its structure can no longer be changed.`,
      })
    }

    const section = await prisma.section.create({
      data: {
        examId,
        name: name.trim(),
        order: order !== undefined && order !== null && order !== ""
          ? parseInt(order)
          : exam.sections.length,
      },
    })

    res.status(201).json({ message: "Section added", section })
  } catch (error) {
    console.error("addSection error:", error)
    res.status(500).json({ message: "Something went wrong" })
  }
}

// ═══════════════════════════════════════════════════════════════════
//  PATCH /api/exams/sections/:id — rename or reorder a section
// ═══════════════════════════════════════════════════════════════════
const updateSection = async (req, res) => {
  try {
    const { id } = req.params
    const { name, order } = req.body

    const section = await prisma.section.findUnique({
      where: { id },
      select: { id: true, examId: true, name: true },
    })
    if (!section) return res.status(404).json({ message: "Section not found" })

    const data = {}

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ message: "The section name cannot be empty" })

      const clash = await prisma.section.findFirst({
        where: {
          examId: section.examId,
          name: { equals: name.trim(), mode: "insensitive" },
          id: { not: id },
        },
        select: { id: true },
      })
      if (clash) {
        return res.status(409).json({ message: `Another section on this examination is already named "${name.trim()}"` })
      }
      data.name = name.trim()
    }

    if (order !== undefined) {
      const n = parseInt(order)
      if (isNaN(n) || n < 0) return res.status(400).json({ message: "Order must be 0 or greater" })
      data.order = n
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "Nothing to update" })
    }

    // Renaming is safe mid-exam; reordering changes the order students see,
    // so it is blocked once anyone has sat the paper.
    if (data.order !== undefined) {
      const attempts = await prisma.examAttempt.count({ where: { examId: section.examId } })
      if (attempts > 0) {
        return res.status(400).json({
          message: `${attempts} student(s) have attempted this examination. Sections can no longer be reordered.`,
        })
      }
    }

    const updated = await prisma.section.update({ where: { id }, data })
    res.status(200).json({ message: "Section updated", section: updated })
  } catch (error) {
    console.error("updateSection error:", error)
    res.status(500).json({ message: "Something went wrong" })
  }
}

// ═══════════════════════════════════════════════════════════════════
//  DELETE /api/exams/sections/:id — delete an empty section
// ═══════════════════════════════════════════════════════════════════
const deleteSection = async (req, res) => {
  try {
    const { id } = req.params

    const section = await prisma.section.findUnique({
      where: { id },
      include: { questions: { select: { id: true } } },
    })
    if (!section) return res.status(404).json({ message: "Section not found" })

    const attempts = await prisma.examAttempt.count({ where: { examId: section.examId } })
    if (attempts > 0) {
      return res.status(400).json({
        message: `${attempts} student(s) have attempted this examination. Its structure can no longer be changed.`,
      })
    }

    // Deleting questions silently along with the section is too destructive
    // to do on one click. Make the admin clear it first, deliberately.
    if (section.questions.length > 0) {
      return res.status(400).json({
        message: `"${section.name}" still holds ${section.questions.length} question(s). Delete or move them first.`,
      })
    }

    await prisma.section.delete({ where: { id } })

    // Close the gap in the ordering.
    const remaining = await prisma.section.findMany({
      where: { examId: section.examId },
      orderBy: { order: "asc" },
      select: { id: true },
    })
    await Promise.all(
      remaining.map((s, i) => prisma.section.update({ where: { id: s.id }, data: { order: i } }))
    )

    res.status(200).json({ message: `Section "${section.name}" deleted` })
  } catch (error) {
    console.error("deleteSection error:", error)
    res.status(500).json({ message: "Something went wrong" })
  }
}

module.exports = {
  addQuestion,
  updateQuestion,
  deleteQuestion,
  addSection,
  updateSection,
  deleteSection,
}
