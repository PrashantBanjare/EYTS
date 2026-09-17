const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()
const { sendEmail } = require("../utils/emailService")
const { resultReleaseAnnouncementTemplate } = require("../utils/emailTemplates")

// ── Notify every candidate that results are live ─────────────────────
// Sent when resultReleaseAt moves from "future or unset" to "now or past".
// Fired once per release: publishing a second time with the same date does
// not re-send, because the transition has already happened.
const announceRelease = async (examId) => {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, title: true, resultReleaseAt: true, answerKeyReleaseAt: true },
    })
    if (!exam) return { sent: 0 }

    const attempts = await prisma.examAttempt.findMany({
      where: { examId, isSubmitted: true },
      select: { user: { select: { id: true, name: true, email: true } } },
    })

    let sent = 0
    for (const a of attempts) {
      if (!a.user?.email) continue

      // A durable in-app record, so the student sees it even if the email
      // is filtered into spam.
      try {
        await prisma.notification.create({
          data: {
            userId: a.user.id,
            title: "Results published",
            body: `Results for ${exam.title} are now available. Sign in to view your score, rank and percentile.`,
            type: "ANNOUNCEMENT",
            link: "/dashboard",
          },
        })
      } catch (err) {
        console.error("release notification error:", err)
      }

      sendEmail({
        to: a.user.email,
        subject: `TalentExam — results for ${exam.title} are available`,
        html: resultReleaseAnnouncementTemplate({
          name: a.user.name,
          examTitle: exam.title,
          releaseAt: exam.resultReleaseAt,
          answerKeyAt: exam.answerKeyReleaseAt,
        }),
      }).catch((err) => console.error("release email error:", err))

      sent++
    }

    console.log(`Release announced for "${exam.title}": ${sent} candidate(s) notified`)
    return { sent }
  } catch (error) {
    console.error("announceRelease error:", error)
    return { sent: 0 }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  GET /api/exams/active — student gets the active exam
//
//  SECURITY: options are selected field by field, deliberately
//  EXCLUDING isCorrect. A bare `include: { options: true }` ships the
//  entire answer key to the browser, where any student can read it in
//  the Network tab before answering a single question.
//  `explanation` is withheld for the same reason — it often names the
//  correct option. Both are returned later by the result endpoint.
//
//  Do not replace these selects with `true`.
//
//  proctoringMode IS returned: the candidate has a right to know they
//  are being watched before they agree to start. Hiding it would be
//  both unfair and, for a minor, unlawful.
// ═══════════════════════════════════════════════════════════════════
const getActiveExam = async (req, res) => {
  try {
    const exam = await prisma.exam.findFirst({
      where: { isEnabled: true },
      select: {
        id: true,
        title: true,
        description: true,
        durationSeconds: true,
        totalMarks: true,
        isEnabled: true,
        allowReattempt: true,
        resultReleaseAt: true,
        proctoringMode: true,
        requireParentalConsent: true,
        sections: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            name: true,
            order: true,
            questions: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                text: true,
                order: true,
                sectionId: true,
                // explanation withheld until results
                options: {
                  orderBy: { key: "asc" },
                  select: {
                    id: true,
                    key: true,
                    text: true,
                    // isCorrect withheld — never send this to a student
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!exam) {
      return res.status(404).json({ message: "No active exam found" })
    }

    res.status(200).json({ exam })
  } catch (error) {
    console.error("getActiveExam error:", error)
    res.status(500).json({ message: "Something went wrong" })
  }
}

// ═══════════════════════════════════════════════════════════════════
//  GET /api/exams — admin gets all exams
//  Admin-only route, so the full answer key is fine here.
// ═══════════════════════════════════════════════════════════════════
const getAllExams = async (req, res) => {
  try {
    const exams = await prisma.exam.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            questions: {
              orderBy: { order: "asc" },
              include: { options: { orderBy: { key: "asc" } } },
            },
          },
        },
        _count: { select: { attempts: true } },
      },
    })
    res.status(200).json({ exams })
  } catch (error) {
    console.error("getAllExams error:", error)
    res.status(500).json({ message: "Something went wrong" })
  }
}

// ═══════════════════════════════════════════════════════════════════
//  POST /api/exams — admin creates an exam
// ═══════════════════════════════════════════════════════════════════
const createExam = async (req, res) => {
  try {
    const { title, description, durationSeconds, totalMarks } = req.body

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Title is required" })
    }
    if (title.trim().length < 3) {
      return res.status(400).json({ message: "Title must be at least 3 characters" })
    }

    const duration = durationSeconds ? parseInt(durationSeconds) : 3600
    if (isNaN(duration) || duration < 60) {
      return res.status(400).json({ message: "Duration must be at least 60 seconds" })
    }

    const marks = totalMarks ? parseInt(totalMarks) : 50
    if (isNaN(marks) || marks < 1) {
      return res.status(400).json({ message: "Total marks must be at least 1" })
    }

    // A new exam starts unproctored. Turning monitoring on is a decision
    // somebody makes deliberately, not a default they inherit.
    const exam = await prisma.exam.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        durationSeconds: duration,
        totalMarks: marks,
      },
    })

    res.status(201).json({ message: "Exam created", exam })
  } catch (error) {
    console.error("createExam error:", error)
    res.status(500).json({ message: "Something went wrong" })
  }
}

// ═══════════════════════════════════════════════════════════════════
//  PATCH /api/exams/:id — admin updates exam settings
//
//  SECURITY: fields are whitelisted. The previous version passed
//  `req.body` straight to Prisma, so any key in the payload was written
//  to the row — including id, createdAt, or a nested relation write.
// ═══════════════════════════════════════════════════════════════════
const updateExam = async (req, res) => {
  try {
    const { id } = req.params
    const {
      title, description, durationSeconds, totalMarks,
      isEnabled, allowReattempt, resultReleaseAt, answerKeyReleaseAt,
      proctoringMode, requireParentalConsent,
    } = req.body

    const existing = await prisma.exam.findUnique({
      where: { id },
      include: { _count: { select: { attempts: true } } },
    })
    if (!existing) {
      return res.status(404).json({ message: "Exam not found" })
    }

    const data = {}

    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ message: "Title cannot be empty" })
      data.title = title.trim()
    }

    if (description !== undefined) {
      data.description = description?.trim() || null
    }

    if (durationSeconds !== undefined) {
      const n = parseInt(durationSeconds)
      if (isNaN(n) || n < 60) {
        return res.status(400).json({ message: "Duration must be at least 60 seconds" })
      }
      // Changing the clock mid-exam would corrupt attempts in progress.
      const inProgress = await prisma.examAttempt.count({
        where: { examId: id, isSubmitted: false },
      })
      if (inProgress > 0) {
        return res.status(400).json({
          message: `${inProgress} student(s) are sitting this exam now. Wait until they finish before changing the duration.`,
        })
      }
      data.durationSeconds = n
    }

    if (totalMarks !== undefined) {
      const n = parseInt(totalMarks)
      if (isNaN(n) || n < 1) {
        return res.status(400).json({ message: "Total marks must be at least 1" })
      }
      data.totalMarks = n
    }

    if (isEnabled !== undefined) {
      data.isEnabled = !!isEnabled

      // Enabling an exam with no questions lets students start something
      // they cannot complete.
      if (isEnabled) {
        const questionCount = await prisma.question.count({
          where: { section: { examId: id } },
        })
        if (questionCount === 0) {
          return res.status(400).json({
            message: "Add at least one question before enabling this exam",
          })
        }
      }
    }

    if (allowReattempt !== undefined) {
      data.allowReattempt = !!allowReattempt
    }

    // ── Proctoring ────────────────────────────────────────────────
    // Changing the mode while people are sitting the paper would mean
    // some candidates are judged under rules they were never shown.
    // Each attempt stores the mode it began under, but the browser
    // cannot switch the camera on mid-exam, so block the change.
    if (proctoringMode !== undefined) {
      const VALID = ["OFF", "BROWSER_ONLY", "FACE_DETECTION", "FULL_RECORDING"]
      if (!VALID.includes(proctoringMode)) {
        return res.status(400).json({
          message: `Proctoring mode must be one of: ${VALID.join(", ")}`,
        })
      }

      const inProgress = await prisma.examAttempt.count({
        where: { examId: id, isSubmitted: false },
      })
      if (inProgress > 0 && proctoringMode !== existing.proctoringMode) {
        return res.status(400).json({
          message: `${inProgress} student(s) are sitting this exam now. Their monitoring cannot be changed mid-paper.`,
        })
      }

      data.proctoringMode = proctoringMode
    }

    // Turning this off means minors sit camera-monitored exams without a
    // parent's approval. It is allowed, because the office may have
    // collected consent on paper — but it is logged, not silent.
    if (requireParentalConsent !== undefined) {
      data.requireParentalConsent = !!requireParentalConsent

      if (requireParentalConsent === false) {
        console.warn(
          `[CONSENT] admin ${req.user?.id} disabled parental consent on exam ${id} ("${existing.title}")`
        )
      }
    }

    if (resultReleaseAt !== undefined) {
      if (resultReleaseAt === null || resultReleaseAt === "") {
        data.resultReleaseAt = null
      } else {
        const d = new Date(resultReleaseAt)
        if (isNaN(d)) return res.status(400).json({ message: "Enter a valid release date" })
        data.resultReleaseAt = d
      }
    }

    if (answerKeyReleaseAt !== undefined) {
      if (answerKeyReleaseAt === null || answerKeyReleaseAt === "") {
        data.answerKeyReleaseAt = null
      } else {
        const d = new Date(answerKeyReleaseAt)
        if (isNaN(d)) {
          return res.status(400).json({ message: "Enter a valid answer key release date" })
        }
        // The key must never surface before the results it belongs to.
        const resultDate = data.resultReleaseAt ?? existing.resultReleaseAt
        if (resultDate && d < new Date(resultDate)) {
          return res.status(400).json({
            message: "The answer key cannot be published before the results",
          })
        }
        data.answerKeyReleaseAt = d
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "Nothing to update" })
    }

    // Detect the moment results become visible, before writing.
    const now = new Date()
    const wasLive = !!existing.resultReleaseAt && now >= new Date(existing.resultReleaseAt)
    const willBeLive = data.resultReleaseAt !== undefined
      ? (!!data.resultReleaseAt && now >= new Date(data.resultReleaseAt))
      : wasLive

    const exam = await prisma.exam.update({ where: { id }, data })

    // Announce only on the transition into "published". Re-saving the same
    // date does not re-notify anyone.
    let announced = null
    if (!wasLive && willBeLive) {
      announced = await announceRelease(id)
    }

    res.status(200).json({
      message: announced
        ? `Exam updated. Results published and ${announced.sent} candidate(s) notified.`
        : "Exam updated",
      exam,
      announced,
    })
  } catch (error) {
    console.error("updateExam error:", error)
    res.status(500).json({ message: "Something went wrong" })
  }
}

module.exports = { getActiveExam, getAllExams, createExam, updateExam, announceRelease }