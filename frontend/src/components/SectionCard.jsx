function SectionCard({ title, questions }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-bold mb-4">
        {title}
      </h2>

      <p className="text-gray-600 mb-6">
        Total Questions: {questions}
      </p>

      <button className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold">
        Start Section
      </button>
    </div>
  )
}

export default SectionCard