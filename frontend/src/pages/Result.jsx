import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { attemptService } from "../services/api"

const NAVY = "#0a1628"
const GOLD = "#c9a84c"

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }) : "—"
const fmtTime = (s) => {
  if (typeof s !== "number" || s < 0) return "—"
  const m = Math.floor(s / 60)
  return `${m}m ${String(s % 60).padStart(2, "0")}s`
}

function Result() {
  const { attemptId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [attempt, setAttempt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showAnswers, setShowAnswers] = useState(false)
  const [answerFilter, setAnswerFilter] = useState("all")

  useEffect(() => {
    const fetchResult = async () => {
      if (!attemptId) {
        setError("No attempt was specified.")
        setLoading(false)
        return
      }

      setLoading(true)
      setError("")

      try {
        const response = await attemptService.getResult(attemptId)
        const data = response.data?.attempt
        if (!data) {
          setError("That result could not be found.")
          return
        }
        // resultPending is a legitimate state, not an error. The payload
        // deliberately contains no score in that case.
        setAttempt(data)
      } catch (err) {
        setError(err.response?.data?.message || "Could not load your result.")
        console.error("Result fetch error:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchResult()
  }, [attemptId])

  // Section names live on the answers, since sectionScores is keyed by id.
  const sectionBreakdown = () => {
    if (!attempt?.result?.sectionScores) return []
    const names = {}
    ;(attempt.answers || []).forEach((a) => {
      const s = a.question?.section
      if (s?.id) names[s.id] = s.name
    })
    const totals = {}
    ;(attempt.answers || []).forEach((a) => {
      const id = a.question?.section?.id
      if (id) totals[id] = (totals[id] || 0) + 1
    })
    return Object.entries(attempt.result.sectionScores).map(([id, score]) => ({
      id,
      name: names[id] || "Section",
      score,
      total: totals[id] || null,
    }))
  }

  // Printing rather than a PDF library: no dependency to install, and the
  // browser's "Save as PDF" produces a proper file on every platform.
  const printCertificate = () => window.print()

  // ══════════════════════════════════════════════════════════════
  //  LOADING / ERROR
  // ══════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin mb-4" />
          <p className="text-gray-500 font-medium">Loading your result…</p>
        </div>
      </div>
    )
  }

  if (error || !attempt) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 md:p-6">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => navigate("/dashboard")}
            className="mb-6 text-sm border border-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-50">
            ← Back to dashboard
          </button>
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Result unavailable</h2>
            <p className="text-gray-600 mb-6 text-sm">{error || "Something went wrong."}</p>
            <button onClick={() => navigate("/dashboard")} style={{ background: NAVY }}
              className="text-white px-6 py-2 rounded-lg font-medium">
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════
  //  STATE 1 — SUBMITTED, NOTHING PUBLISHED
  //  No score, no rank, no correctness. The payload contains none of it.
  // ══════════════════════════════════════════════════════════════
  if (attempt.resultPending) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 md:p-6">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => navigate("/dashboard")}
            className="mb-6 text-sm border border-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-50">
            ← Back to dashboard
          </button>

          <div style={{ background: NAVY }} className="rounded-t-2xl p-6 text-white text-center">
            <div className="text-5xl mb-3">✓</div>
            <h1 className="text-2xl font-bold">Examination submitted</h1>
            <p className="text-sm text-white/60 mt-1">{attempt.exam?.title}</p>
          </div>

          <div className="bg-white rounded-b-2xl shadow-lg p-6 md:p-8">
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Questions attempted</p>
                <p className="text-2xl font-bold" style={{ color: NAVY }}>
                  {attempt.questionsAnswered ?? "—"}
                  <span className="text-base text-gray-400 font-normal">
                    {" "}/ {attempt.totalQuestions ?? "—"}
                  </span>
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Submitted on</p>
                <p className="text-sm font-bold mt-2" style={{ color: NAVY }}>
                  {fmtDateTime(attempt.submittedAt)}
                </p>
              </div>
            </div>

            <div style={{ borderLeftColor: GOLD }}
              className="bg-amber-50 border border-amber-200 border-l-4 rounded-r-xl p-4 mb-6">
              <p className="font-bold text-amber-900 text-sm mb-1">Results not yet published</p>
              <p className="text-sm text-amber-800">
                {attempt.message ||
                  "Your answers have been recorded. The examination office will announce results shortly."}
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                What happens next
              </p>
              <ul className="text-sm text-gray-600 space-y-1.5 list-disc pl-5">
                <li>
                  Your score, rank and percentile are published together with the answer key on the
                  announced date.
                </li>
                <li>
                  Nothing about your performance — not even which answers were correct — is available
                  before then. This applies equally to every candidate.
                </li>
                <li>You will be notified by email, and it will appear on your dashboard.</li>
              </ul>
            </div>

            <button onClick={() => navigate("/dashboard")} style={{ background: NAVY }}
              className="w-full text-white py-3 rounded-xl font-medium">
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════
  //  STATE 2 & 3 — RESULTS PUBLISHED
  //  The answer key may or may not be published alongside.
  // ══════════════════════════════════════════════════════════════
  const result = attempt.result || {}
  const keyOut = !!attempt.answerKeyReleased
  const answers = attempt.answers || []
  const sections = sectionBreakdown()

  const correctCount = keyOut ? answers.filter((a) => a.isCorrect).length : null
  const wrongCount = keyOut ? answers.filter((a) => a.selectedKey && !a.isCorrect).length : null
  const skippedCount = answers.filter((a) => !a.selectedKey).length

  const filtered = answers.filter((a) => {
    if (!keyOut) return true
    if (answerFilter === "wrong") return a.selectedKey && !a.isCorrect
    if (answerFilter === "correct") return a.isCorrect
    if (answerFilter === "skipped") return !a.selectedKey
    return true
  })

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      {/* Print rules: the certificate block only, on a clean page. */}
      <style>{`
        @media print {
          body { background: #fff; }
          .no-print { display: none !important; }
          .certificate {
            box-shadow: none !important;
            border: 2px solid ${GOLD} !important;
            margin: 0 !important;
            page-break-after: always;
          }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap no-print">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your result</h1>
            <p className="text-gray-500 mt-1">{attempt.exam?.title}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={printCertificate}
              className="text-sm border border-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-50">
              Print / save as PDF
            </button>
            <button onClick={() => navigate("/dashboard")}
              className="text-sm border border-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-50">
              ← Dashboard
            </button>
          </div>
        </div>

        {/* ── CERTIFICATE (the printed part) ── */}
        <div className="certificate bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
          <div style={{ background: NAVY }} className="p-6 text-white">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-widest" style={{ color: GOLD }}>
                  Excellence Youth Talent Search LLP
                </p>
                <h2 className="text-xl font-bold mt-1">{attempt.exam?.title}</h2>
                <p className="text-sm text-white/60 mt-0.5">Statement of Result</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/50">Candidate</p>
                <p className="font-bold">{user?.name || "—"}</p>
                <p className="text-xs text-white/50 mt-1">{fmtDate(result.submittedAt)}</p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                ["Score", `${result.totalScore ?? "—"}`, `out of ${result.totalQuestions ?? "—"}`],
                ["Percentage", `${result.percentage ?? "—"}%`, null],
                ["Rank", result.rank ? `#${result.rank}` : "—", "all India"],
                ["Percentile", result.percentile != null ? `${result.percentile}` : "—",
                  result.percentile != null ? "percentile" : null],
              ].map(([label, value, sub], i) => (
                <div key={label}
                  style={i === 0 ? { background: NAVY } : {}}
                  className={`rounded-xl p-4 text-center ${i === 0 ? "" : "bg-gray-50"}`}>
                  <p className={`text-xs mb-1 ${i === 0 ? "text-white/60" : "text-gray-500"}`}>
                    {label}
                  </p>
                  <p className="text-3xl font-bold" style={i === 0 ? { color: GOLD } : { color: NAVY }}>
                    {value}
                  </p>
                  {sub && (
                    <p className={`text-xs mt-1 ${i === 0 ? "text-white/50" : "text-gray-400"}`}>
                      {sub}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {result.percentage != null && (
              <div className="mb-6">
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div style={{ width: `${Math.min(result.percentage, 100)}%`, background: GOLD }}
                    className="h-3 rounded-full" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-6">
              {[
                ["Attempted", `${answers.filter((a) => a.selectedKey).length} / ${answers.length}`],
                ["Skipped", skippedCount],
                ["Time taken", fmtTime(result.timeTaken)],
                ["Submitted", fmtDateTime(result.submittedAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-gray-500 text-xs uppercase tracking-wide">{label}</p>
                  <p className="font-semibold">{value}</p>
                </div>
              ))}
            </div>

            {keyOut && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  ["Correct", correctCount, "#16a34a"],
                  ["Wrong", wrongCount, "#dc2626"],
                  ["Skipped", skippedCount, "#94a3b8"],
                ].map(([label, value, tone]) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className="text-xl font-bold" style={{ color: tone }}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            {sections.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  Section-wise performance
                </p>
                <div className="space-y-3">
                  {sections.map((s) => {
                    const pct = s.total ? Math.round((s.score / s.total) * 100) : 0
                    return (
                      <div key={s.id}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-700">{s.name}</span>
                          <span className="font-semibold">
                            {s.score}{s.total ? ` / ${s.total}` : ""}
                            {s.total ? <span className="text-gray-400"> ({pct}%)</span> : null}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div style={{ width: `${pct}%`, background: NAVY }} className="h-2 rounded-full" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 mt-6 pt-4 border-t">
              Rank is determined by score first, then by time taken. This statement is generated from
              the official examination record of Excellence Youth Talent Search LLP.
            </p>
          </div>
        </div>

        {/* ── ANSWER KEY WITHHELD NOTICE ── */}
        {!keyOut && (
          <div style={{ borderLeftColor: GOLD }}
            className="bg-white border border-gray-200 border-l-4 rounded-r-2xl shadow p-6 mb-6 no-print">
            <p className="font-bold text-sm text-gray-900 mb-1">Answer key not yet published</p>
            <p className="text-sm text-gray-600">
              {attempt.answerKeyMessage ||
                "The correct answers have not been released yet."}{" "}
              Your score above is final and already accounts for every answer.
            </p>
            <p className="text-xs text-gray-500 mt-3">
              The office holds the key back briefly so that any re-evaluation request can be handled
              before the correct answers become public.
            </p>
          </div>
        )}

        {/* ── ANSWER REVIEW ── */}
        {keyOut && answers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 no-print">
            <button onClick={() => setShowAnswers((s) => !s)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition font-semibold text-gray-900">
              <span>{showAnswers ? "Hide" : "Show"} answer key and review</span>
              <span className="text-xl">{showAnswers ? "▲" : "▼"}</span>
            </button>

            {showAnswers && (
              <>
                <div className="flex gap-2 mt-5 mb-4 flex-wrap">
                  {[
                    ["all", `All (${answers.length})`],
                    ["wrong", `Wrong (${wrongCount})`],
                    ["correct", `Correct (${correctCount})`],
                    ["skipped", `Skipped (${skippedCount})`],
                  ].map(([id, label]) => (
                    <button key={id} onClick={() => setAnswerFilter(id)}
                      style={answerFilter === id ? { background: NAVY } : {}}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                        answerFilter === id ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                      {label}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  {filtered.map((a, idx) => {
                    const correct = a.isCorrect
                    const skipped = !a.selectedKey
                    return (
                      <div key={a.id}
                        className={`p-4 rounded-xl border-2 ${
                          skipped ? "border-gray-200 bg-gray-50"
                          : correct ? "border-green-300 bg-green-50"
                          : "border-red-300 bg-red-50"}`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                          <p className="text-xs" style={{ color: GOLD }}>
                            {a.question?.section?.name}
                            {a.markedReview && (
                              <span className="text-amber-700 font-semibold ml-2">
                                you marked this for review
                              </span>
                            )}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            skipped ? "bg-gray-200 text-gray-600"
                            : correct ? "bg-green-200 text-green-800"
                            : "bg-red-200 text-red-800"}`}>
                            {skipped ? "Not attempted" : correct ? "Correct" : "Wrong"}
                          </span>
                        </div>

                        <p className="font-semibold text-gray-900 mb-3">
                          {idx + 1}. {a.question?.text}
                        </p>

                        <div className="space-y-1.5 text-sm">
                          {(a.question?.options || []).map((o) => {
                            const chosen = o.key === a.selectedKey
                            return (
                              <div key={o.id || o.key}
                                className={`p-2 rounded flex items-start gap-2 ${
                                  o.isCorrect ? "bg-green-200"
                                  : chosen ? "bg-red-200"
                                  : "bg-white"}`}>
                                <span className="font-bold">{o.key}.</span>
                                <span className="flex-1">{o.text}</span>
                                {o.isCorrect && (
                                  <span className="text-xs font-semibold text-green-800 whitespace-nowrap">
                                    correct answer
                                  </span>
                                )}
                                {chosen && !o.isCorrect && (
                                  <span className="text-xs font-semibold text-red-800 whitespace-nowrap">
                                    your answer
                                  </span>
                                )}
                                {chosen && o.isCorrect && (
                                  <span className="text-xs font-semibold text-green-800 whitespace-nowrap">
                                    your answer
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {a.question?.explanation && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs font-semibold text-gray-600 mb-1">Explanation</p>
                            <p className="text-sm text-gray-700">{a.question.explanation}</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ACTIONS ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 no-print">
          <button onClick={printCertificate} style={{ background: NAVY }}
            className="text-white px-6 py-3 rounded-xl font-semibold">
            Print / save as PDF
          </button>
          <button onClick={() => navigate("/leaderboard")}
            className="border border-gray-300 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50">
            View leaderboard
          </button>
          <button onClick={() => navigate("/dashboard")}
            className="border border-gray-300 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50">
            Back to dashboard
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 no-print">
          <p className="text-sm font-semibold text-gray-900 mb-1">Query about your result?</p>
          <p className="text-xs text-gray-500 mb-4">
            Write to the examination office with your registered email and the question number in
            dispute. Every answer sheet is retained and can be re-checked.
          </p>
          <a href={`mailto:priyanksha1803@gmail.com?subject=Result query — ${attempt.exam?.title || ""}&body=Registered email: ${user?.email || ""}%0D%0A%0D%0AQuery:`}
            className="text-sm border border-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 inline-block">
            Email the office
          </a>
        </div>
      </div>
    </div>
  )
}

export default Result
