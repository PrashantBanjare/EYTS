function QuestionPalette() {
  const questions = Array.from({ length: 20 }, (_, index) => index + 1)

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-bold mb-6">
        Questions
      </h2>

      <div className="grid grid-cols-5 gap-4">
        {questions.map((question) => (
          <button
            key={question}
            className="w-12 h-12 rounded-lg bg-gray-200 hover:bg-blue-500 hover:text-white font-semibold"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  )
}

export default QuestionPalette