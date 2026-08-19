// ═══════════════════════════════════════════════════════════════════
//  EMAIL TEMPLATES
//  Inline CSS only, and tables for layout — email clients strip <style>
//  blocks and ignore flexbox. Navy and gold to match the platform.
// ═══════════════════════════════════════════════════════════════════

const NAVY = "#0a1628"
const GOLD = "#c9a84c"

const shell = (heading, body) => `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px;">
    <div style="background: ${NAVY}; color: #ffffff; padding: 22px; border-radius: 12px 12px 0 0; text-align: center;">
      <div style="font-size: 11px; letter-spacing: 2px; color: ${GOLD}; text-transform: uppercase;">
        Excellence Youth Talent Search LLP
      </div>
      <h1 style="margin: 8px 0 0; font-size: 20px; font-weight: bold;">${heading}</h1>
    </div>
    <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 12px 12px;">
      ${body}
      <p style="font-size: 12px; color: #999999; margin-top: 28px; border-top: 1px solid #e5e5e5; padding-top: 14px;">
        Excellence Youth Talent Search LLP &middot; Kawardha, Chhattisgarh 491995<br/>
        priyanksha1803@gmail.com &middot; +91 79998 32476
      </p>
    </div>
  </div>
`

// ── Result published: score, rank, percentile ───────────────────────
const resultEmailTemplate = ({
  name, examTitle, score, totalQuestions, percentage, rank, percentile, timeTaken,
}) => {
  const minutes = Math.floor((timeTaken || 0) / 60)
  const seconds = (timeTaken || 0) % 60

  const cell = (label, value, colour) => `
    <td style="padding: 12px 6px; background: #ffffff; text-align: center; width: 25%;">
      <div style="font-size: 11px; color: #888888;">${label}</div>
      <div style="font-size: 19px; font-weight: bold; color: ${colour};">${value}</div>
    </td>`

  return shell("Your Result", `
    <p style="font-size: 15px; margin-top: 0;">Dear ${name},</p>
    <p style="font-size: 15px;">
      The results for <strong>${examTitle || "your examination"}</strong> have been published.
    </p>

    <table style="width: 100%; border-collapse: separate; border-spacing: 4px; margin: 20px 0;">
      <tr>
        ${cell("Score", `${score}/${totalQuestions}`, NAVY)}
        ${cell("Percentage", `${percentage}%`, "#16a34a")}
        ${cell("Rank", rank ? `#${rank}` : "&mdash;", "#9333ea")}
        ${cell("Percentile", percentile != null ? `${percentile}th` : "&mdash;", "#d97706")}
      </tr>
    </table>

    <p style="font-size: 14px; color: #555555;">
      Time taken: <strong>${minutes}m ${String(seconds).padStart(2, "0")}s</strong>
    </p>

    <p style="font-size: 14px; color: #555555; margin-top: 18px;">
      Sign in to your dashboard for the section-wise breakdown, the answer key where published,
      and a printable statement of result.
    </p>

    <p style="font-size: 13px; color: #777777; margin-top: 18px;">
      Rank is determined by score first, then by time taken. If you believe an answer has been
      marked incorrectly, reply to this email with the question number &mdash; every answer sheet
      is retained and can be re-checked.
    </p>
  `)
}

// ── Result release announcement (no score — a heads-up) ──────────────
const resultReleaseAnnouncementTemplate = ({ name, examTitle, releaseAt, answerKeyAt }) => shell(
  "Results Are Now Available",
  `
    <p style="font-size: 15px; margin-top: 0;">Dear ${name},</p>
    <p style="font-size: 15px;">
      The results for <strong>${examTitle}</strong> have been released${
        releaseAt ? ` as of ${new Date(releaseAt).toLocaleString("en-IN")}` : ""
      }.
    </p>
    <div style="background: #ffffff; border-left: 4px solid ${GOLD}; padding: 14px 16px; margin: 18px 0;">
      <p style="font-size: 14px; margin: 0; color: #333333;">
        Sign in to your dashboard to view your score, rank and percentile.
      </p>
    </div>
    ${answerKeyAt && new Date(answerKeyAt) > new Date()
      ? `<p style="font-size: 13px; color: #777777;">
           The answer key will be published separately on
           ${new Date(answerKeyAt).toLocaleString("en-IN")}, allowing time for any re-evaluation
           request to be handled first.
         </p>`
      : `<p style="font-size: 13px; color: #777777;">
           The answer key is available alongside your result.
         </p>`}
  `
)

// ── Submission acknowledgement (deliberately contains no score) ──────
const submissionEmailTemplate = ({ name, examTitle, submittedAt, questionsAnswered, totalQuestions, releaseAt }) => shell(
  "Examination Submitted",
  `
    <p style="font-size: 15px; margin-top: 0;">Dear ${name},</p>
    <p style="font-size: 15px;">
      Your examination <strong>${examTitle}</strong> was submitted successfully on
      ${new Date(submittedAt).toLocaleString("en-IN")}.
    </p>
    <div style="background: #ffffff; padding: 14px 16px; margin: 18px 0; text-align: center;">
      <div style="font-size: 11px; color: #888888;">QUESTIONS ATTEMPTED</div>
      <div style="font-size: 22px; font-weight: bold; color: ${NAVY};">
        ${questionsAnswered} / ${totalQuestions}
      </div>
    </div>
    <p style="font-size: 14px; color: #555555;">
      Your answers have been recorded. Results and the answer key will be published
      ${releaseAt
        ? `on <strong>${new Date(releaseAt).toLocaleString("en-IN")}</strong>`
        : "once announced by the examination office"}.
    </p>
    <p style="font-size: 13px; color: #777777; margin-top: 16px;">
      No score or answer key is available to any candidate before that date.
    </p>
  `
)

// ── Refund processed ────────────────────────────────────────────────
const refundEmailTemplate = ({ name, examTitle, amount, reason, transactionId }) => shell(
  "Refund Processed",
  `
    <p style="font-size: 15px; margin-top: 0;">Dear ${name},</p>
    <p style="font-size: 15px;">
      A refund of <strong>Rs. ${amount}</strong> has been processed for
      ${examTitle || "your examination registration"}.
    </p>
    <table style="width: 100%; border-collapse: collapse; margin: 18px 0; background: #ffffff;">
      <tr>
        <td style="padding: 10px 14px; font-size: 13px; color: #888888; border-bottom: 1px solid #eeeeee;">Amount</td>
        <td style="padding: 10px 14px; font-size: 13px; font-weight: bold; text-align: right; border-bottom: 1px solid #eeeeee;">Rs. ${amount}</td>
      </tr>
      ${reason ? `<tr>
        <td style="padding: 10px 14px; font-size: 13px; color: #888888; border-bottom: 1px solid #eeeeee;">Reason</td>
        <td style="padding: 10px 14px; font-size: 13px; text-align: right; border-bottom: 1px solid #eeeeee;">${reason}</td>
      </tr>` : ""}
      ${transactionId ? `<tr>
        <td style="padding: 10px 14px; font-size: 13px; color: #888888;">Original transaction</td>
        <td style="padding: 10px 14px; font-size: 12px; font-family: monospace; text-align: right;">${transactionId}</td>
      </tr>` : ""}
    </table>
    <p style="font-size: 14px; color: #555555;">
      The amount will appear in your account within 5 to 7 working days, depending on your bank.
    </p>
    <p style="font-size: 13px; color: #777777; margin-top: 16px;">
      Your examination access has been withdrawn along with the refund. If your examination is to
      be rescheduled, write to us and access will be restored to your existing account &mdash; you
      do not need to register again.
    </p>
  `
)

// ── Password reset OTP ──────────────────────────────────────────────
const otpEmailTemplate = ({ name, otp }) => shell(
  "Password Reset",
  `
    <p style="font-size: 15px; margin-top: 0;">Dear ${name},</p>
    <p style="font-size: 15px;">
      Use the code below to reset your password. It expires in 10 minutes.
    </p>
    <div style="background: #ffffff; padding: 20px; text-align: center; margin: 20px 0;">
      <span style="font-size: 30px; font-weight: bold; letter-spacing: 8px; color: ${NAVY};">${otp}</span>
    </div>
    <p style="font-size: 13px; color: #999999;">
      If you did not request this, no action is needed &mdash; your password has not changed.
      Do not share this code with anyone, including anyone claiming to be from EYTS.
    </p>
  `
)

// ── Generic notice, for announcements from the office ────────────────
const noticeEmailTemplate = ({ name, heading, message, actionLabel, actionUrl }) => shell(
  heading || "A Notice From EYTS",
  `
    <p style="font-size: 15px; margin-top: 0;">Dear ${name},</p>
    <div style="font-size: 15px; color: #333333;">${message}</div>
    ${actionLabel && actionUrl
      ? `<p style="margin: 22px 0;">
           <a href="${actionUrl}" style="background: ${NAVY}; color: #ffffff; padding: 11px 22px;
              text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: bold;
              display: inline-block;">${actionLabel}</a>
         </p>`
      : ""}
  `
)

module.exports = {
  resultEmailTemplate,
  resultReleaseAnnouncementTemplate,
  submissionEmailTemplate,
  refundEmailTemplate,
  otpEmailTemplate,
  noticeEmailTemplate,
}
