import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { examService, attemptService, proctoringService } from "../services/api"

const NAVY = "#0a1628"
const GOLD = "#c9a84c"

const MAX_TAB_SWITCHES = 2      // 1st = warning, 2nd = automatic submission
const EVENT_FLUSH_MS = 15000    // batch incidents rather than one request each
const FACE_CHECK_MS = 3000      // how often BlazeFace runs
const SNAPSHOT_MS = 30000       // FULL_RECORDING only
const FACE_ABSENT_STRIKES = 3   // ~9s away before it is recorded

function Exam() {
  const navigate = useNavigate()

  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [attemptId, setAttemptId] = useState(null)

  const [started, setStarted] = useState(false)
  const [starting, setStarting] = useState(false)
  const [agreed, setAgreed] = useState(false)

  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({})     // { questionId: "A" }
  const [reviewed, setReviewed] = useState({})   // { questionId: true }

  const [timeLeft, setTimeLeft] = useState(0)
  const [tabSwitches, setTabSwitches] = useState(0)
  const [autoSubmitReason, setAutoSubmitReason] = useState("")

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // ── Proctoring state ──
  const [proctoring, setProctoring] = useState(null)   // config from the server
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState("")
  const [modelLoading, setModelLoading] = useState(false)
  const [faceWarning, setFaceWarning] = useState("")
  const [needsConsent, setNeedsConsent] = useState(false)

  const startTimeRef = useRef(null)
  const timerRef = useRef(null)
  const timeLeftRef = useRef(0)
  const submittedRef = useRef(false)     // guards against double submission

  // ── Proctoring refs ──
  // Refs, not state: these are written from intervals and event handlers
  // that would otherwise capture a stale closure.
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const modelRef = useRef(null)
  const eventQueueRef = useRef([])
  const faceAbsentCountRef = useRef(0)
  const attemptIdRef = useRef(null)
  const proctoringRef = useRef(null)

  // ── Queue an incident. Never awaited by the UI: proctoring must not
  //    be able to slow down or interrupt somebody's examination.
  const logEvent = useCallback((eventType, metadata = null) => {
    if (!attemptIdRef.current) return
    eventQueueRef.current.push({
      eventType,
      metadata,
      occurredAt: new Date().toISOString(),
    })
  }, [])

  const flushEvents = useCallback(() => {
    const id = attemptIdRef.current
    if (!id || eventQueueRef.current.length === 0) return
    const batch = eventQueueRef.current.splice(0, 100)
    proctoringService.recordEvents(id, batch)
  }, [])

  // ── Load the exam and its proctoring rules. No attempt is created
  //    here: the timer must not start until Start is pressed.
  useEffect(() => {
    const loadExam = async () => {
      setLoading(true)
      setError("")
      try {
        const res = await examService.getActive()
        const data = res.data?.exam
        if (!data) {
          setError("No exam is currently available.")
          return
        }
        if (!Array.isArray(data.sections) || data.sections.length === 0) {
          setError("This exam has no sections set up yet. Please contact the office.")
          return
        }

        const all = data.sections.flatMap((section) =>
          (section.questions || []).map((q) => ({
            ...q,
            sectionId: section.id,
            sectionName: section.name,
          }))
        )

        if (all.length === 0) {
          setError("This exam has no questions yet. Please contact the office.")
          return
        }

        setExam(data)
        setQuestions(all)
        setTimeLeft(data.durationSeconds || 3600)
        timeLeftRef.current = data.durationSeconds || 3600

        // What monitoring applies to this candidate, and do they need a
        // parent's consent first. The server decides; the browser only
        // displays and obeys.
        try {
          const cfg = await proctoringService.getConfig(data.id)
          setProctoring(cfg.data)
          proctoringRef.current = cfg.data
          if (cfg.data.needsConsent && !cfg.data.consentGiven) {
            setNeedsConsent(true)
          }
        } catch (err) {
          // A proctoring lookup failing should not block an unproctored
          // exam. The server enforces the real gate on start anyway.
          console.error("proctoring config error:", err)
          setProctoring({ mode: "OFF", usesCamera: false })
          proctoringRef.current = { mode: "OFF", usesCamera: false }
        }
      } catch (err) {
        setError(err.response?.data?.message || "Could not load the exam.")
        console.error("loadExam error:", err)
      } finally {
        setLoading(false)
      }
    }
    loadExam()
  }, [])

  // ── Camera ──────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraReady(false)
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setCameraReady(true)
      setCameraError("")
      logEvent("CAMERA_STARTED")
      return true
    } catch (err) {
      // Distinguish refusal from absence: one is a choice, the other a
      // circumstance, and the office will want to tell them apart.
      const blocked =
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
      setCameraError(
        blocked
          ? "Camera access was denied. This examination requires the camera to be on."
          : "No camera was found, or it is being used by another application."
      )
      logEvent(blocked ? "CAMERA_BLOCKED" : "CAMERA_ERROR", { name: err.name })
      return false
    }
  }, [logEvent])

  // ── BlazeFace, loaded lazily so an unproctored exam never pays the
  //    2 MB download cost.
  const loadModel = useCallback(async () => {
    if (modelRef.current) return modelRef.current
    setModelLoading(true)
    try {
      const tf = await import("@tensorflow/tfjs")
      const blazeface = await import("@tensorflow-models/blazeface")
      await tf.ready()
      modelRef.current = await blazeface.load()
      return modelRef.current
    } catch (err) {
      console.error("blazeface load error:", err)
      logEvent("CAMERA_ERROR", { stage: "model_load" })
      return null
    } finally {
      setModelLoading(false)
    }
  }, [logEvent])

  // ── Face checks. A single missed frame is not a violation — people
  //    move, lean, and rub their eyes. Only sustained absence counts.
  useEffect(() => {
    if (!started || !cameraReady) return
    const cfg = proctoringRef.current
    if (!cfg?.usesCamera) return

    let cancelled = false

    const check = async () => {
      if (cancelled || submittedRef.current) return
      const model = modelRef.current
      const video = videoRef.current
      if (!model || !video || video.readyState !== 4) return

      try {
        const faces = await model.estimateFaces(video, false)

        if (faces.length === 0) {
          faceAbsentCountRef.current += 1
          if (faceAbsentCountRef.current === FACE_ABSENT_STRIKES) {
            logEvent("FACE_ABSENT")
            setFaceWarning("Your face is not visible. Please face the camera.")
          }
        } else if (faces.length > 1) {
          faceAbsentCountRef.current = 0
          logEvent("MULTIPLE_FACES", { count: faces.length })
          setFaceWarning(`${faces.length} people are visible. Only you may be in frame.`)
        } else {
          faceAbsentCountRef.current = 0
          setFaceWarning("")
        }
      } catch (err) {
        // A failed inference is not a violation.
        console.error("face check error:", err)
      }
    }

    const interval = setInterval(check, FACE_CHECK_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [started, cameraReady, logEvent])

  // ── Snapshots, FULL_RECORDING only ──────────────────────────────
  useEffect(() => {
    if (!started || !cameraReady) return
    if (proctoringRef.current?.mode !== "FULL_RECORDING") return

    const capture = () => {
      if (submittedRef.current) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState !== 4) return

      canvas.width = 320
      canvas.height = 240
      const ctx = canvas.getContext("2d")
      ctx.drawImage(video, 0, 0, 320, 240)

      // 0.6 quality: enough to identify a person, small enough that
      // thousands of candidates do not overwhelm the database.
      const data = canvas.toDataURL("image/jpeg", 0.6)
      const flagged = faceAbsentCountRef.current >= FACE_ABSENT_STRIKES
      proctoringService.recordSnapshot(
        attemptIdRef.current, data, flagged,
        flagged ? "Face not detected at capture" : null
      )
    }

    const interval = setInterval(capture, SNAPSHOT_MS)
    return () => clearInterval(interval)
  }, [started, cameraReady])

  // ── Flush the incident queue on a timer ─────────────────────────
  useEffect(() => {
    if (!started) return
    const interval = setInterval(flushEvents, EVENT_FLUSH_MS)
    return () => clearInterval(interval)
  }, [started, flushEvents])

  // ── Browser-level detectors ─────────────────────────────────────
  useEffect(() => {
    if (!started) return
    const mode = proctoringRef.current?.mode || "OFF"
    if (mode === "OFF") return

    const onBlur = () => { if (!submittedRef.current) logEvent("WINDOW_BLUR") }
    const onCopy = () => { if (!submittedRef.current) logEvent("COPY") }
    const onPaste = () => { if (!submittedRef.current) logEvent("PASTE") }
    const onContext = (e) => {
      if (submittedRef.current) return
      e.preventDefault()
      logEvent("RIGHT_CLICK")
    }
    const onFullscreen = () => {
      if (!document.fullscreenElement && !submittedRef.current) {
        logEvent("FULLSCREEN_EXIT")
      }
    }
    const onKeyDown = (e) => {
      if (submittedRef.current) return
      // F12 and Ctrl+Shift+I/J are the usual routes into devtools.
      if (e.key === "F12" || (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase()))) {
        e.preventDefault()
        logEvent("DEVTOOLS")
      }
    }

    window.addEventListener("blur", onBlur)
    document.addEventListener("copy", onCopy)
    document.addEventListener("paste", onPaste)
    document.addEventListener("contextmenu", onContext)
    document.addEventListener("fullscreenchange", onFullscreen)
    document.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("blur", onBlur)
      document.removeEventListener("copy", onCopy)
      document.removeEventListener("paste", onPaste)
      document.removeEventListener("contextmenu", onContext)
      document.removeEventListener("fullscreenchange", onFullscreen)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [started, logEvent])

  // ── Submit ──────────────────────────────────────────────────────
  const doSubmit = useCallback(async (reason = "") => {
    if (submittedRef.current || !attemptId) return
    submittedRef.current = true
    setSubmitting(true)
    if (reason) setAutoSubmitReason(reason)
    if (timerRef.current) clearInterval(timerRef.current)

    // Send whatever is still queued before the attempt closes — the
    // server rejects events on a submitted attempt.
    flushEvents()
    stopCamera()

    try {
      const timeTaken = Math.max(
        Math.round((Date.now() - (startTimeRef.current || Date.now())) / 1000), 0
      )
      const answerArray = questions.map((q) => ({
        questionId: q.id,
        selectedKey: answers[q.id] || null,
        markedReview: !!reviewed[q.id],
      }))

      await attemptService.submit(attemptId, answerArray, timeTaken)
      navigate(`/result/${attemptId}`)
    } catch (err) {
      submittedRef.current = false
      setSubmitting(false)
      setError(err.response?.data?.message || "Submission failed. Please try again.")
      console.error("submit error:", err)
    }
  }, [attemptId, answers, reviewed, questions, navigate, flushEvents, stopCamera])

  // ── Timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!started) return
    timerRef.current = setInterval(() => {
      timeLeftRef.current -= 1
      setTimeLeft(timeLeftRef.current)
      if (timeLeftRef.current <= 0) {
        clearInterval(timerRef.current)
        doSubmit("Time expired")
      }
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [started, doSubmit])

  // ── Tab-switch detection: 1st is a warning, 2nd submits ─────────
  useEffect(() => {
    if (!started) return
    const onHidden = () => {
      if (!document.hidden || submittedRef.current) return
      logEvent("TAB_SWITCH")
      setTabSwitches((prev) => {
        const count = prev + 1
        if (count >= MAX_TAB_SWITCHES) {
          doSubmit(`Examination submitted automatically after ${count} tab switches`)
        }
        return count
      })
    }
    document.addEventListener("visibilitychange", onHidden)
    return () => document.removeEventListener("visibilitychange", onHidden)
  }, [started, doSubmit, logEvent])

  // ── Warn on refresh or close while the exam is live ─────────────
  useEffect(() => {
    if (!started) return
    const onBeforeUnload = (e) => {
      if (submittedRef.current) return
      e.preventDefault()
      e.returnValue = ""
      return ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [started])

  // ── Release the camera if the page unmounts for any reason ──────
  useEffect(() => () => stopCamera(), [stopCamera])

  // ── Start the attempt ───────────────────────────────────────────
  const handleStart = async () => {
    if (!agreed || starting) return
    setStarting(true)
    setError("")

    try {
      const cfg = proctoringRef.current

      // Camera first. Starting the attempt and then failing to get a
      // camera would burn the candidate's only attempt on a permission
      // dialog they could have fixed.
      if (cfg?.usesCamera) {
        const ok = await startCamera()
        if (!ok) {
          setStarting(false)
          return
        }
        await loadModel()
      }

      const res = await attemptService.start(exam.id)
      const id = res.data?.attemptId
      if (!id) {
        setError("Could not start the examination. Please try again.")
        stopCamera()
        return
      }

      setAttemptId(id)
      attemptIdRef.current = id
      startTimeRef.current = Date.now()

      if (res.data?.durationSeconds) {
        setTimeLeft(res.data.durationSeconds)
        timeLeftRef.current = res.data.durationSeconds
      }

      // The server is the authority on which mode applies, not the
      // config fetched earlier — settings may have changed since.
      if (res.data?.proctoringMode) {
        const merged = {
          ...cfg,
          mode: res.data.proctoringMode,
          usesCamera: res.data.usesCamera,
          storesSnapshots: res.data.storesSnapshots,
        }
        setProctoring(merged)
        proctoringRef.current = merged
      }

      setStarted(true)
    } catch (err) {
      stopCamera()
      // The consent gate is enforced server-side, so this is where a
      // candidate who skipped the consent screen is turned back.
      if (err.response?.data?.needsParentalConsent) {
        setNeedsConsent(true)
      }
      setError(err.response?.data?.message || "Could not start the examination.")
      console.error("start error:", err)
    } finally {
      setStarting(false)
    }
  }

  const formatTime = (s) => {
    if (s < 0) s = 0
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    const mm = String(m).padStart(2, "0")
    const ss = String(sec).padStart(2, "0")
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
  }

  const selectAnswer = (qid, key) => setAnswers((p) => ({ ...p, [qid]: key }))
  const toggleReview = (qid) => setReviewed((p) => ({ ...p, [qid]: !p[qid] }))

  const sections = exam?.sections || []
  const totalMinutes = Math.round((exam?.durationSeconds || 0) / 60)

  const MODE_LABEL = {
    OFF: "Not monitored",
    BROWSER_ONLY: "Activity monitored",
    FACE_DETECTION: "Camera monitored",
    FULL_RECORDING: "Camera monitored and recorded",
  }

  // ══════════════════════════════════════════════════════════════
  //  LOADING / ERROR
  // ══════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin mb-4" />
          <p className="text-gray-500 font-medium">Loading examination…</p>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════
  //  PARENTAL CONSENT REQUIRED
  // ══════════════════════════════════════════════════════════════
  if (needsConsent && !started) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">👪</div>
          <h2 className="text-xl font-bold mb-2">Parental consent needed</h2>
          <p className="text-gray-600 text-sm mb-6 leading-relaxed">
            This examination is monitored by camera. Because you are under 18, a parent
            or guardian must give their consent before you can begin.
          </p>
          <button onClick={() => navigate("/parental-consent")} style={{ background: NAVY }}
            className="w-full text-white py-3 rounded-xl font-bold mb-3">
            Get consent now →
          </button>
          <button onClick={() => navigate("/dashboard")}
            className="w-full border border-gray-300 py-2.5 rounded-xl text-sm font-medium">
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  if (error && !started) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">Cannot start the examination</h2>
          <p className="text-gray-600 text-sm mb-6">{error}</p>
          <button onClick={() => navigate("/dashboard")} style={{ background: NAVY }}
            className="text-white px-6 py-2 rounded-lg font-medium">
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════
  //  INSTRUCTIONS — nothing is started until Start is pressed
  // ══════════════════════════════════════════════════════════════
  if (!started) {
    const usesCamera = proctoring?.usesCamera
    const recordsImages = proctoring?.mode === "FULL_RECORDING"

    return (
      <div className="min-h-screen bg-gray-100 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div style={{ background: NAVY }} className="rounded-t-2xl p-6 text-white">
            <p className="text-xs uppercase tracking-widest" style={{ color: GOLD }}>
              Excellence Youth Talent Search LLP
            </p>
            <h1 className="text-2xl font-bold mt-1">{exam?.title}</h1>
            {exam?.description && (
              <p className="text-sm text-white/60 mt-1">{exam.description}</p>
            )}
            {proctoring?.mode && proctoring.mode !== "OFF" && (
              <span className="inline-block mt-3 text-xs px-3 py-1 rounded-full"
                style={{ background: "rgba(201,168,76,0.2)", color: GOLD }}>
                {MODE_LABEL[proctoring.mode]}
              </span>
            )}
          </div>

          <div className="bg-white rounded-b-2xl shadow-lg p-6 md:p-8">
            <h2 className="font-bold text-lg mb-4">Examination details</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              {[
                ["Questions", questions.length],
                ["Duration", `${totalMinutes} min`],
                ["Total marks", questions.length],
                ["Negative marking", "None"],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="font-bold text-lg" style={{ color: NAVY }}>{value}</p>
                </div>
              ))}
            </div>

            <h2 className="font-bold text-lg mb-3">Sections</h2>
            <div className="mb-8">
              {sections.map((s) => (
                <div key={s.id} className="flex justify-between text-sm py-2 border-b last:border-0">
                  <span className="text-gray-700">{s.name}</span>
                  <span className="text-gray-400">
                    {(s.questions || []).length} question{(s.questions || []).length === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>

            <h2 className="font-bold text-lg mb-3">Rules and regulations</h2>
            <ol className="text-sm text-gray-700 space-y-2.5 mb-6 list-decimal pl-5">
              <li>
                The timer starts the moment you press <strong>Start examination</strong> and does not
                pause for any reason.
              </li>
              <li>
                Each correct answer earns one mark. There is <strong>no negative marking</strong>, so
                an unsure answer costs you nothing.
              </li>
              <li>
                You may move freely between questions and mark any question for review before
                submitting.
              </li>
              <li>
                When the time runs out the examination is <strong>submitted automatically</strong> with
                whatever you have answered.
              </li>
              <li>
                Do not refresh, close, or navigate away from this page while the examination is in
                progress.
              </li>
              <li>
                Results are published after the release date set by the office. Your rank is decided by
                score first, then by time taken.
              </li>
            </ol>

            {/* ── What is monitored ── */}
            {proctoring?.mode && proctoring.mode !== "OFF" && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <p className="font-bold text-blue-900 text-sm mb-2">
                  What is monitored during this examination
                </p>
                <ul className="text-sm text-blue-800 space-y-1.5 list-disc pl-5">
                  <li>Switching tabs, windows or applications</li>
                  <li>Copying, pasting, and attempts to open developer tools</li>
                  {usesCamera && (
                    <li>
                      Your webcam, to confirm you are present and that nobody else is in frame
                    </li>
                  )}
                  {recordsImages && (
                    <li>
                      <strong>Still images from your webcam are captured periodically and stored</strong>{" "}
                      for review by the examination office
                    </li>
                  )}
                  {usesCamera && !recordsImages && (
                    <li>
                      No images are stored — only whether a face was detected
                    </li>
                  )}
                </ul>
                {usesCamera && (
                  <p className="text-xs text-blue-700 mt-3">
                    Your camera will be requested when you press Start. The examination cannot
                    begin without it.
                  </p>
                )}
              </div>
            )}

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="font-bold text-red-800 text-sm mb-2">
                Leaving this window is monitored
              </p>
              <ul className="text-sm text-red-700 space-y-1.5 list-disc pl-5">
                <li>
                  Switching to another tab, window, or application is detected and recorded against
                  your attempt.
                </li>
                <li>
                  <strong>
                    The first switch is a warning. On the second, your examination is submitted
                    immediately
                  </strong>{" "}
                  with only the answers given up to that point.
                </li>
                <li>
                  This cannot be undone or appealed, so close every other application before you begin.
                </li>
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-900">
              <p className="font-bold mb-1">Before you start</p>
              <p>
                Make sure you have a stable internet connection, sufficient battery, and{" "}
                {totalMinutes} uninterrupted minutes. You cannot pause once started, and
                {exam?.allowReattempt
                  ? " reattempts are allowed only at the discretion of the office."
                  : " you will not be given a second attempt."}
                {usesCamera && " Sit in a well-lit room where your face is clearly visible."}
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer bg-gray-50 rounded-xl p-4 mb-6">
              <input type="checkbox" checked={agreed} className="mt-1 cursor-pointer w-4 h-4"
                onChange={(e) => setAgreed(e.target.checked)} />
              <span className="text-sm text-gray-800">
                I have read and understood all the rules above. I confirm that I am appearing for this
                examination myself, without assistance from any other person or material, and I accept
                that my examination will be submitted automatically if I leave this window twice.
                {usesCamera && (
                  <>
                    {" "}I consent to my webcam being used to monitor this examination
                    {recordsImages && ", and to still images being captured and stored"}.
                  </>
                )}
              </span>
            </label>

            {cameraError && (
              <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm">
                {cameraError}
                <button onClick={startCamera} className="ml-2 underline font-medium">
                  Try again
                </button>
              </div>
            )}

            {error && (
              <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>
            )}

            <div className="flex gap-3 flex-wrap">
              <button onClick={handleStart} disabled={!agreed || starting}
                style={{ background: agreed ? NAVY : "#cbd5e1" }}
                className="flex-1 min-w-[200px] text-white py-3.5 rounded-xl font-bold disabled:cursor-not-allowed">
                {starting
                  ? (modelLoading ? "Preparing monitoring…" : "Starting…")
                  : agreed
                    ? (usesCamera ? "Allow camera and start →" : "Start examination →")
                    : "Tick the declaration to start"}
              </button>
              <button onClick={() => navigate("/dashboard")} disabled={starting}
                className="px-6 py-3.5 border border-gray-300 rounded-xl text-sm font-medium disabled:opacity-50">
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════
  //  AUTO-SUBMITTED OVERLAY
  // ══════════════════════════════════════════════════════════════
  if (autoSubmitReason && submitting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">⏱</div>
          <h2 className="text-xl font-bold mb-2">{autoSubmitReason}</h2>
          <p className="text-gray-600 text-sm">Saving your answers and loading your result…</p>
          <div className="inline-block w-6 h-6 border-4 border-gray-300 border-t-black rounded-full animate-spin mt-6" />
        </div>
      </div>
    )
  }

  const q = questions[current]
  const answeredCount = Object.keys(answers).filter((k) => answers[k]).length
  const usesCamera = proctoring?.usesCamera

  // ══════════════════════════════════════════════════════════════
  //  EXAM IN PROGRESS
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Hidden capture surface for snapshots */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Top bar */}
      <div className="bg-white shadow-sm px-4 md:px-6 py-3 flex items-center justify-between gap-4 flex-wrap sticky top-0 z-20">
        <div>
          <p className="font-semibold text-sm">{exam?.title}</p>
          <p className="text-xs text-gray-400">
            {answeredCount}/{questions.length} answered
          </p>
        </div>

        {tabSwitches > 0 && (
          <div className="bg-red-100 text-red-700 text-xs px-3 py-1.5 rounded-full font-bold">
            Warning: you left this window. One more and your exam is submitted.
          </div>
        )}

        {faceWarning && (
          <div className="bg-amber-100 text-amber-800 text-xs px-3 py-1.5 rounded-full font-bold">
            {faceWarning}
          </div>
        )}

        <div className={`font-mono text-xl font-bold ${
          timeLeft < 300 ? "text-red-600" : timeLeft < 600 ? "text-amber-500" : ""
        }`} style={timeLeft >= 600 ? { color: NAVY } : {}}>
          {formatTime(timeLeft)}
        </div>
      </div>

      {error && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm">{error}</div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Question */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow p-6">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: GOLD }}>
              {q?.sectionName}
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Question {current + 1} of {questions.length}
            </p>

            <p className="text-base font-medium mb-6 leading-relaxed">{q?.text}</p>

            <div className="space-y-3">
              {(q?.options || []).map((opt) => {
                const selected = answers[q.id] === opt.key
                return (
                  <div key={opt.id} onClick={() => selectAnswer(q.id, opt.key)}
                    style={selected ? { background: NAVY, borderColor: NAVY } : {}}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      selected ? "text-white" : "border-gray-200 hover:border-gray-400"
                    }`}>
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      selected ? "bg-white" : "bg-gray-100 text-gray-600"
                    }`} style={selected ? { color: NAVY } : {}}>
                      {opt.key}
                    </span>
                    <span className="text-sm">{opt.text}</span>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between mt-6 gap-2 flex-wrap">
              <div className="flex gap-2">
                <button onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                  disabled={current === 0}
                  className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40">
                  ← Prev
                </button>
                <button onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
                  disabled={current === questions.length - 1}
                  className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40">
                  Next →
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => {
                    toggleReview(q.id)
                    setCurrent((c) => Math.min(questions.length - 1, c + 1))
                  }}
                  className="px-4 py-2 text-sm bg-amber-100 text-amber-700 rounded-lg font-medium">
                  {reviewed[q.id] ? "✓ Marked" : "Mark review"}
                </button>
                <button
                  onClick={() => {
                    const unanswered = questions.length - answeredCount
                    if (confirm(
                      `Submit your examination?\n\n` +
                      `Answered: ${answeredCount} of ${questions.length}\n` +
                      (unanswered > 0 ? `Unanswered: ${unanswered}\n` : "") +
                      `\nYou cannot change your answers after submitting.`
                    )) doSubmit()
                  }}
                  disabled={submitting}
                  style={{ background: NAVY }}
                  className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50">
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Navigator */}
        <div className="bg-white rounded-2xl shadow p-4 h-fit lg:sticky lg:top-20">
          {/* Camera preview — the candidate can always see what is being
              watched. A hidden camera feed is a camera nobody trusts. */}
          {usesCamera && (
            <div className="mb-4">
              <div className="relative rounded-xl overflow-hidden bg-black">
                <video ref={videoRef} autoPlay playsInline muted
                  className="w-full h-auto" style={{ transform: "scaleX(-1)" }} />
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded-full">
                  <span className={`w-2 h-2 rounded-full ${cameraReady ? "bg-red-500 animate-pulse" : "bg-gray-400"}`} />
                  <span className="text-white text-[10px] font-medium">
                    {cameraReady ? "Monitoring" : "Camera off"}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 text-center">
                {proctoring?.mode === "FULL_RECORDING"
                  ? "Images are captured periodically"
                  : "No images are stored"}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-4 text-xs">
            {[[NAVY, "Current"], ["#16a34a", "Answered"], ["#fbbf24", "Review"], ["#e5e7eb", "Not visited"]]
              .map(([bg, label]) => (
                <div key={label} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm" style={{ background: bg }} />
                  <span className="text-gray-500">{label}</span>
                </div>
              ))}
          </div>

          {sections.map((section) => {
            const startIdx = questions.findIndex((x) => x.sectionId === section.id)
            const sectionQs = questions.filter((x) => x.sectionId === section.id)
            if (sectionQs.length === 0) return null
            return (
              <div key={section.id} className="mb-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">{section.name}</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {sectionQs.map((sq, i) => {
                    const idx = startIdx + i
                    const isCurrent = idx === current
                    const bg = isCurrent ? NAVY
                      : reviewed[sq.id] ? "#fbbf24"
                      : answers[sq.id] ? "#16a34a"
                      : "#e5e7eb"
                    const fg = isCurrent || reviewed[sq.id] || answers[sq.id] ? "#fff" : "#4b5563"
                    return (
                      <button key={sq.id} onClick={() => setCurrent(idx)}
                        style={{ background: bg, color: fg }}
                        className="aspect-square rounded-lg text-xs font-bold transition-all">
                        {idx + 1}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Exam