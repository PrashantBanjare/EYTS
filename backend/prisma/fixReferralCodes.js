const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

// Rewrites old EYTS-style codes to the readable NAME + NN format.
// Only touches employees whose code does not already match.
const run = async () => {
  const employees = await prisma.user.findMany({
    where: { role: "EMPLOYEE", referralCode: { not: null } },
    select: { id: true, name: true, employeeCode: true, referralCode: true },
    orderBy: { employeeCode: "asc" },
  })

  console.log(`Found ${employees.length} employee(s)\n`)

  for (const e of employees) {
    const letters = (e.name || "").replace(/[^a-zA-Z]/g, "").toUpperCase()
    const base = (letters.slice(0, 4) || "EYTS").padEnd(4, "X")

    if (new RegExp(`^${base}\\d{2}$`).test(e.referralCode)) {
      console.log(`${e.employeeCode}  ${e.referralCode}  already correct, skipped`)
      continue
    }

    let newCode = null
    for (let n = 1; n <= 99; n++) {
      const candidate = `${base}${String(n).padStart(2, "0")}`
      const [empClash, couponClash] = await Promise.all([
        prisma.user.findUnique({ where: { referralCode: candidate } }),
        prisma.coupon.findUnique({ where: { code: candidate } }),
      ])
      if (!empClash && !couponClash) { newCode = candidate; break }
    }

    if (!newCode) {
      console.log(`${e.employeeCode}  could not find a free code, skipped`)
      continue
    }

    // Any past payment that used the old code keeps its record intact —
    // Payment.couponCode is a plain string, not a foreign key. Historic
    // rows keep the old code, which is correct: that is what was used.
    await prisma.user.update({
      where: { id: e.id },
      data: { referralCode: newCode },
    })

    console.log(`${e.employeeCode}  ${e.referralCode}  ->  ${newCode}   (${e.name})`)
  }

  console.log("\nDone.")
  await prisma.$disconnect()
}

run().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})