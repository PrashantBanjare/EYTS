import { useState } from "react"
import api from "../services/api"

const NAVY = "#0a1628"
const GOLD = "#c9a84c"

// Reading the file in the browser and posting the text keeps the backend
// free of multipart handling. A 500-question CSV is well under 1 MB.
const readFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error("Could not read the file"))
    reader.readAsText(file, "UTF-8")
  })

export function AdminBulkUpload({ exam, onImported }) {
  const [csv, setCsv] = useState("")
  const [fileName, setFileName] = useState("")
  const [pasteMode, setPasteMode] = useState(false)

  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [clearing, setClearing] = useState(false)
  const [clearConfirm, setClearConfirm] = useState("")

  const reset = () => {
    setCsv("")
    setFileName("")
    setReport(null)
    setError("")
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError("")
    setReport(null)
    setSuccess("")

    if (!/\.(csv|txt)$/i.test(file.name)) {
      setError("Choose a .csv file. If you have an Excel sheet, use File → Save As → CSV UTF-8.")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("That file is over 2 MB, which is far larger than a question paper should be.")
      return
    }

    try {
      const text = await readFile(file)
      setCsv(text)
      setFileName(file.name)
    } catch (err) {
      setError(err.message)
    }
  }

  const downloadTemplate = async () => {
    setError("")
    try {
      const res = await api.get("/bulk/questions/template", { responseType: "blob" })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }))
      const a = document.createElement("a")
      a.href = url
      a.download = "question_template.csv"
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError("Could not download the template")
    }
  }

  const validate = async () => {
    if (!exam?.id) return setError("Select an examination first")
    if (!csv.trim()) return setError("Choose a file or paste the rows first")

    setBusy(true)
    setError("")
    setSuccess("")
    setReport(null)
    try {
      const res = await api.post("/bulk/questions/validate", { examId: exam.id, csv })
      setReport(res.data)
    } catch (err) {
      setError(err.response?.data?.message || "Could not read the file")
    } finally {
      setBusy(false)
    }
  }

  const commit = async () => {
    if (!report || report.readyToImport === 0) return

    if (!confirm(
      `Import ${report.readyToImport} question(s) into "${exam.title}"?\n\n` +
      Object.entries(report.bySection || {})
        .map(([s, n]) => `  ${s}: ${n}`)
        .join("\n") +
      (report.warningCount > 0
        ? `\n\n${report.warningCount} duplicate(s) will be skipped.`
        : "") +
      "\n\nThis cannot be undone, but you can clear all questions afterwards."
    )) return

    setBusy(true)
    setError("")
    try {
      const res = await api.post("/bulk/questions/import", { examId: exam.id, csv })
      setSuccess(res.data.message)
      reset()
      if (onImported) await onImported()
    } catch (err) {
      setError(err.response?.data?.message || "The import failed. Nothing was saved.")
    } finally {
      setBusy(false)
    }
  }

  const clearAll = async () => {
    if (clearConfirm !== exam.title) {
      return setError("Type the examination title exactly to confirm")
    }
    setBusy(true)
    setError("")
    try {
      const res = await api.delete(`/bulk/questions/${exam.id}`, {
        data: { confirm: clearConfirm },
      })
      setSuccess(res.data.message)
      setClearing(false)
      setClearConfirm("")
      if (onImported) await onImported()
    } catch (err) {
      setError(err.response?.data?.message || "Could not clear the questions")
    } finally {
      setBusy(false)
    }
  }

  if (!exam) {
    return (
      <div className="bg-white rounded-2xl shadow p-8 text-center">
        <p className="text-sm text-gray-500">Create an examination first.</p>
      </div>
    )
  }

  const sections = exam.sections || []
  const existing = sections.reduce((n, s) => n + (s.questions?.length || 0), 0)

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

      {/* Instructions */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="font-semibold text-lg">Bulk question upload</h2>
        <p className="text-xs text-gray-500 mt-1 mb-5">
          Load a whole paper from a spreadsheet instead of typing questions one at a time.
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mb-5">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Required columns
          </p>
          <p className="font-mono text-xs text-gray-600 mb-3 break-all">
            section, question, optionA, optionB, optionC, optionD, correct, explanation
          </p>
          <ul className="text-xs text-gray-600 space-y-1.5 list-disc pl-4">
            <li>
              <strong>section</strong> must match a section already on this examination. Available:{" "}
              {sections.length > 0
                ? <span className="font-medium">{sections.map((s) => s.name).join(", ")}</span>
                : <span className="text-red-600 font-medium">none — add a section first</span>}
            </li>
            <li><strong>correct</strong> is a single letter: A, B, C or D</li>
            <li><strong>explanation</strong> may be left blank</li>
            <li>Wrap any cell containing a comma in double quotes</li>
            <li>Save from Excel as <strong>CSV UTF-8</strong> so special characters survive</li>
          </ul>
        </div>

        <button onClick={downloadTemplate}
          className="text-sm border px-4 py-2 rounded-lg hover:bg-gray-50 font-medium">
          Download template CSV
        </button>
      </div>

      {sections.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <p className="font-semibold text-amber-900 text-sm mb-1">No sections yet</p>
          <p className="text-sm text-amber-800">
            Questions belong to sections, so add at least one on the Sections tab before uploading.
          </p>
        </div>
      ) : (
        <>
          {/* Upload */}
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <div>
                <h2 className="font-semibold text-lg">Choose your file</h2>
                <p className="text-xs text-gray-500 mt-1">
                  {exam.title} currently has {existing} question{existing === 1 ? "" : "s"}
                </p>
              </div>
              <button onClick={() => { setPasteMode((p) => !p); reset() }}
                className="text-xs border px-3 py-1.5 rounded-lg hover:bg-gray-50">
                {pasteMode ? "Upload a file instead" : "Paste rows instead"}
              </button>
            </div>

            {pasteMode ? (
              <>
                <textarea rows={8} value={csv}
                  onChange={(e) => { setCsv(e.target.value); setReport(null) }}
                  placeholder="section,question,optionA,optionB,optionC,optionD,correct,explanation&#10;Reasoning,&quot;Next in 2, 4, 6?&quot;,7,8,9,10,B,"
                  className="w-full border border-gray-300 p-3 rounded-lg font-mono text-xs focus:outline-none focus:border-black" />
                <p className="text-xs text-gray-400 mt-1">
                  Include the header row. {csv.split("\n").filter((l) => l.trim()).length} line(s) entered.
                </p>
              </>
            ) : (
              <>
                <input type="file" accept=".csv,.txt" onChange={handleFile} disabled={busy}
                  className="w-full border border-gray-300 p-3 rounded-lg text-sm file:mr-3 file:py-1.5 file:px-4 file:rounded file:border-0 file:text-sm file:bg-gray-100" />
                {fileName && (
                  <p className="text-xs text-gray-500 mt-2">
                    Loaded <strong>{fileName}</strong> ·{" "}
                    {csv.split("\n").filter((l) => l.trim()).length - 1} data row(s)
                  </p>
                )}
              </>
            )}

            <div className="flex gap-2 mt-4 flex-wrap">
              <button onClick={validate} disabled={busy || !csv.trim()}
                style={{ background: NAVY }}
                className="text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40">
                {busy && !report ? "Checking…" : "Check the file"}
              </button>
              {csv && (
                <button onClick={reset} disabled={busy}
                  className="border px-4 py-2.5 rounded-lg text-sm disabled:opacity-50">
                  Clear
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Checking writes nothing. You will see exactly what would be imported first.
            </p>
          </div>

          {/* Report */}
          {report && (
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-semibold text-lg mb-4">What the file contains</h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  ["Rows read", report.totalRows, "#64748b"],
                  ["Ready to import", report.readyToImport, "#16a34a"],
                  ["Errors", report.errorCount, report.errorCount > 0 ? "#dc2626" : "#64748b"],
                  ["Skipped", report.warningCount, report.warningCount > 0 ? GOLD : "#64748b"],
                ].map(([label, value, tone]) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className="text-2xl font-bold" style={{ color: tone }}>{value}</p>
                  </div>
                ))}
              </div>

              {Object.keys(report.bySection || {}).length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                    By section
                  </p>
                  <div className="space-y-1 text-sm">
                    {Object.entries(report.bySection).map(([name, n]) => (
                      <div key={name} className="flex justify-between py-1.5 border-b last:border-0">
                        <span className="text-gray-600">{name}</span>
                        <span className="font-semibold">{n} question{n === 1 ? "" : "s"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.errorCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
                  <p className="font-semibold text-red-800 text-sm mb-2">
                    {report.errorCount} row(s) must be fixed — nothing will import until they are
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {report.errors.map((e, i) => (
                      <div key={i} className="text-xs text-red-700">
                        <span className="font-bold">Line {e.line}</span>
                        {e.question && <span className="text-red-500"> — {e.question}…</span>}
                        <ul className="list-disc pl-5 mt-0.5">
                          {e.problems.map((p, j) => <li key={j}>{p}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-red-600 mt-3">
                    Line numbers match your spreadsheet, counting the header as line 1.
                  </p>
                </div>
              )}

              {report.warningCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
                  <p className="font-semibold text-amber-900 text-sm mb-2">
                    {report.warningCount} duplicate(s) will be skipped
                  </p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {report.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-800">
                        <span className="font-bold">Line {w.line}</span> — {w.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {report.preview?.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                    First {report.preview.length} question(s), as they will be stored
                  </p>
                  <div className="space-y-3">
                    {report.preview.map((q, i) => (
                      <div key={i} className="border border-gray-200 rounded-xl p-3">
                        <p className="text-xs" style={{ color: GOLD }}>{q.sectionName}</p>
                        <p className="font-medium text-sm mt-1 mb-2">{q.text}</p>
                        <div className="space-y-1 text-sm">
                          {["A", "B", "C", "D"].map((k) => (
                            <div key={k}
                              className={`p-1.5 rounded flex items-center gap-2 ${
                                q.correct === k ? "bg-green-100" : "bg-gray-50"}`}>
                              <span className="font-bold text-xs">{k}.</span>
                              <span className="flex-1">{q.options[k]}</span>
                              {q.correct === k && (
                                <span className="text-xs font-semibold text-green-700">correct</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 flex-wrap pt-4 border-t">
                <button onClick={commit}
                  disabled={busy || report.errorCount > 0 || report.readyToImport === 0}
                  style={{ background: report.errorCount > 0 ? "#cbd5e1" : "#16a34a" }}
                  className="text-white px-6 py-2.5 rounded-lg text-sm font-bold disabled:cursor-not-allowed">
                  {busy ? "Importing…"
                    : report.errorCount > 0 ? "Fix the errors first"
                    : report.readyToImport === 0 ? "Nothing new to import"
                    : `Import ${report.readyToImport} question(s)`}
                </button>
                <button onClick={() => setReport(null)} disabled={busy}
                  className="border px-4 py-2.5 rounded-lg text-sm disabled:opacity-50">
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Clear */}
          <div className="bg-white rounded-2xl shadow p-6"
            style={{ borderLeft: "4px solid #dc2626" }}>
            <h2 className="font-semibold text-lg">Start the paper over</h2>
            <p className="text-xs text-gray-500 mt-1 mb-4">
              Removes every question from {exam.title}. Only possible while no student has attempted
              it — once anyone has sat the paper, their answers depend on these questions.
            </p>

            {!clearing ? (
              <button onClick={() => setClearing(true)} disabled={existing === 0}
                className="text-sm border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 disabled:opacity-40">
                {existing === 0 ? "No questions to clear" : `Clear all ${existing} question(s)`}
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-800 mb-3">
                  Type <strong>{exam.title}</strong> to confirm.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <input value={clearConfirm} onChange={(e) => setClearConfirm(e.target.value)}
                    placeholder={exam.title}
                    className="flex-1 min-w-[200px] border border-gray-300 p-2 rounded-lg text-sm" />
                  <button onClick={clearAll} disabled={busy || clearConfirm !== exam.title}
                    className="bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-40">
                    {busy ? "Clearing…" : "Delete all questions"}
                  </button>
                  <button onClick={() => { setClearing(false); setClearConfirm("") }} disabled={busy}
                    className="border px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default AdminBulkUpload
