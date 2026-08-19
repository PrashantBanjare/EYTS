require("dotenv").config()
const { sendEmail } = require("./utils/emailService")

sendEmail({
  to: process.env.EMAIL_USER, // sending to yourself for testing
  subject: "TalentExam — Test Email",
  html: "<h2>It works!</h2><p>Your Nodemailer setup is configured correctly.</p>"
}).then((success) => {
  console.log(success ? "✅ Email sent successfully" : "❌ Email failed")
  process.exit()
})