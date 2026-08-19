const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function main() {
  console.log("Setting up exam...")

  // Create admin user
  const bcrypt = require("bcrypt")
  const admin = await prisma.user.upsert({
    where: { email: "admin@talentexam.com" },
    update: {},
    create: {
      name: "Admin User",
      fatherName: "Admin Father",
      motherName: "Admin Mother",
      qualification: "Post Graduate",
      institutionName: "TalentExam HQ",
      passingYear: "2020",
      occupation: "working",
      occupationField: "Administration",
      aadharNumber: "000000000000",
      address: "Gwalior, MP",
      gender: "Male",
      age: 35,
      email: "admin@talentexam.com",
      whatsappNumber: "9000000000",
      password: await bcrypt.hash("admin123", 10),
      role: "ADMIN"
    }
  })
  console.log("✅ Admin user created:", admin.email)

  // Create exam
  const exam = await prisma.exam.create({
    data: {
      title: "TalentExam National 2025",
      description: "Competitive exam covering Aptitude, Reasoning, English, GK and Technical",
      durationSeconds: 3600,
      totalMarks: 50,
      isEnabled: true,
      allowReattempt: false,
    }
  })
  console.log("✅ Exam created:", exam.id)

  // Create sections
  const sectionData = [
    { name: "Quantitative Aptitude", order: 1 },
    { name: "Reasoning",             order: 2 },
    { name: "English",               order: 3 },
    { name: "General Knowledge",     order: 4 },
    { name: "Technical",             order: 5 },
  ]

  const sections = {}
  for (const s of sectionData) {
    const sec = await prisma.section.create({ data: { ...s, examId: exam.id } })
    sections[s.name] = sec.id
    console.log(`✅ Section created: ${s.name} → ${sec.id}`)
  }

  // Questions
  const questions = [
    // ── Quantitative Aptitude ──
    { sectionId: sections["Quantitative Aptitude"], order:1, text:"If 3x + 5 = 20, what is the value of x?", explanation:"3x = 15, x = 5", options:[{key:"A",text:"3",isCorrect:false},{key:"B",text:"4",isCorrect:false},{key:"C",text:"5",isCorrect:true},{key:"D",text:"6",isCorrect:false}] },
    { sectionId: sections["Quantitative Aptitude"], order:2, text:"What is 15% of 200?", explanation:"15/100 × 200 = 30", options:[{key:"A",text:"25",isCorrect:false},{key:"B",text:"30",isCorrect:true},{key:"C",text:"35",isCorrect:false},{key:"D",text:"40",isCorrect:false}] },
    { sectionId: sections["Quantitative Aptitude"], order:3, text:"A train travels 360 km in 4 hours. What is its speed?", explanation:"Speed = 360/4 = 90 km/h", options:[{key:"A",text:"80 km/h",isCorrect:false},{key:"B",text:"90 km/h",isCorrect:true},{key:"C",text:"100 km/h",isCorrect:false},{key:"D",text:"120 km/h",isCorrect:false}] },
    { sectionId: sections["Quantitative Aptitude"], order:4, text:"What is the simple interest on ₹5000 at 8% per annum for 3 years?", explanation:"SI = 5000×8×3/100 = 1200", options:[{key:"A",text:"₹1000",isCorrect:false},{key:"B",text:"₹1100",isCorrect:false},{key:"C",text:"₹1200",isCorrect:true},{key:"D",text:"₹1500",isCorrect:false}] },
    { sectionId: sections["Quantitative Aptitude"], order:5, text:"The ratio of two numbers is 3:5. If their sum is 64, find the larger number.", explanation:"5/(3+5) × 64 = 40", options:[{key:"A",text:"24",isCorrect:false},{key:"B",text:"36",isCorrect:false},{key:"C",text:"40",isCorrect:true},{key:"D",text:"48",isCorrect:false}] },
    { sectionId: sections["Quantitative Aptitude"], order:6, text:"What is the area of a circle with radius 7 cm? (π = 22/7)", explanation:"Area = πr² = 154 cm²", options:[{key:"A",text:"144 cm²",isCorrect:false},{key:"B",text:"154 cm²",isCorrect:true},{key:"C",text:"164 cm²",isCorrect:false},{key:"D",text:"174 cm²",isCorrect:false}] },
    { sectionId: sections["Quantitative Aptitude"], order:7, text:"If a product is sold for ₹840 at 20% profit, what is the cost price?", explanation:"CP = 840/1.2 = 700", options:[{key:"A",text:"₹650",isCorrect:false},{key:"B",text:"₹700",isCorrect:true},{key:"C",text:"₹750",isCorrect:false},{key:"D",text:"₹800",isCorrect:false}] },
    { sectionId: sections["Quantitative Aptitude"], order:8, text:"Find the LCM of 12 and 18.", explanation:"LCM(12,18) = 36", options:[{key:"A",text:"24",isCorrect:false},{key:"B",text:"36",isCorrect:true},{key:"C",text:"48",isCorrect:false},{key:"D",text:"72",isCorrect:false}] },
    { sectionId: sections["Quantitative Aptitude"], order:9, text:"Two pipes fill a tank in 10 and 15 hours. How long to fill together?", explanation:"1/10 + 1/15 = 1/6, so 6 hours", options:[{key:"A",text:"5 hours",isCorrect:false},{key:"B",text:"6 hours",isCorrect:true},{key:"C",text:"7 hours",isCorrect:false},{key:"D",text:"8 hours",isCorrect:false}] },
    { sectionId: sections["Quantitative Aptitude"], order:10, text:"What is the square root of 1764?", explanation:"√1764 = 42", options:[{key:"A",text:"40",isCorrect:false},{key:"B",text:"41",isCorrect:false},{key:"C",text:"42",isCorrect:true},{key:"D",text:"43",isCorrect:false}] },

    // ── Reasoning ──
    { sectionId: sections["Reasoning"], order:1, text:"Complete the series: 2, 4, 8, 16, ?", explanation:"Each term doubles: 32", options:[{key:"A",text:"24",isCorrect:false},{key:"B",text:"28",isCorrect:false},{key:"C",text:"32",isCorrect:true},{key:"D",text:"36",isCorrect:false}] },
    { sectionId: sections["Reasoning"], order:2, text:"If CAT = 3120, then DOG = ?", explanation:"D=4,O=15,G=7 → 4×15×7=420", options:[{key:"A",text:"420",isCorrect:true},{key:"B",text:"400",isCorrect:false},{key:"C",text:"380",isCorrect:false},{key:"D",text:"360",isCorrect:false}] },
    { sectionId: sections["Reasoning"], order:3, text:"Find the odd one out: Apple, Mango, Potato, Banana", explanation:"Potato is a vegetable", options:[{key:"A",text:"Apple",isCorrect:false},{key:"B",text:"Mango",isCorrect:false},{key:"C",text:"Potato",isCorrect:true},{key:"D",text:"Banana",isCorrect:false}] },
    { sectionId: sections["Reasoning"], order:4, text:"If FOOD is coded as HQQF, how is GOOD coded?", explanation:"Each letter +2: IQQF", options:[{key:"A",text:"IQQF",isCorrect:true},{key:"B",text:"HQQF",isCorrect:false},{key:"C",text:"IQQE",isCorrect:false},{key:"D",text:"JQQF",isCorrect:false}] },
    { sectionId: sections["Reasoning"], order:5, text:"A is the brother of B. B is the sister of C. How is A related to C?", explanation:"A is the brother of C", options:[{key:"A",text:"Sister",isCorrect:false},{key:"B",text:"Brother",isCorrect:true},{key:"C",text:"Father",isCorrect:false},{key:"D",text:"Uncle",isCorrect:false}] },
    { sectionId: sections["Reasoning"], order:6, text:"Complete the series: 1, 4, 9, 16, 25, ?", explanation:"Perfect squares: 6² = 36", options:[{key:"A",text:"30",isCorrect:false},{key:"B",text:"35",isCorrect:false},{key:"C",text:"36",isCorrect:true},{key:"D",text:"49",isCorrect:false}] },
    { sectionId: sections["Reasoning"], order:7, text:"If South-East becomes North, what does North-West become?", explanation:"Rotating 135° clockwise: South", options:[{key:"A",text:"South",isCorrect:true},{key:"B",text:"East",isCorrect:false},{key:"C",text:"West",isCorrect:false},{key:"D",text:"North-East",isCorrect:false}] },
    { sectionId: sections["Reasoning"], order:8, text:"'His mother is the only daughter of my mother.' How is the woman related to the man?", explanation:"Only daughter of my mother = myself", options:[{key:"A",text:"Aunt",isCorrect:false},{key:"B",text:"Mother",isCorrect:true},{key:"C",text:"Sister",isCorrect:false},{key:"D",text:"Grandmother",isCorrect:false}] },
    { sectionId: sections["Reasoning"], order:9, text:"Find the missing number: 6, 11, 21, 36, 56, ?", explanation:"Differences: 5,10,15,20,25 → 81", options:[{key:"A",text:"76",isCorrect:false},{key:"B",text:"81",isCorrect:true},{key:"C",text:"86",isCorrect:false},{key:"D",text:"91",isCorrect:false}] },
    { sectionId: sections["Reasoning"], order:10, text:"In a row of 40 students, Ravi is 11th from the left. What is his position from the right?", explanation:"40 - 11 + 1 = 30", options:[{key:"A",text:"28th",isCorrect:false},{key:"B",text:"29th",isCorrect:false},{key:"C",text:"30th",isCorrect:true},{key:"D",text:"31st",isCorrect:false}] },

    // ── English ──
    { sectionId: sections["English"], order:1, text:"Choose the correct synonym of 'Benevolent':", options:[{key:"A",text:"Kind",isCorrect:true},{key:"B",text:"Cruel",isCorrect:false},{key:"C",text:"Angry",isCorrect:false},{key:"D",text:"Lazy",isCorrect:false}] },
    { sectionId: sections["English"], order:2, text:"Choose the correct antonym of 'Abundant':", options:[{key:"A",text:"Plentiful",isCorrect:false},{key:"B",text:"Scarce",isCorrect:true},{key:"C",text:"Ample",isCorrect:false},{key:"D",text:"Enough",isCorrect:false}] },
    { sectionId: sections["English"], order:3, text:"Fill in the blank: She ___ to the market yesterday.", options:[{key:"A",text:"go",isCorrect:false},{key:"B",text:"goes",isCorrect:false},{key:"C",text:"went",isCorrect:true},{key:"D",text:"going",isCorrect:false}] },
    { sectionId: sections["English"], order:4, text:"Which sentence is grammatically correct?", options:[{key:"A",text:"He don't know the answer.",isCorrect:false},{key:"B",text:"He doesn't knows the answer.",isCorrect:false},{key:"C",text:"He doesn't know the answer.",isCorrect:true},{key:"D",text:"He not know the answer.",isCorrect:false}] },
    { sectionId: sections["English"], order:5, text:"Choose the correct meaning of the idiom 'Bite the bullet':", options:[{key:"A",text:"To eat fast",isCorrect:false},{key:"B",text:"To endure a painful situation bravely",isCorrect:true},{key:"C",text:"To shoot someone",isCorrect:false},{key:"D",text:"To make a mistake",isCorrect:false}] },
    { sectionId: sections["English"], order:6, text:"Identify the part of speech: 'She sings beautifully.'", options:[{key:"A",text:"Adjective",isCorrect:false},{key:"B",text:"Noun",isCorrect:false},{key:"C",text:"Adverb",isCorrect:true},{key:"D",text:"Verb",isCorrect:false}] },
    { sectionId: sections["English"], order:7, text:"Choose the correctly spelled word:", options:[{key:"A",text:"Accomodation",isCorrect:false},{key:"B",text:"Accommodation",isCorrect:true},{key:"C",text:"Acommodation",isCorrect:false},{key:"D",text:"Acomodation",isCorrect:false}] },
    { sectionId: sections["English"], order:8, text:"Fill in the blank: Neither Ram nor his friends ___ going.", options:[{key:"A",text:"is",isCorrect:false},{key:"B",text:"are",isCorrect:true},{key:"C",text:"was",isCorrect:false},{key:"D",text:"were",isCorrect:false}] },
    { sectionId: sections["English"], order:9, text:"Choose the passive voice of: 'The teacher taught the students.'", options:[{key:"A",text:"The students were taught by the teacher.",isCorrect:true},{key:"B",text:"The students are taught by the teacher.",isCorrect:false},{key:"C",text:"The students have been taught by the teacher.",isCorrect:false},{key:"D",text:"The students was taught by the teacher.",isCorrect:false}] },
    { sectionId: sections["English"], order:10, text:"Choose the correct synonym of 'Eloquent':", options:[{key:"A",text:"Silent",isCorrect:false},{key:"B",text:"Fluent and persuasive",isCorrect:true},{key:"C",text:"Rude",isCorrect:false},{key:"D",text:"Confused",isCorrect:false}] },

    // ── General Knowledge ──
    { sectionId: sections["General Knowledge"], order:1, text:"Who is known as the Father of the Indian Constitution?", options:[{key:"A",text:"Mahatma Gandhi",isCorrect:false},{key:"B",text:"Jawaharlal Nehru",isCorrect:false},{key:"C",text:"B.R. Ambedkar",isCorrect:true},{key:"D",text:"Sardar Patel",isCorrect:false}] },
    { sectionId: sections["General Knowledge"], order:2, text:"Which planet is known as the Red Planet?", options:[{key:"A",text:"Venus",isCorrect:false},{key:"B",text:"Mars",isCorrect:true},{key:"C",text:"Jupiter",isCorrect:false},{key:"D",text:"Saturn",isCorrect:false}] },
    { sectionId: sections["General Knowledge"], order:3, text:"What is the capital of Australia?", options:[{key:"A",text:"Sydney",isCorrect:false},{key:"B",text:"Melbourne",isCorrect:false},{key:"C",text:"Canberra",isCorrect:true},{key:"D",text:"Brisbane",isCorrect:false}] },
    { sectionId: sections["General Knowledge"], order:4, text:"Which is the longest river in the world?", options:[{key:"A",text:"Amazon",isCorrect:false},{key:"B",text:"Nile",isCorrect:true},{key:"C",text:"Yangtze",isCorrect:false},{key:"D",text:"Mississippi",isCorrect:false}] },
    { sectionId: sections["General Knowledge"], order:5, text:"In which year did India gain independence?", options:[{key:"A",text:"1945",isCorrect:false},{key:"B",text:"1946",isCorrect:false},{key:"C",text:"1947",isCorrect:true},{key:"D",text:"1948",isCorrect:false}] },
    { sectionId: sections["General Knowledge"], order:6, text:"What is the chemical symbol for Gold?", options:[{key:"A",text:"Go",isCorrect:false},{key:"B",text:"Gd",isCorrect:false},{key:"C",text:"Au",isCorrect:true},{key:"D",text:"Ag",isCorrect:false}] },
    { sectionId: sections["General Knowledge"], order:7, text:"Who painted the Mona Lisa?", options:[{key:"A",text:"Michelangelo",isCorrect:false},{key:"B",text:"Raphael",isCorrect:false},{key:"C",text:"Leonardo da Vinci",isCorrect:true},{key:"D",text:"Picasso",isCorrect:false}] },
    { sectionId: sections["General Knowledge"], order:8, text:"Which is the smallest country in the world?", options:[{key:"A",text:"Monaco",isCorrect:false},{key:"B",text:"San Marino",isCorrect:false},{key:"C",text:"Vatican City",isCorrect:true},{key:"D",text:"Liechtenstein",isCorrect:false}] },
    { sectionId: sections["General Knowledge"], order:9, text:"What is the hardest natural substance on Earth?", options:[{key:"A",text:"Gold",isCorrect:false},{key:"B",text:"Iron",isCorrect:false},{key:"C",text:"Diamond",isCorrect:true},{key:"D",text:"Quartz",isCorrect:false}] },
    { sectionId: sections["General Knowledge"], order:10, text:"Which ocean is the largest in the world?", options:[{key:"A",text:"Atlantic",isCorrect:false},{key:"B",text:"Indian",isCorrect:false},{key:"C",text:"Pacific",isCorrect:true},{key:"D",text:"Arctic",isCorrect:false}] },

    // ── Technical ──
    { sectionId: sections["Technical"], order:1, text:"What does CPU stand for?", options:[{key:"A",text:"Central Processing Unit",isCorrect:true},{key:"B",text:"Computer Processing Unit",isCorrect:false},{key:"C",text:"Central Program Utility",isCorrect:false},{key:"D",text:"Core Processing Unit",isCorrect:false}] },
    { sectionId: sections["Technical"], order:2, text:"Which data structure follows LIFO order?", options:[{key:"A",text:"Queue",isCorrect:false},{key:"B",text:"Stack",isCorrect:true},{key:"C",text:"Array",isCorrect:false},{key:"D",text:"Linked List",isCorrect:false}] },
    { sectionId: sections["Technical"], order:3, text:"What is the time complexity of binary search?", options:[{key:"A",text:"O(n)",isCorrect:false},{key:"B",text:"O(n²)",isCorrect:false},{key:"C",text:"O(log n)",isCorrect:true},{key:"D",text:"O(1)",isCorrect:false}] },
    { sectionId: sections["Technical"], order:4, text:"Which protocol is used for secure web browsing?", options:[{key:"A",text:"HTTP",isCorrect:false},{key:"B",text:"FTP",isCorrect:false},{key:"C",text:"HTTPS",isCorrect:true},{key:"D",text:"SMTP",isCorrect:false}] },
    { sectionId: sections["Technical"], order:5, text:"What does SQL stand for?", options:[{key:"A",text:"Structured Query Language",isCorrect:true},{key:"B",text:"Simple Query Language",isCorrect:false},{key:"C",text:"Standard Query Logic",isCorrect:false},{key:"D",text:"System Query Language",isCorrect:false}] },
    { sectionId: sections["Technical"], order:6, text:"Which of the following is NOT an OOP concept?", options:[{key:"A",text:"Encapsulation",isCorrect:false},{key:"B",text:"Inheritance",isCorrect:false},{key:"C",text:"Compilation",isCorrect:true},{key:"D",text:"Polymorphism",isCorrect:false}] },
    { sectionId: sections["Technical"], order:7, text:"What is the output of 2**10 in Python?", options:[{key:"A",text:"512",isCorrect:false},{key:"B",text:"1024",isCorrect:true},{key:"C",text:"2048",isCorrect:false},{key:"D",text:"256",isCorrect:false}] },
    { sectionId: sections["Technical"], order:8, text:"Which layer of the OSI model does HTTP operate at?", options:[{key:"A",text:"Transport",isCorrect:false},{key:"B",text:"Network",isCorrect:false},{key:"C",text:"Application",isCorrect:true},{key:"D",text:"Session",isCorrect:false}] },
    { sectionId: sections["Technical"], order:9, text:"What does RAM stand for?", options:[{key:"A",text:"Read Access Memory",isCorrect:false},{key:"B",text:"Random Access Memory",isCorrect:true},{key:"C",text:"Run Access Memory",isCorrect:false},{key:"D",text:"Rapid Access Memory",isCorrect:false}] },
    { sectionId: sections["Technical"], order:10, text:"Which sorting algorithm has O(n log n) average time complexity?", options:[{key:"A",text:"Bubble Sort",isCorrect:false},{key:"B",text:"Selection Sort",isCorrect:false},{key:"C",text:"Merge Sort",isCorrect:true},{key:"D",text:"Insertion Sort",isCorrect:false}] },
  ]

  console.log("Seeding questions...")
  for (const q of questions) {
    await prisma.question.create({
      data: {
        sectionId: q.sectionId,
        text: q.text,
        order: q.order,
        explanation: q.explanation || null,
        options: { create: q.options }
      }
    })
  }

  console.log(`✅ ${questions.length} questions seeded successfully!`)
  console.log("\n🎉 Setup complete!")
  console.log(`Exam ID: ${exam.id}`)
  console.log("Admin: admin@talentexam.com / admin123")
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => await prisma.$disconnect())