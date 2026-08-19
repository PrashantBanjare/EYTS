const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

const SECTION_IDS = {
  quant:   "3d0ca2c5-3014-484b-974f-f964de40cfb3",
  reasoning: "24d74419-4304-4ed5-b288-8cbcd755f47e",
  english: "34cbcc7a-2c4a-459c-8250-49497d55ccf3",
  gk:      "0a71c4d2-c79b-4d00-a7f2-1f2537cb1659",
  tech:    "d6ae3528-bcc2-42be-9647-20efc2a99374",
}

const questions = [
  // ── Quantitative Aptitude (10) ──────────────────────────
  {
    sectionId: SECTION_IDS.quant, order: 1,
    text: "If 3x + 5 = 20, what is the value of x?",
    explanation: "3x = 15, x = 5",
    options: [
      { key: "A", text: "3", isCorrect: false },
      { key: "B", text: "4", isCorrect: false },
      { key: "C", text: "5", isCorrect: true },
      { key: "D", text: "6", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.quant, order: 2,
    text: "What is 15% of 200?",
    explanation: "15/100 × 200 = 30",
    options: [
      { key: "A", text: "25", isCorrect: false },
      { key: "B", text: "30", isCorrect: true },
      { key: "C", text: "35", isCorrect: false },
      { key: "D", text: "40", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.quant, order: 3,
    text: "A train travels 360 km in 4 hours. What is its speed?",
    explanation: "Speed = Distance/Time = 360/4 = 90 km/h",
    options: [
      { key: "A", text: "80 km/h", isCorrect: false },
      { key: "B", text: "90 km/h", isCorrect: true },
      { key: "C", text: "100 km/h", isCorrect: false },
      { key: "D", text: "120 km/h", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.quant, order: 4,
    text: "What is the simple interest on ₹5000 at 8% per annum for 3 years?",
    explanation: "SI = P×R×T/100 = 5000×8×3/100 = 1200",
    options: [
      { key: "A", text: "₹1000", isCorrect: false },
      { key: "B", text: "₹1100", isCorrect: false },
      { key: "C", text: "₹1200", isCorrect: true },
      { key: "D", text: "₹1500", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.quant, order: 5,
    text: "The ratio of two numbers is 3:5. If their sum is 64, find the larger number.",
    explanation: "5/(3+5) × 64 = 40",
    options: [
      { key: "A", text: "24", isCorrect: false },
      { key: "B", text: "36", isCorrect: false },
      { key: "C", text: "40", isCorrect: true },
      { key: "D", text: "48", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.quant, order: 6,
    text: "What is the area of a circle with radius 7 cm? (π = 22/7)",
    explanation: "Area = πr² = 22/7 × 49 = 154 cm²",
    options: [
      { key: "A", text: "144 cm²", isCorrect: false },
      { key: "B", text: "154 cm²", isCorrect: true },
      { key: "C", text: "164 cm²", isCorrect: false },
      { key: "D", text: "174 cm²", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.quant, order: 7,
    text: "If a product is sold for ₹840 at 20% profit, what is the cost price?",
    explanation: "CP = SP/1.2 = 840/1.2 = 700",
    options: [
      { key: "A", text: "₹650", isCorrect: false },
      { key: "B", text: "₹700", isCorrect: true },
      { key: "C", text: "₹750", isCorrect: false },
      { key: "D", text: "₹800", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.quant, order: 8,
    text: "Find the LCM of 12 and 18.",
    explanation: "LCM(12,18) = 36",
    options: [
      { key: "A", text: "24", isCorrect: false },
      { key: "B", text: "36", isCorrect: true },
      { key: "C", text: "48", isCorrect: false },
      { key: "D", text: "72", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.quant, order: 9,
    text: "Two pipes fill a tank in 10 and 15 hours. How long to fill together?",
    explanation: "1/10 + 1/15 = 5/30 = 1/6, so 6 hours",
    options: [
      { key: "A", text: "5 hours", isCorrect: false },
      { key: "B", text: "6 hours", isCorrect: true },
      { key: "C", text: "7 hours", isCorrect: false },
      { key: "D", text: "8 hours", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.quant, order: 10,
    text: "What is the square root of 1764?",
    explanation: "√1764 = 42",
    options: [
      { key: "A", text: "40", isCorrect: false },
      { key: "B", text: "41", isCorrect: false },
      { key: "C", text: "42", isCorrect: true },
      { key: "D", text: "43", isCorrect: false },
    ],
  },

  // ── Reasoning (10) ──────────────────────────────────────
  {
    sectionId: SECTION_IDS.reasoning, order: 1,
    text: "Complete the series: 2, 4, 8, 16, ?",
    explanation: "Each term doubles: 16×2 = 32",
    options: [
      { key: "A", text: "24", isCorrect: false },
      { key: "B", text: "28", isCorrect: false },
      { key: "C", text: "32", isCorrect: true },
      { key: "D", text: "36", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.reasoning, order: 2,
    text: "If CAT = 3120, then DOG = ?",
    explanation: "C=3,A=1,T=20 → 3×1×20=60. D=4,O=15,G=7 → 4×15×7=420",
    options: [
      { key: "A", text: "420", isCorrect: true },
      { key: "B", text: "400", isCorrect: false },
      { key: "C", text: "380", isCorrect: false },
      { key: "D", text: "360", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.reasoning, order: 3,
    text: "Find the odd one out: Apple, Mango, Potato, Banana",
    explanation: "Potato is a vegetable; others are fruits",
    options: [
      { key: "A", text: "Apple", isCorrect: false },
      { key: "B", text: "Mango", isCorrect: false },
      { key: "C", text: "Potato", isCorrect: true },
      { key: "D", text: "Banana", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.reasoning, order: 4,
    text: "If FOOD is coded as HQQF, how is GOOD coded?",
    explanation: "Each letter shifted +2: G→I, O→Q, O→Q, D→F = IQQF",
    options: [
      { key: "A", text: "IQQF", isCorrect: true },
      { key: "B", text: "HQQF", isCorrect: false },
      { key: "C", text: "IQQE", isCorrect: false },
      { key: "D", text: "JQQF", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.reasoning, order: 5,
    text: "A is the brother of B. B is the sister of C. How is A related to C?",
    explanation: "A is the brother of C",
    options: [
      { key: "A", text: "Sister", isCorrect: false },
      { key: "B", text: "Brother", isCorrect: true },
      { key: "C", text: "Father", isCorrect: false },
      { key: "D", text: "Uncle", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.reasoning, order: 6,
    text: "Complete the series: 1, 4, 9, 16, 25, ?",
    explanation: "Perfect squares: 6² = 36",
    options: [
      { key: "A", text: "30", isCorrect: false },
      { key: "B", text: "35", isCorrect: false },
      { key: "C", text: "36", isCorrect: true },
      { key: "D", text: "49", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.reasoning, order: 7,
    text: "If South-East becomes North, then what does North-West become?",
    explanation: "Rotating 135° clockwise: NW becomes South",
    options: [
      { key: "A", text: "South", isCorrect: true },
      { key: "B", text: "East", isCorrect: false },
      { key: "C", text: "West", isCorrect: false },
      { key: "D", text: "North-East", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.reasoning, order: 8,
    text: "Pointing to a man, a woman said 'His mother is the only daughter of my mother.' How is the woman related to the man?",
    explanation: "Only daughter of my mother = myself. So the man's mother is the woman herself.",
    options: [
      { key: "A", text: "Aunt", isCorrect: false },
      { key: "B", text: "Mother", isCorrect: true },
      { key: "C", text: "Sister", isCorrect: false },
      { key: "D", text: "Grandmother", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.reasoning, order: 9,
    text: "Find the missing number: 6, 11, 21, 36, 56, ?",
    explanation: "Differences: 5,10,15,20,25 → 56+25=81",
    options: [
      { key: "A", text: "76", isCorrect: false },
      { key: "B", text: "81", isCorrect: true },
      { key: "C", text: "86", isCorrect: false },
      { key: "D", text: "91", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.reasoning, order: 10,
    text: "In a row of 40 students, Ravi is 11th from the left. What is his position from the right?",
    explanation: "40 - 11 + 1 = 30",
    options: [
      { key: "A", text: "28th", isCorrect: false },
      { key: "B", text: "29th", isCorrect: false },
      { key: "C", text: "30th", isCorrect: true },
      { key: "D", text: "31st", isCorrect: false },
    ],
  },

  // ── English (10) ────────────────────────────────────────
  {
    sectionId: SECTION_IDS.english, order: 1,
    text: "Choose the correct synonym of 'Benevolent':",
    options: [
      { key: "A", text: "Kind", isCorrect: true },
      { key: "B", text: "Cruel", isCorrect: false },
      { key: "C", text: "Angry", isCorrect: false },
      { key: "D", text: "Lazy", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.english, order: 2,
    text: "Choose the correct antonym of 'Abundant':",
    options: [
      { key: "A", text: "Plentiful", isCorrect: false },
      { key: "B", text: "Scarce", isCorrect: true },
      { key: "C", text: "Ample", isCorrect: false },
      { key: "D", text: "Enough", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.english, order: 3,
    text: "Fill in the blank: She ___ to the market yesterday.",
    options: [
      { key: "A", text: "go", isCorrect: false },
      { key: "B", text: "goes", isCorrect: false },
      { key: "C", text: "went", isCorrect: true },
      { key: "D", text: "going", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.english, order: 4,
    text: "Which sentence is grammatically correct?",
    options: [
      { key: "A", text: "He don't know the answer.", isCorrect: false },
      { key: "B", text: "He doesn't knows the answer.", isCorrect: false },
      { key: "C", text: "He doesn't know the answer.", isCorrect: true },
      { key: "D", text: "He not know the answer.", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.english, order: 5,
    text: "Choose the correct meaning of the idiom 'Bite the bullet':",
    options: [
      { key: "A", text: "To eat fast", isCorrect: false },
      { key: "B", text: "To endure a painful situation bravely", isCorrect: true },
      { key: "C", text: "To shoot someone", isCorrect: false },
      { key: "D", text: "To make a mistake", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.english, order: 6,
    text: "Identify the part of speech of the underlined word: 'She sings beautifully.'",
    options: [
      { key: "A", text: "Adjective", isCorrect: false },
      { key: "B", text: "Noun", isCorrect: false },
      { key: "C", text: "Adverb", isCorrect: true },
      { key: "D", text: "Verb", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.english, order: 7,
    text: "Choose the correctly spelled word:",
    options: [
      { key: "A", text: "Accomodation", isCorrect: false },
      { key: "B", text: "Accommodation", isCorrect: true },
      { key: "C", text: "Acommodation", isCorrect: false },
      { key: "D", text: "Acomodation", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.english, order: 8,
    text: "Fill in the blank: Neither Ram nor his friends ___ going.",
    options: [
      { key: "A", text: "is", isCorrect: false },
      { key: "B", text: "are", isCorrect: true },
      { key: "C", text: "was", isCorrect: false },
      { key: "D", text: "were", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.english, order: 9,
    text: "Choose the passive voice of: 'The teacher taught the students.'",
    options: [
      { key: "A", text: "The students were taught by the teacher.", isCorrect: true },
      { key: "B", text: "The students are taught by the teacher.", isCorrect: false },
      { key: "C", text: "The students have been taught by the teacher.", isCorrect: false },
      { key: "D", text: "The students was taught by the teacher.", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.english, order: 10,
    text: "Choose the correct synonym of 'Eloquent':",
    options: [
      { key: "A", text: "Silent", isCorrect: false },
      { key: "B", text: "Fluent and persuasive", isCorrect: true },
      { key: "C", text: "Rude", isCorrect: false },
      { key: "D", text: "Confused", isCorrect: false },
    ],
  },

  // ── General Knowledge (10) ──────────────────────────────
  {
    sectionId: SECTION_IDS.gk, order: 1,
    text: "Who is known as the Father of the Indian Constitution?",
    options: [
      { key: "A", text: "Mahatma Gandhi", isCorrect: false },
      { key: "B", text: "Jawaharlal Nehru", isCorrect: false },
      { key: "C", text: "B.R. Ambedkar", isCorrect: true },
      { key: "D", text: "Sardar Patel", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.gk, order: 2,
    text: "Which planet is known as the Red Planet?",
    options: [
      { key: "A", text: "Venus", isCorrect: false },
      { key: "B", text: "Mars", isCorrect: true },
      { key: "C", text: "Jupiter", isCorrect: false },
      { key: "D", text: "Saturn", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.gk, order: 3,
    text: "What is the capital of Australia?",
    options: [
      { key: "A", text: "Sydney", isCorrect: false },
      { key: "B", text: "Melbourne", isCorrect: false },
      { key: "C", text: "Canberra", isCorrect: true },
      { key: "D", text: "Brisbane", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.gk, order: 4,
    text: "Which is the longest river in the world?",
    options: [
      { key: "A", text: "Amazon", isCorrect: false },
      { key: "B", text: "Nile", isCorrect: true },
      { key: "C", text: "Yangtze", isCorrect: false },
      { key: "D", text: "Mississippi", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.gk, order: 5,
    text: "In which year did India gain independence?",
    options: [
      { key: "A", text: "1945", isCorrect: false },
      { key: "B", text: "1946", isCorrect: false },
      { key: "C", text: "1947", isCorrect: true },
      { key: "D", text: "1948", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.gk, order: 6,
    text: "What is the chemical symbol for Gold?",
    options: [
      { key: "A", text: "Go", isCorrect: false },
      { key: "B", text: "Gd", isCorrect: false },
      { key: "C", text: "Au", isCorrect: true },
      { key: "D", text: "Ag", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.gk, order: 7,
    text: "Who painted the Mona Lisa?",
    options: [
      { key: "A", text: "Michelangelo", isCorrect: false },
      { key: "B", text: "Raphael", isCorrect: false },
      { key: "C", text: "Leonardo da Vinci", isCorrect: true },
      { key: "D", text: "Picasso", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.gk, order: 8,
    text: "Which is the smallest country in the world?",
    options: [
      { key: "A", text: "Monaco", isCorrect: false },
      { key: "B", text: "San Marino", isCorrect: false },
      { key: "C", text: "Vatican City", isCorrect: true },
      { key: "D", text: "Liechtenstein", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.gk, order: 9,
    text: "What is the hardest natural substance on Earth?",
    options: [
      { key: "A", text: "Gold", isCorrect: false },
      { key: "B", text: "Iron", isCorrect: false },
      { key: "C", text: "Diamond", isCorrect: true },
      { key: "D", text: "Quartz", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.gk, order: 10,
    text: "Which ocean is the largest in the world?",
    options: [
      { key: "A", text: "Atlantic", isCorrect: false },
      { key: "B", text: "Indian", isCorrect: false },
      { key: "C", text: "Pacific", isCorrect: true },
      { key: "D", text: "Arctic", isCorrect: false },
    ],
  },

  // ── Technical (10) ──────────────────────────────────────
  {
    sectionId: SECTION_IDS.tech, order: 1,
    text: "What does CPU stand for?",
    options: [
      { key: "A", text: "Central Processing Unit", isCorrect: true },
      { key: "B", text: "Computer Processing Unit", isCorrect: false },
      { key: "C", text: "Central Program Utility", isCorrect: false },
      { key: "D", text: "Core Processing Unit", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.tech, order: 2,
    text: "Which data structure follows LIFO order?",
    options: [
      { key: "A", text: "Queue", isCorrect: false },
      { key: "B", text: "Stack", isCorrect: true },
      { key: "C", text: "Array", isCorrect: false },
      { key: "D", text: "Linked List", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.tech, order: 3,
    text: "What is the time complexity of binary search?",
    options: [
      { key: "A", text: "O(n)", isCorrect: false },
      { key: "B", text: "O(n²)", isCorrect: false },
      { key: "C", text: "O(log n)", isCorrect: true },
      { key: "D", text: "O(1)", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.tech, order: 4,
    text: "Which protocol is used for secure web browsing?",
    options: [
      { key: "A", text: "HTTP", isCorrect: false },
      { key: "B", text: "FTP", isCorrect: false },
      { key: "C", text: "HTTPS", isCorrect: true },
      { key: "D", text: "SMTP", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.tech, order: 5,
    text: "What does SQL stand for?",
    options: [
      { key: "A", text: "Structured Query Language", isCorrect: true },
      { key: "B", text: "Simple Query Language", isCorrect: false },
      { key: "C", text: "Standard Query Logic", isCorrect: false },
      { key: "D", text: "System Query Language", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.tech, order: 6,
    text: "Which of the following is NOT an OOP concept?",
    options: [
      { key: "A", text: "Encapsulation", isCorrect: false },
      { key: "B", text: "Inheritance", isCorrect: false },
      { key: "C", text: "Compilation", isCorrect: true },
      { key: "D", text: "Polymorphism", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.tech, order: 7,
    text: "What is the output of 2**10 in Python?",
    options: [
      { key: "A", text: "512", isCorrect: false },
      { key: "B", text: "1024", isCorrect: true },
      { key: "C", text: "2048", isCorrect: false },
      { key: "D", text: "256", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.tech, order: 8,
    text: "Which layer of the OSI model does HTTP operate at?",
    options: [
      { key: "A", text: "Transport", isCorrect: false },
      { key: "B", text: "Network", isCorrect: false },
      { key: "C", text: "Application", isCorrect: true },
      { key: "D", text: "Session", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.tech, order: 9,
    text: "What does RAM stand for?",
    options: [
      { key: "A", text: "Read Access Memory", isCorrect: false },
      { key: "B", text: "Random Access Memory", isCorrect: true },
      { key: "C", text: "Run Access Memory", isCorrect: false },
      { key: "D", text: "Rapid Access Memory", isCorrect: false },
    ],
  },
  {
    sectionId: SECTION_IDS.tech, order: 10,
    text: "Which sorting algorithm has O(n log n) average time complexity?",
    options: [
      { key: "A", text: "Bubble Sort", isCorrect: false },
      { key: "B", text: "Selection Sort", isCorrect: false },
      { key: "C", text: "Merge Sort", isCorrect: true },
      { key: "D", text: "Insertion Sort", isCorrect: false },
    ],
  },
]

async function main() {
  console.log("Seeding questions...")

  for (const q of questions) {
    await prisma.question.create({
      data: {
        sectionId: q.sectionId,
        text: q.text,
        order: q.order,
        explanation: q.explanation || null,
        options: {
          create: q.options,
        },
      },
    })
  }

  console.log(`✅ ${questions.length} questions seeded successfully!`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })