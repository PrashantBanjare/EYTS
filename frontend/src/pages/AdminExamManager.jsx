import { useState, useEffect } from "react"
import api from "../services/api"
import AdminBulkUpload from "./AdminBulkUpload"

const NAVY = "#0a1628"
const GOLD = "#c9a84c"

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }) : "—"

const fmtTime = (s) =>
  typeof s === "number" ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : "—"

// datetime-local needs "YYYY-MM-DDTHH:mm" in LOCAL time. toISOString()
// converts to UTC and shifts the value by the timezone offset, which in
// IST silently moves a date back by 5.5 hours.
const toLocalInput = (d) => {
  if (!d) return ""
  const dt = new Date(d)
  const pad = (n) => String(n).padStart(2, "0")
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

const SUB_TABS = [
  { id: "exams", label: "Examinations" },
  { id: "sections", label: "Sections" },
  { id: "questions", label: "Bulk Questions" },
  { id: "release", label: "Results & Answer Key" },
  { id: "sheets", label: "Answer Sheets" },
]

export function AdminExamManager() {
  const [sub, setSub] = useState("exams")
  const [exams, setExams] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Create exam
  const [showCreate, setShowCreate] = useState(false)
  const [examForm, setExamForm] = useState({
    title: "", description: "", durationMinutes: 50, totalMarks: 60,
  })

  // Edit exam
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({
    title: "", description: "", durationMinutes: 0, totalMarks: 0,
  })

  // Sections
  const [sectionName, setSectionName] = useState("")
  const [sectionOrder, setSectionOrder] = useState("")

  // Release dates
  const [resultAt, setResultAt] = useState("")
  const [keyAt, setKeyAt] = useState("")

  // Answer sheets
  const [attempts, setAttempts] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [sheetLoading, setSheetLoading] = useState(false)
  const [sheetFilter, setSheetFilter] = useState("all")

  const selected = exams.find((e) => e.id === selectedId) || null

  const flash = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(""), 3500)
  }

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await api.get("/exams")
      const list = Array.isArray(res.data?.exams) ? res.data.exams : []
      setExams(list)
      setSelectedId((prev) => prev && list.some((e) => e.id === prev) ? prev : (list[0]?.id || null))
    } catch (err) {
      setError(err.response?.data?.message || "Could not load examinations")
      console.error("load exams error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Keep the release inputs in step with the selected exam
  useEffect(() => {
    if (!selected) return
    setResultAt(toLocalInput(selected.resultReleaseAt))
    setKeyAt(toLocalInput(selected.answerKeyReleaseAt))
  }, [selectedId, selected?.resultReleaseAt, selected?.answerKeyReleaseAt])

  // Load attempts when the Answer Sheets tab opens
  useEffect(() => {
    if (sub !== "sheets" || !selectedId) return
    setAttempts(null)
    setSheet(null)
    api.get(`/attempts/admin/by-exam/${selectedId}`)
      .then((r) => setAttempts(r.data))
      .catch((err) => setError(err.response?.data?.message || "Could not load attempts"))
  }, [sub, selectedId])

  // ── Exam actions ────────────────────────────────────────────────
  const createExam = async (e) => {
    e.preventDefault()
    setError("")
    const { title, durationMinutes, totalMarks } = examForm

    if (!title.trim() || title.trim().length < 3)
      return setError("Title must be at least 3 characters")
    if (!durationMinutes || durationMinutes < 1)
      return setError("Duration must be at least 1 minute")
    if (!totalMarks || totalMarks < 1)
      return setError("Total marks must be at least 1")

    setBusy(true)
    try {
      const res = await api.post("/exams", {
        title: title.trim(),
        description: examForm.description.trim() || undefined,
        durationSeconds: Math.round(durationMinutes * 60),
        totalMarks: parseInt(totalMarks),
      })
      flash(res.data.message || "Examination created")
      setExamForm({ title: "", description: "", durationMinutes: 50, totalMarks: 60 })
      setShowCreate(false)
      await load()
      if (res.data?.exam?.id) setSelectedId(res.data.exam.id)
      setSub("sections")
    } catch (err) {
      setError(err.response?.data?.message || "Could not create the examination")
    } finally {
      setBusy(false)
    }
  }

  const openEdit = (exam) => {
    setEditing(exam.id)
    setEditForm({
      title: exam.title || "",
      description: exam.description || "",
      durationMinutes: Math.round((exam.durationSeconds || 0) / 60),
      totalMarks: exam.totalMarks || 0,
    })
  }

  const saveEdit = async (exam) => {
    setError("")
    if (!editForm.title.trim()) return setError("Title cannot be empty")
    if (editForm.durationMinutes < 1) return setError("Duration must be at least 1 minute")

    setBusy(true)
    try {
      await api.patch(`/exams/${exam.id}`, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        durationSeconds: Math.round(editForm.durationMinutes * 60),
        totalMarks: parseInt(editForm.totalMarks),
      })
      flash("Examination updated")
      setEditing(null)
      await load()
    } catch (err) {
      setError(err.response?.data?.message || "Could not update the examination")
    } finally {
      setBusy(false)
    }
  }

  const questionCount = (exam) =>
    (exam.sections || []).reduce((n, s) => n + (s.questions?.length || 0), 0)

  const toggleEnabled = async (exam) => {
    const turningOn = !exam.isEnabled
    const qs = questionCount(exam)

    if (turningOn) {
      const otherLive = exams.find((e) => e.isEnabled && e.id !== exam.id)
      if (otherLive && !confirm(
        `"${otherLive.title}" is currently live.\n\n` +
        "Students are served whichever examination is enabled, so having two live at once " +
        "gives arbitrary results. Disable the other one first.\n\nContinue anyway?"
      )) return

      if (!confirm(
        `Enable "${exam.title}"?\n\n` +
        `Questions: ${qs}\nDuration: ${Math.round(exam.durationSeconds / 60)} minutes\n\n` +
        "Students who have paid will be able to start immediately."
      )) return
    } else {
      if (!confirm(
        `Disable "${exam.title}"?\n\n` +
        "No new students can start. Anyone mid-attempt can still submit."
      )) return
    }

    setBusy(true)
    setError("")
    try {
      await api.patch(`/exams/${exam.id}`, { isEnabled: turningOn })
      flash(`"${exam.title}" ${turningOn ? "enabled" : "disabled"}`)
      await load()
    } catch (err) {
      setError(err.response?.data?.message || "Could not update the examination")
    } finally {
      setBusy(false)
    }
  }

  const toggleReattempt = async (exam) => {
    setBusy(true)
    setError("")
    try {
      await api.patch(`/exams/${exam.id}`, { allowReattempt: !exam.allowReattempt })
      flash(`Reattempts ${exam.allowReattempt ? "disabled" : "enabled"}`)
      await load()
    } catch (err) {
      setError(err.response?.data?.message || "Could not update the examination")
    } finally {
      setBusy(false)
    }
  }

  // ── Sections ────────────────────────────────────────────────────
  const addSection = async (e) => {
    e.preventDefault()
    setError("")
    if (!selectedId) return setError("Select an examination first")
    if (!sectionName.trim()) return setError("Enter a section name")

    setBusy(true)
    try {
      const nextOrder = sectionOrder !== ""
        ? parseInt(sectionOrder)
        : (selected?.sections?.length || 0)

      await api.post("/exams/sections", {
        name: sectionName.trim(),
        examId: selectedId,
        order: nextOrder,
      })
      flash(`Section "${sectionName.trim()}" added`)
      setSectionName("")
      setSectionOrder("")
      await load()
    } catch (err) {
      setError(err.response?.data?.message || "Could not add the section")
    } finally {
      setBusy(false)
    }
  }

  // ── Release dates ───────────────────────────────────────────────
  const saveRelease = async () => {
    setError("")
    if (!selectedId) return

    if (resultAt && keyAt && new Date(keyAt) < new Date(resultAt)) {
      return setError("The answer key cannot be published before the results")
    }

    const label = resultAt
      ? `Publish results on ${new Date(resultAt).toLocaleString("en-IN")}?`
      : "Clear the result release date?\n\nResults will be hidden from students until you set a new one."

    if (!confirm(
      label + "\n\n" +
      (keyAt
        ? `Answer key: ${new Date(keyAt).toLocaleString("en-IN")}`
        : resultAt
          ? "Answer key: published together with the results"
          : "Answer key: hidden")
    )) return

    setBusy(true)
    try {
      await api.patch(`/exams/${selectedId}`, {
        resultReleaseAt: resultAt ? new Date(resultAt).toISOString() : null,
        answerKeyReleaseAt: keyAt ? new Date(keyAt).toISOString() : null,
      })
      flash("Release schedule saved")
      await load()
    } catch (err) {
      setError(err.response?.data?.message || "Could not save the release schedule")
    } finally {
      setBusy(false)
    }
  }

  const publishNow = async () => {
    if (!confirm(
      "Publish results and the answer key immediately?\n\n" +
      "Every student will be able to see their score, rank, percentile and the correct answers " +
      "as soon as they reload. This cannot be undone quietly — they may already have seen it."
    )) return

    const now = new Date().toISOString()
    setBusy(true)
    setError("")
    try {
      await api.patch(`/exams/${selectedId}`, {
        resultReleaseAt: now,
        answerKeyReleaseAt: now,
      })
      flash("Results and answer key are now live")
      await load()
    } catch (err) {
      setError(err.response?.data?.message || "Could not publish")
    } finally {
      setBusy(false)
    }
  }

  // ── Answer sheet ────────────────────────────────────────────────
  const openSheet = async (attemptId) => {
    setSheetLoading(true)
    setSheet(null)
    setError("")
    setSheetFilter("all")
    try {
      const res = await api.get(`/attempts/admin/${attemptId}`)
      setSheet(res.data)
    } catch (err) {
      setError(err.response?.data?.message || "Could not load the answer sheet")
    } finally {
      setSheetLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow p-12 text-center">
        <div className="inline-block w-6 h-6 border-4 border-gray-300 border-t-black rounded-full animate-spin mb-3" />
        <p className="text-gray-500 text-sm">Loading examinations…</p>
      </div>
    )
  }

  const releaseState = (exam) => {
    if (!exam) return { text: "—", tone: "#94a3b8" }
    const now = new Date()
    if (!exam.resultReleaseAt) return { text: "Results hidden", tone: "#dc2626" }
    if (now >= new Date(exam.resultReleaseAt)) {
      const keyDate = exam.answerKeyReleaseAt || exam.resultReleaseAt
      return now >= new Date(keyDate)
        ? { text: "Results and key published", tone: "#16a34a" }
        : { text: "Results published, key held", tone: GOLD }
    }
    return { text: `Scheduled ${fmtDateTime(exam.resultReleaseAt)}`, tone: GOLD }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-400">✕</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl text-sm flex items-start justify-between gap-3">
          <span>{success}</span>
          <button onClick={() => setSuccess("")} className="text-green-400">✕</button>
        </div>
      )}

      {/* Exam selector */}
      {exams.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-4 flex items-center gap-3 flex-wrap">
          <label className="text-xs font-semibold text-gray-600 uppercase">Working on</label>
          <select value={selectedId || ""} onChange={(e) => setSelectedId(e.target.value)}
            className="flex-1 min-w-[220px] border border-gray-300 p-2.5 rounded-lg text-sm">
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} {e.isEnabled ? "— live" : ""}
              </option>
            ))}
          </select>
          {selected && (
            <span className="text-xs px-2 py-1 rounded font-semibold"
              style={{ background: releaseState(selected).tone, color: "#fff" }}>
              {releaseState(selected).text}
            </span>
          )}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-2 flex-wrap">
        {SUB_TABS.map((t) => (
          <button key={t.id} onClick={() => setSub(t.id)}
            style={sub === t.id ? { background: NAVY } : {}}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              sub === t.id ? "text-white" : "bg-white text-gray-600 border hover:bg-gray-50"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════ EXAMINATIONS ═══════════ */}
      {sub === "exams" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-semibold text-lg">Create an examination</h2>
                <p className="text-xs text-gray-500 mt-1">
                  After creating one, add sections before adding questions.
                </p>
              </div>
              <button onClick={() => setShowCreate((s) => !s)}
                style={showCreate ? {} : { background: NAVY }}
                className={`px-5 py-2 rounded-lg text-sm font-medium ${
                  showCreate ? "border hover:bg-gray-50" : "text-white"}`}>
                {showCreate ? "Cancel" : "New examination"}
              </button>
            </div>

            {showCreate && (
              <form onSubmit={createExam} className="mt-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Title</label>
                    <input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm"
                      placeholder="TalentExam National 2026" value={examForm.title} disabled={busy}
                      onChange={(e) => setExamForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Description</label>
                    <input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm"
                      placeholder="All India Competitive Examination" value={examForm.description} disabled={busy}
                      onChange={(e) => setExamForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Duration (minutes)</label>
                    <input type="number" min="1" className="w-full border border-gray-300 p-2.5 rounded-lg text-sm"
                      value={examForm.durationMinutes} disabled={busy}
                      onChange={(e) => setExamForm((f) => ({ ...f, durationMinutes: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Total marks</label>
                    <input type="number" min="1" className="w-full border border-gray-300 p-2.5 rounded-lg text-sm"
                      value={examForm.totalMarks} disabled={busy}
                      onChange={(e) => setExamForm((f) => ({ ...f, totalMarks: e.target.value }))} />
                  </div>
                </div>
                <button type="submit" disabled={busy} style={{ background: NAVY }}
                  className="text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                  {busy ? "Creating…" : "Create examination"}
                </button>
              </form>
            )}
          </div>

          {exams.length === 0 ? (
            <div className="bg-white rounded-2xl shadow p-8 text-center">
              <p className="text-sm text-gray-500">
                No examinations yet. Create one above to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {exams.map((exam) => {
                const qs = questionCount(exam)
                const isEditing = editing === exam.id
                return (
                  <div key={exam.id} className="bg-white rounded-2xl shadow p-6"
                    style={exam.isEnabled ? { borderLeft: `4px solid #16a34a` } : {}}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-[220px]">
                        <h3 className="font-bold text-lg">{exam.title}</h3>
                        {exam.description && (
                          <p className="text-sm text-gray-500 mt-0.5">{exam.description}</p>
                        )}
                        <div className="flex gap-2 mt-2 flex-wrap">
                          <span className={`text-xs px-2 py-1 rounded font-semibold ${
                            exam.isEnabled ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                            {exam.isEnabled ? "Live" : "Disabled"}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded font-semibold ${
                            exam.allowReattempt ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                            {exam.allowReattempt ? "Reattempts on" : "One attempt"}
                          </span>
                          {qs === 0 && (
                            <span className="text-xs px-2 py-1 rounded font-semibold bg-red-100 text-red-700">
                              No questions
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-6 text-sm flex-wrap">
                        {[
                          ["Sections", (exam.sections || []).length],
                          ["Questions", qs],
                          ["Duration", `${Math.round((exam.durationSeconds || 0) / 60)} min`],
                          ["Marks", exam.totalMarks],
                          ["Attempts", exam._count?.attempts ?? "—"],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <p className="text-gray-500 text-xs uppercase tracking-wide">{label}</p>
                            <p className="font-bold" style={{ color: NAVY }}>{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => (isEditing ? setEditing(null) : openEdit(exam))}
                          className="text-xs border px-3 py-1.5 rounded-lg hover:bg-gray-50">
                          {isEditing ? "Close" : "Edit"}
                        </button>
                        <button onClick={() => toggleReattempt(exam)} disabled={busy}
                          className="text-xs border px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                          {exam.allowReattempt ? "Block reattempts" : "Allow reattempts"}
                        </button>
                        <button onClick={() => toggleEnabled(exam)} disabled={busy}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 ${
                            exam.isEnabled
                              ? "bg-red-100 text-red-600 hover:bg-red-200"
                              : "bg-green-100 text-green-700 hover:bg-green-200"}`}>
                          {exam.isEnabled ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="mt-5 bg-gray-50 rounded-xl p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Title</label>
                            <input className="w-full border border-gray-300 p-2 rounded-lg text-sm"
                              value={editForm.title}
                              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Description</label>
                            <input className="w-full border border-gray-300 p-2 rounded-lg text-sm"
                              value={editForm.description}
                              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Duration (minutes)</label>
                            <input type="number" min="1" className="w-full border border-gray-300 p-2 rounded-lg text-sm"
                              value={editForm.durationMinutes}
                              onChange={(e) => setEditForm((f) => ({ ...f, durationMinutes: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Total marks</label>
                            <input type="number" min="1" className="w-full border border-gray-300 p-2 rounded-lg text-sm"
                              value={editForm.totalMarks}
                              onChange={(e) => setEditForm((f) => ({ ...f, totalMarks: e.target.value }))} />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-3">
                          The duration cannot be changed while a student is mid-attempt.
                        </p>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => saveEdit(exam)} disabled={busy} style={{ background: NAVY }}
                            className="text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                            {busy ? "Saving…" : "Save changes"}
                          </button>
                          <button onClick={() => setEditing(null)} disabled={busy}
                            className="border px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ SECTIONS ═══════════ */}
      {sub === "sections" && (
        <div className="space-y-6">
          {!selected ? (
            <div className="bg-white rounded-2xl shadow p-8 text-center">
              <p className="text-sm text-gray-500">Create an examination first.</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl shadow p-6">
                <h2 className="font-semibold text-lg">Add a section</h2>
                <p className="text-xs text-gray-500 mt-1 mb-5">
                  Questions belong to sections, so every examination needs at least one. Sections
                  appear to students in the order given below.
                </p>
                <form onSubmit={addSection} className="flex gap-3 flex-wrap items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                      Section name
                    </label>
                    <input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm"
                      placeholder="Quantitative Aptitude" value={sectionName} disabled={busy}
                      onChange={(e) => setSectionName(e.target.value)} />
                  </div>
                  <div className="w-28">
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                      Order
                    </label>
                    <input type="number" min="0" className="w-full border border-gray-300 p-2.5 rounded-lg text-sm"
                      placeholder={(selected.sections || []).length} value={sectionOrder} disabled={busy}
                      onChange={(e) => setSectionOrder(e.target.value)} />
                  </div>
                  <button type="submit" disabled={busy} style={{ background: NAVY }}
                    className="text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                    {busy ? "Adding…" : "Add section"}
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-2xl shadow overflow-hidden">
                <div className="p-6 pb-4">
                  <h2 className="font-semibold text-lg">
                    Sections in {selected.title}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Add and remove questions from the Questions tab.
                  </p>
                </div>
                {(selected.sections || []).length === 0 ? (
                  <p className="px-6 pb-8 pt-2 text-sm text-gray-500">
                    No sections yet. Add one above — until then, questions cannot be created.
                  </p>
                ) : (
                  <div className="divide-y">
                    {[...selected.sections]
                      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                      .map((s) => (
                        <div key={s.id} className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
                          <div>
                            <p className="font-medium">
                              {s.name}
                              <span className="text-gray-400 font-normal text-sm ml-2">
                                order {s.order ?? 0}
                              </span>
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {(s.questions || []).length} question{(s.questions || []).length === 1 ? "" : "s"}
                            </p>
                          </div>
                          {(s.questions || []).length === 0 && (
                            <span className="text-xs px-2 py-1 rounded font-semibold bg-amber-100 text-amber-700">
                              Empty
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════ BULK QUESTIONS ═══════════ */}
      {sub === "questions" && (
        <AdminBulkUpload exam={selected} onImported={load} />
      )}

      {/* ═══════════ RELEASE ═══════════ */}
      {sub === "release" && (
        <div className="space-y-6">
          {!selected ? (
            <div className="bg-white rounded-2xl shadow p-8 text-center">
              <p className="text-sm text-gray-500">Create an examination first.</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl shadow p-6">
                <h2 className="font-semibold text-lg">What students can see</h2>
                <p className="text-xs text-gray-500 mt-1 mb-5">
                  Until you publish, a student sees only that their paper was submitted. No score,
                  no rank, and no indication of which answers were right or wrong.
                </p>

                <div className="rounded-xl p-4 mb-5"
                  style={{ background: releaseState(selected).tone, color: "#fff" }}>
                  <p className="text-xs opacity-80 uppercase tracking-wide mb-1">Current status</p>
                  <p className="font-bold text-lg">{releaseState(selected).text}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                      Publish results at
                    </label>
                    <input type="datetime-local" value={resultAt}
                      onChange={(e) => setResultAt(e.target.value)}
                      className="w-full border border-gray-300 p-2.5 rounded-lg text-sm" />
                    <p className="text-xs text-gray-400 mt-1">
                      Leave empty to keep results hidden
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                      Publish answer key at
                    </label>
                    <input type="datetime-local" value={keyAt}
                      onChange={(e) => setKeyAt(e.target.value)}
                      className="w-full border border-gray-300 p-2.5 rounded-lg text-sm" />
                    <p className="text-xs text-gray-400 mt-1">
                      Leave empty to publish it with the results
                    </p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-xs text-amber-900">
                  Holding the answer key back for a day or two after the results gives you room to
                  handle re-evaluation requests before the correct answers are public.
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button onClick={saveRelease} disabled={busy} style={{ background: NAVY }}
                    className="text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                    {busy ? "Saving…" : "Save schedule"}
                  </button>
                  <button onClick={publishNow} disabled={busy}
                    className="bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                    Publish both now
                  </button>
                  {(resultAt || keyAt) && (
                    <button onClick={() => { setResultAt(""); setKeyAt("") }} disabled={busy}
                      className="border px-4 py-2.5 rounded-lg text-sm disabled:opacity-50">
                      Clear dates
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow p-6">
                <h2 className="font-semibold text-lg mb-4">Scheduled</h2>
                <div className="space-y-1 text-sm">
                  {[
                    ["Results", selected.resultReleaseAt ? fmtDateTime(selected.resultReleaseAt) : "Not set — hidden"],
                    ["Answer key", selected.answerKeyReleaseAt
                      ? fmtDateTime(selected.answerKeyReleaseAt)
                      : selected.resultReleaseAt ? "With the results" : "Not set — hidden"],
                    ["Submitted attempts", selected._count?.attempts ?? "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between py-2.5 border-b last:border-0">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════ ANSWER SHEETS ═══════════ */}
      {sub === "sheets" && (
        <div className="space-y-6">
          {!selected ? (
            <div className="bg-white rounded-2xl shadow p-8 text-center">
              <p className="text-sm text-gray-500">Create an examination first.</p>
            </div>
          ) : sheet ? (
            <>
              <div className="bg-white rounded-2xl shadow p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
                  <div>
                    <h2 className="font-bold text-lg">{sheet.attempt?.user?.name}</h2>
                    <p className="text-sm text-gray-500">{sheet.attempt?.user?.email}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {sheet.attempt?.user?.institutionName || "—"} · submitted{" "}
                      {fmtDateTime(sheet.attempt?.submittedAt)} · {fmtTime(sheet.attempt?.timeTaken)}
                    </p>
                  </div>
                  <button onClick={() => setSheet(null)}
                    className="text-sm border px-4 py-2 rounded-lg hover:bg-gray-50">
                    ← Back to list
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    ["Score", `${sheet.attempt?.result?.totalScore ?? "—"} / ${sheet.attempt?.result?.totalQuestions ?? "—"}`],
                    ["Correct", sheet.summary?.correct],
                    ["Wrong", sheet.summary?.wrong],
                    ["Skipped", sheet.summary?.skipped],
                    ["Rank", sheet.attempt?.result?.rank ? `#${sheet.attempt.result.rank}` : "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">{label}</p>
                      <p className="font-bold text-lg" style={{ color: NAVY }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow p-6">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                  <h2 className="font-semibold text-lg">Answer sheet</h2>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      ["all", `All (${sheet.summary?.total})`],
                      ["wrong", `Wrong (${sheet.summary?.wrong})`],
                      ["skipped", `Skipped (${sheet.summary?.skipped})`],
                      ["review", "Marked review"],
                    ].map(([id, label]) => (
                      <button key={id} onClick={() => setSheetFilter(id)}
                        style={sheetFilter === id ? { background: NAVY } : {}}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                          sheetFilter === id ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {(sheet.answers || [])
                    .filter((a) => {
                      if (sheetFilter === "wrong") return a.selectedKey && !a.isCorrect
                      if (sheetFilter === "skipped") return !a.selectedKey
                      if (sheetFilter === "review") return a.markedReview
                      return true
                    })
                    .map((a, i) => (
                      <div key={a.id}
                        className={`rounded-xl border-2 p-4 ${
                          !a.selectedKey ? "border-gray-200 bg-gray-50"
                          : a.isCorrect ? "border-green-300 bg-green-50"
                          : "border-red-300 bg-red-50"}`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                          <p className="text-xs text-gray-500">
                            {a.sectionName}
                            {a.markedReview && (
                              <span className="ml-2 text-amber-700 font-semibold">marked for review</span>
                            )}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            !a.selectedKey ? "bg-gray-200 text-gray-600"
                            : a.isCorrect ? "bg-green-200 text-green-800"
                            : "bg-red-200 text-red-800"}`}>
                            {!a.selectedKey ? "Skipped" : a.isCorrect ? "Correct" : "Wrong"}
                          </span>
                        </div>

                        <p className="font-medium text-sm mb-3">{i + 1}. {a.questionText}</p>

                        <div className="space-y-1.5 text-sm">
                          {(a.options || []).map((o) => {
                            const chosen = o.key === a.selectedKey
                            return (
                              <div key={o.key}
                                className={`p-2 rounded flex items-start gap-2 ${
                                  o.isCorrect ? "bg-green-200"
                                  : chosen ? "bg-red-200"
                                  : "bg-white"}`}>
                                <span className="font-bold">{o.key}.</span>
                                <span className="flex-1">{o.text}</span>
                                {o.isCorrect && (
                                  <span className="text-xs font-semibold text-green-800">correct answer</span>
                                )}
                                {chosen && !o.isCorrect && (
                                  <span className="text-xs font-semibold text-red-800">student chose</span>
                                )}
                                {chosen && o.isCorrect && (
                                  <span className="text-xs font-semibold text-green-800">student chose</span>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {a.explanation && (
                          <p className="text-xs text-gray-600 mt-3 pt-3 border-t">
                            <span className="font-semibold">Explanation:</span> {a.explanation}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <div className="p-6 pb-4">
                <h2 className="font-semibold text-lg">Answer sheets</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Open any student's paper to see exactly what they answered. Useful for settling a
                  re-evaluation request. Visible to you whether or not results are published.
                </p>
              </div>

              {sheetLoading ? (
                <p className="px-6 pb-8 text-sm text-gray-500">Loading sheet…</p>
              ) : attempts === null ? (
                <p className="px-6 pb-8 text-sm text-gray-500">Loading attempts…</p>
              ) : attempts.count === 0 ? (
                <p className="px-6 pb-8 pt-2 text-sm text-gray-500">
                  No submitted attempts for this examination yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>
                        <th className="px-6 py-3 text-left">Student</th>
                        <th className="px-6 py-3 text-left">Submitted</th>
                        <th className="px-6 py-3 text-center">Score</th>
                        <th className="px-6 py-3 text-center">Rank</th>
                        <th className="px-6 py-3 text-center">Time</th>
                        <th className="px-6 py-3 text-center">Sheet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attempts.attempts.map((a) => (
                        <tr key={a.id} className="border-t hover:bg-gray-50">
                          <td className="px-6 py-3">
                            <p className="font-medium">{a.user?.name}</p>
                            <p className="text-xs text-gray-400">
                              {a.user?.institutionName || a.user?.email}
                            </p>
                          </td>
                          <td className="px-6 py-3 text-gray-500 text-xs">
                            {fmtDateTime(a.submittedAt)}
                          </td>
                          <td className="px-6 py-3 text-center font-semibold">
                            {a.totalScore ?? "—"}/{a.totalQuestions ?? "—"}
                          </td>
                          <td className="px-6 py-3 text-center">
                            {a.rank ? `#${a.rank}` : "—"}
                          </td>
                          <td className="px-6 py-3 text-center text-gray-500 text-xs">
                            {fmtTime(a.timeTaken)}
                          </td>
                          <td className="px-6 py-3 text-center">
                            <button onClick={() => openSheet(a.id)}
                              className="text-xs border px-3 py-1.5 rounded-lg hover:bg-gray-100">
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
