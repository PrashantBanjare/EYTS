const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()
const { sendEmail } = require("../utils/emailService")
const {
  resultEmailTemplate,
  submissionEmailTemplate,
} = require("../utils/emailTemplates")
const { resolveProctoringMode } = require("./proctoringController")

// Students now get durable in-app notifications, as employees already do,
// rather than a list recomputed on every page load.
const notify = async (userId, { title, body, type, link = null }) => {
  try {
    await prisma.notification.create({ data: { userId, title, body, type, link } })
  } catch (err) {
    console.error("notify error:", err)   // never block the caller
  }
}

// ═══════════════════════════════════════════════════════════════════
//  RELEASE GATE
//
//  Nothing about performance reaches a student until the office
//  releases it. That means: no score, no percentage, no rank, no
//  percentile, no section breakdown, and no indication of which
//  answers were right or wrong.
//
//  resultReleaseAt === null  ->  NOT released.
//  A missing date means "not yet announced", never "show everything".
//
//  answerKeyReleaseAt is optional. Left null, the key appears with the
//  results, which is the default the office asked for. Set it to a
//  later date to publish scores first and hold the key back.
// ═══════════════════════════════════════════════════════════════════
const getReleaseState = (exam) => {
  const now = new Date()

  const resultsReleased =
    !!exam?.resultReleaseAt && now >= new Date(exam.resultReleaseAt)

  // The key can never appear before the results.
  const keyDate = exam?.answerKeyReleaseAt || exam?.resultReleaseAt
  const answerKeyReleased =
    resultsReleased && !!keyDate && now >= new Date(keyDate)

  return {
    resultsReleased,
    answerKeyReleased,
    resultReleaseAt: exam?.resultReleaseAt || null,
    answerKeyReleaseAt: exam?.answerKeyReleaseAt || null,
  }
}

// ── POST /api/attempts/start — student starts the exam ──────────────────────
const startAttempt = async (req, res) => {
  try {
    const userId = req.user.id
    const { examId } = req.body

    if (!examId) {
      return res.status(400).json({ message: "examId is required" })
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(examId)) {
      return res.status(400).json({ message: "Invalid examId format" })
    }

    const payment = await prisma.payment.findFirst({
      where: { userId, status: "PAID" }
    })
    if (!payment) {
      return res.status(403).json({ message: "Payment required to start exam. Please complete payment first." })
    }

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { sections: true }
    })
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" })
    }
    if (!exam.isEnabled) {
      return res.status(403).json({ message: "This exam is currently disabled" })
    }

    const existingAttempt = await prisma.examAttempt.findFirst({
      where: { userId, examId, isSubmitted: true }
    })
    if (existingAttempt && !exam.allowReattempt) {
      return res.status(400).json({ message: "You have already submitted this exam. Reattempts are not allowed." })
    }

    const inProgressAttempt = await prisma.examAttempt.findFirst({
      where: { userId, examId, isSubmitted: false }
    })
    if (inProgressAttempt) {
      return res.status(400).json({
        message: "You already have an in-progress attempt. Please complete or abandon it first.",
        attemptId: inProgressAttempt.id
      })
    }

    // ── PROCTORING & PARENTAL CONSENT GATE ────────────────────────
    //
    // Enforced here, on the server, not in the exam page. A candidate
    // who skips the consent screen in the browser still cannot start:
    // this is the only route that creates an attempt.
    //
    // The resolved mode is written onto the attempt, so a later change
    // to the exam settings cannot retroactively claim a candidate was
    // watched under rules they were never shown.
    const proctoring = await resolveProctoringMode(userId, examId)
    const mode = proctoring?.mode || "OFF"

    if (proctoring?.needsConsent) {
      const consent = await prisma.parentalConsent.findUnique({
        where: { studentId: userId },
        select: { verified: true },
      })
      if (!consent?.verified) {
        return res.status(403).json({
          message:
            "This examination is monitored by camera. Because you are under 18, a parent or guardian must give consent before you can begin.",
          needsParentalConsent: true,
          proctoringMode: mode,
        })
      }
    }

    const attempt = await prisma.examAttempt.create({
      data: { userId, examId, proctoringMode: mode }
    })

    res.status(201).json({
      message: "Exam started successfully",
      attemptId: attempt.id,
      durationSeconds: exam.durationSeconds,
      proctoringMode: mode,
      usesCamera: mode === "FACE_DETECTION" || mode === "FULL_RECORDING",
      storesSnapshots: mode === "FULL_RECORDING",
    })
  } catch (error) {
    console.error("startAttempt error:", error)
    res.status(500).json({ message: "Failed to start exam" })
  }
}

// ── POST /api/attempts/submit — student submits exam ────────────────────────
//  Scoring happens here and is stored, but NOTHING about the score is
//  returned to the student. They receive an acknowledgement only.
const submitAttempt = async (req, res) => {
  try {
    const userId = req.user.id
    const { attemptId, answers, timeTaken } = req.body

    if (!attemptId || !answers || timeTaken === undefined) {
      return res.status(400).json({ message: "attemptId, answers, and timeTaken are required" })
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: "answers must be a non-empty array" })
    }

    if (typeof timeTaken !== "number" || timeTaken < 0) {
      return res.status(400).json({ message: "timeTaken must be a positive number (in seconds)" })
    }

    const attempt = await prisma.examAttempt.findFirst({
      where: { id: attemptId, userId }
    })
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" })
    }
    if (attempt.isSubmitted) {
      return res.status(400).json({ message: "This exam has already been submitted" })
    }

    const exam = await prisma.exam.findUnique({
      where: { id: attempt.examId },
      include: {
        sections: {
          include: {
            questions: { include: { options: true } }
          }
        }
      }
    })

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" })
    }

    // Trust the clock, not the client. A tampered timeTaken cannot be
    // used to fake a fast finish, and cannot exceed the exam duration.
    const elapsed = Math.round((Date.now() - new Date(attempt.startedAt).getTime()) / 1000)
    const cappedTime = Math.min(
      Math.max(Math.round(timeTaken), 0),
      exam.durationSeconds + 60,   // small grace for network lag
      Math.max(elapsed, 1)
    )

    const examQuestions = exam.sections.flatMap(section =>
      section.questions.map(q => ({ ...q, sectionId: section.id }))
    )

    const answeredQuestionIds = answers.map(a => a.questionId)
    const invalidQuestions = answeredQuestionIds.filter(
      id => !examQuestions.find(q => q.id === id)
    )
    if (invalidQuestions.length > 0) {
      return res.status(400).json({
        message: "Invalid question IDs detected",
        invalidCount: invalidQuestions.length
      })
    }

    const invalidAnswers = answers.filter(a => {
      if (!a.questionId) return true
      if (a.selectedKey && !/^[A-D]$/.test(a.selectedKey)) return true
      return false
    })
    if (invalidAnswers.length > 0) {
      return res.status(400).json({
        message: "Invalid answer format detected",
        invalidCount: invalidAnswers.length
      })
    }

    // ── Score, stored but not disclosed ──
    let totalScore = 0
    const sectionScores = {}
    const answerData = []

    for (const ans of answers) {
      const question = examQuestions.find(q => q.id === ans.questionId)
      if (!question) continue

      const correctOption = question.options.find(o => o.isCorrect)
      const isCorrect = !!(correctOption && correctOption.key === ans.selectedKey)

      if (isCorrect) {
        totalScore++
        if (!sectionScores[question.sectionId]) sectionScores[question.sectionId] = 0
        sectionScores[question.sectionId]++
      }

      answerData.push({
        attemptId,
        questionId: ans.questionId,
        selectedKey: ans.selectedKey || null,
        isCorrect,
        markedReview: ans.markedReview || false
      })
    }

    if (answerData.length > 0) {
      await prisma.attemptAnswer.createMany({ data: answerData })
    }

    const submittedAt = new Date()
    await prisma.examAttempt.update({
      where: { id: attemptId },
      data: { isSubmitted: true, submittedAt, timeTaken: cappedTime }
    })

    // Denominator is the whole paper, not just what they answered —
    // otherwise skipping questions would inflate the percentage.
    const totalQuestions = examQuestions.length
    const percentage = totalQuestions > 0
      ? Math.round((totalScore / totalQuestions) * 100)
      : 0

    const result = await prisma.result.create({
      data: {
        userId,
        attemptId,
        totalScore,
        totalQuestions,
        percentage,
        timeTaken: cappedTime,
        sectionScores,
        submittedAt,
        isPublished: false
      }
    })

    await recalculateRanks(attempt.examId)

    const { resultsReleased, resultReleaseAt } = getReleaseState(exam)

    const answeredCount = answerData.filter(a => a.selectedKey).length

    // In-app notification. Deliberately carries no score.
    await notify(userId, {
      title: "Examination submitted",
      body: `${exam.title} was submitted successfully. You attempted ${answeredCount} of ${totalQuestions} questions. ${
        resultReleaseAt
          ? `Results are published on ${new Date(resultReleaseAt).toLocaleString("en-IN")}.`
          : "Results will be announced by the office."
      }`,
      type: "ANNOUNCEMENT",
      link: `/result/${attemptId}`,
    })

    // Acknowledgement email only. No score, no rank — those go out when
    // the office releases results.
    try {
      const student = await prisma.user.findUnique({ where: { id: userId } })
      if (student?.email) {
        sendEmail({
          to: student.email,
          subject: "TalentExam — your examination has been submitted",
          html: submissionEmailTemplate({
            name: student.name,
            examTitle: exam.title,
            submittedAt,
            questionsAnswered: answeredCount,
            totalQuestions,
            releaseAt: resultReleaseAt,
          }),
        }).catch(err => console.error("Email send error:", err))
      }
    } catch (emailError) {
      console.error("Error sending submission email:", emailError)
    }

    // Deliberately withheld: totalScore, percentage, rank, percentile,
    // sectionScores. The student learns only that it was received.
    res.status(200).json({
      message: "Exam submitted successfully",
      submitted: true,
      attemptId,
      submittedAt,
      questionsAnswered: answerData.filter(a => a.selectedKey).length,
      totalQuestions,
      timeTaken: cappedTime,
      resultsReleased,
      resultReleaseAt,
      resultPending: !resultsReleased
    })
  } catch (error) {
    console.error("submitAttempt error:", error)
    res.status(500).json({ message: "Failed to submit exam" })
  }
}

// ── Helper: recalculate ranks after submission ──────────────────────────────
const recalculateRanks = async (examId) => {
  try {
    const attempts = await prisma.examAttempt.findMany({
      where: { examId, isSubmitted: true },
      include: { result: true }
    })

    const sortedAttempts = attempts
      .filter(a => a.result)
      .sort((a, b) => {
        if (b.result.totalScore !== a.result.totalScore) {
          return b.result.totalScore - a.result.totalScore
        }
        if (a.result.timeTaken !== b.result.timeTaken) {
          return a.result.timeTaken - b.result.timeTaken
        }
        return new Date(a.result.submittedAt) - new Date(b.result.submittedAt)
      })

    const total = sortedAttempts.length

    await Promise.all(sortedAttempts.map((attempt, index) => {
      const rank = index + 1
      const percentile = total > 1 ? Math.round(((total - rank) / (total - 1)) * 100) : 100
      return prisma.result.update({
        where: { id: attempt.result.id },
        data: { rank, percentile }
      })
    }))
  } catch (error) {
    console.error("recalculateRanks error:", error)
  }
}

// ── GET /api/attempts/my — student gets their attempts ──────────────────────
const getMyAttempts = async (req, res) => {
  try {
    const userId = req.user.id

    const attempts = await prisma.examAttempt.findMany({
      where: { userId },
      include: {
        result: true,
        exam: {
          select: {
            id: true,
            title: true,
            resultReleaseAt: true,
            answerKeyReleaseAt: true
          }
        }
      },
      orderBy: { startedAt: "desc" }
    })

    const rows = attempts.map(attempt => {
      const state = getReleaseState(attempt.exam)
      return {
        id: attempt.id,
        examId: attempt.examId,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        isSubmitted: attempt.isSubmitted,
        timeTaken: attempt.timeTaken,
        exam: attempt.exam,
        // Results are stripped entirely until released.
        result: state.resultsReleased ? attempt.result : null,
        resultReleased: state.resultsReleased,
        resultPending: attempt.isSubmitted && !state.resultsReleased,
        resultReleaseAt: state.resultReleaseAt
      }
    })

    res.status(200).json({ attempts: rows })
  } catch (error) {
    console.error("getMyAttempts error:", error)
    res.status(500).json({ message: "Failed to fetch attempts" })
  }
}

// ── GET /api/attempts/:id/result — get detailed result ──────────────────────
const getAttemptResult = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    if (!id) {
      return res.status(400).json({ message: "Attempt ID is required" })
    }

    const attempt = await prisma.examAttempt.findFirst({
      where: { id, userId },
      include: {
        result: true,
        exam: {
          select: {
            id: true,
            title: true,
            totalMarks: true,
            resultReleaseAt: true,
            answerKeyReleaseAt: true
          }
        },
        answers: {
          include: {
            question: {
              include: { options: true, section: true }
            }
          }
        }
      }
    })

    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" })
    }

    const state = getReleaseState(attempt.exam)

    // ── Nothing disclosed before release ──
    // No result object, no answers array. A student cannot infer their
    // score from this payload because none of it is present.
    if (!state.resultsReleased) {
      return res.status(200).json({
        attempt: {
          id: attempt.id,
          examId: attempt.examId,
          isSubmitted: attempt.isSubmitted,
          submittedAt: attempt.submittedAt,
          exam: attempt.exam,
          result: null,
          answers: [],
          questionsAnswered: attempt.answers.filter(a => a.selectedKey).length,
          totalQuestions: attempt.answers.length,
          resultReleaseAt: state.resultReleaseAt,
          resultPending: true,
          message: state.resultReleaseAt
            ? `Results will be published on ${new Date(state.resultReleaseAt).toLocaleString("en-IN")}`
            : "Results have not been announced yet. You will be notified once they are published."
        }
      })
    }

    // ── Results released ──
    // Score, rank and percentile are shown. Whether the answer key is
    // shown alongside depends on answerKeyReleaseAt.
    const answers = attempt.answers.map(a => {
      const base = {
        id: a.id,
        questionId: a.questionId,
        selectedKey: a.selectedKey,
        markedReview: a.markedReview,
        question: {
          id: a.question.id,
          text: a.question.text,
          section: a.question.section,
          options: a.question.options.map(o => ({
            id: o.id,
            key: o.key,
            text: o.text,
            // Correct option revealed only with the key.
            ...(state.answerKeyReleased ? { isCorrect: o.isCorrect } : {})
          })),
          ...(state.answerKeyReleased ? { explanation: a.question.explanation } : {})
        }
      }
      // Per-answer correctness is part of the key, not the score.
      if (state.answerKeyReleased) base.isCorrect = a.isCorrect
      return base
    })

    res.status(200).json({
      attempt: {
        id: attempt.id,
        examId: attempt.examId,
        isSubmitted: attempt.isSubmitted,
        submittedAt: attempt.submittedAt,
        startedAt: attempt.startedAt,
        timeTaken: attempt.timeTaken,
        exam: attempt.exam,
        result: attempt.result,
        answers,
        resultPending: false,
        answerKeyReleased: state.answerKeyReleased,
        answerKeyReleaseAt: state.answerKeyReleaseAt,
        answerKeyMessage: state.answerKeyReleased
          ? null
          : state.answerKeyReleaseAt
            ? `The answer key will be published on ${new Date(state.answerKeyReleaseAt).toLocaleString("en-IN")}`
            : "The answer key has not been published yet."
      }
    })
  } catch (error) {
    console.error("getAttemptResult error:", error)
    res.status(500).json({ message: "Failed to fetch result" })
  }
}

// ── GET /api/attempts/leaderboard/:examId — get leaderboard ─────────────────
const getLeaderboard = async (req, res) => {
  try {
    const { examId } = req.params

    if (!examId) {
      return res.status(400).json({ message: "examId is required" })
    }

    const exam = await prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" })
    }

    const state = getReleaseState(exam)

    // The leaderboard is every student's score in one list, so it is
    // gated exactly like an individual result. Admins can see it early.
    if (!state.resultsReleased && req.user?.role !== "ADMIN") {
      return res.status(403).json({
        message: state.resultReleaseAt
          ? `The leaderboard will be available on ${new Date(state.resultReleaseAt).toLocaleString("en-IN")}`
          : "Results have not been announced yet.",
        releaseAt: state.resultReleaseAt
      })
    }

    const results = await prisma.result.findMany({
      where: { attempt: { examId } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        attempt: { select: { examId: true } }
      },
      orderBy: [{ rank: "asc" }]
    })

    if (results.length === 0) {
      return res.status(200).json({
        leaderboard: [],
        message: "No submissions yet for this exam"
      })
    }

    res.status(200).json({
      leaderboard: results,
      totalSubmissions: results.length,
      resultsReleased: state.resultsReleased
    })
  } catch (error) {
    console.error("getLeaderboard error:", error)
    res.status(500).json({ message: "Failed to fetch leaderboard" })
  }
}

// ── DELETE /api/attempts/reset/:userId — admin resets attempts ──────────────
const resetAttempt = async (req, res) => {
  try {
    const { userId } = req.params

    if (!userId) {
      return res.status(400).json({ message: "userId is required" })
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      return res.status(400).json({ message: "Invalid userId format" })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return res.status(404).json({ message: "Student not found" })
    }

    const attempts = await prisma.examAttempt.findMany({
      where: { userId },
      include: { result: true }
    })

    if (attempts.length === 0) {
      return res.status(400).json({ message: "No attempts found for this student" })
    }

    const examIds = [...new Set(attempts.map(a => a.examId))]

    for (const attempt of attempts) {
      await prisma.attemptAnswer.deleteMany({ where: { attemptId: attempt.id } })
      // Proctoring records belong to the attempt and must go with it,
      // or the foreign key will refuse the delete.
      await prisma.proctoringEvent.deleteMany({ where: { attemptId: attempt.id } })
      await prisma.proctoringSnapshot.deleteMany({ where: { attemptId: attempt.id } })
      if (attempt.result) {
        await prisma.result.delete({ where: { id: attempt.result.id } })
      }
      await prisma.examAttempt.delete({ where: { id: attempt.id } })
    }

    // Everyone else's rank shifts when an attempt is removed.
    for (const examId of examIds) {
      await recalculateRanks(examId)
    }

    await notify(userId, {
      title: "Examination attempt reset",
      body: "The examination office has reset your attempt. You may sit the examination again — sign in to begin when you are ready.",
      type: "ANNOUNCEMENT",
      link: "/dashboard",
    })

    res.status(200).json({
      message: `All ${attempts.length} attempt(s) for ${user.name} have been reset successfully`,
      deletedAttempts: attempts.length
    })
  } catch (error) {
    console.error("resetAttempt error:", error)
    res.status(500).json({ message: "Failed to reset attempts" })
  }
}

// ── GET /api/attempts/admin/:attemptId — admin views any answer sheet ───────
//  The office needs this to settle re-evaluation disputes. It ignores the
//  release gate entirely: an admin sees the full sheet with the key at any
//  time, including before results are published.
const getAttemptSheetAdmin = async (req, res) => {
  try {
    const { attemptId } = req.params

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!attemptId || !uuidRegex.test(attemptId)) {
      return res.status(400).json({ message: "Invalid attempt ID" })
    }

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        result: true,
        user: {
          select: {
            id: true, name: true, email: true, whatsappNumber: true,
            institutionName: true, qualification: true,
          }
        },
        exam: { select: { id: true, title: true, totalMarks: true, durationSeconds: true } },
        answers: {
          include: {
            question: {
              include: {
                options: { orderBy: { key: "asc" } },
                section: true,
              }
            }
          }
        },
        // A dispute about a score is usually also a dispute about conduct,
        // so the reviewer sees both on one page.
        proctoringEvents: { orderBy: { occurredAt: "asc" } },
      }
    })

    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" })
    }

    // Sort by section order, then question order, so the sheet reads in
    // the same order the student saw it.
    const answers = [...attempt.answers].sort((a, b) => {
      const sa = a.question.section?.order ?? 0
      const sb = b.question.section?.order ?? 0
      if (sa !== sb) return sa - sb
      return (a.question.order ?? 0) - (b.question.order ?? 0)
    })

    const correctCount = answers.filter(a => a.isCorrect).length
    const wrongCount = answers.filter(a => a.selectedKey && !a.isCorrect).length
    const skippedCount = answers.filter(a => !a.selectedKey).length

    const highSeverity = attempt.proctoringEvents.filter(e => e.severity === "HIGH").length
    const mediumSeverity = attempt.proctoringEvents.filter(e => e.severity === "MEDIUM").length

    res.status(200).json({
      attempt: {
        id: attempt.id,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        timeTaken: attempt.timeTaken,
        isSubmitted: attempt.isSubmitted,
        proctoringMode: attempt.proctoringMode,
        user: attempt.user,
        exam: attempt.exam,
        result: attempt.result,
      },
      summary: {
        total: answers.length,
        correct: correctCount,
        wrong: wrongCount,
        skipped: skippedCount,
      },
      proctoring: {
        mode: attempt.proctoringMode,
        totalEvents: attempt.proctoringEvents.length,
        highSeverity,
        mediumSeverity,
        riskScore: Math.min(100, highSeverity * 20 + mediumSeverity * 5),
        events: attempt.proctoringEvents,
      },
      answers: answers.map(a => ({
        id: a.id,
        questionId: a.questionId,
        questionText: a.question.text,
        sectionName: a.question.section?.name || "—",
        explanation: a.question.explanation || null,
        selectedKey: a.selectedKey,
        correctKey: a.question.options.find(o => o.isCorrect)?.key || null,
        isCorrect: a.isCorrect,
        markedReview: a.markedReview,
        options: a.question.options.map(o => ({
          key: o.key, text: o.text, isCorrect: o.isCorrect,
        })),
      })),
    })
  } catch (error) {
    console.error("getAttemptSheetAdmin error:", error)
    res.status(500).json({ message: "Could not load the answer sheet" })
  }
}

// ── GET /api/attempts/admin/by-exam/:examId — all attempts for an exam ──────
const getExamAttemptsAdmin = async (req, res) => {
  try {
    const { examId } = req.params

    const attempts = await prisma.examAttempt.findMany({
      where: { examId, isSubmitted: true },
      orderBy: { submittedAt: "desc" },
      include: {
        result: true,
        user: { select: { id: true, name: true, email: true, institutionName: true } },
        proctoringEvents: { select: { severity: true } },
      }
    })

    res.status(200).json({
      count: attempts.length,
      attempts: attempts.map(a => {
        const high = a.proctoringEvents.filter(e => e.severity === "HIGH").length
        const medium = a.proctoringEvents.filter(e => e.severity === "MEDIUM").length
        return {
          id: a.id,
          submittedAt: a.submittedAt,
          timeTaken: a.timeTaken,
          user: a.user,
          totalScore: a.result?.totalScore ?? null,
          totalQuestions: a.result?.totalQuestions ?? null,
          percentage: a.result?.percentage ?? null,
          rank: a.result?.rank ?? null,
          proctoringMode: a.proctoringMode,
          proctoringFlags: a.proctoringEvents.length,
          riskScore: Math.min(100, high * 20 + medium * 5),
        }
      })
    })
  } catch (error) {
    console.error("getExamAttemptsAdmin error:", error)
    res.status(500).json({ message: "Could not load attempts" })
  }
}

module.exports = {
  notify,
  startAttempt,
  submitAttempt,
  getMyAttempts,
  getAttemptResult,
  getLeaderboard,
  resetAttempt,
  getAttemptSheetAdmin,
  getExamAttemptsAdmin
}