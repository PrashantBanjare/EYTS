function ExamCard({ title, questions, duration, fee }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-bold mb-4">
        {title}
      </h2>

      <div className="space-y-3 text-gray-700">
        <p>
          <span className="font-semibold">Questions:</span> {questions}
        </p>

        <p>
          <span className="font-semibold">Duration:</span> {duration}
        </p>

        <p>
          <span className="font-semibold">Fee:</span> {fee}
        </p>
      </div>

      <button className="mt-6 w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold">
        Attempt Exam
      </button>
    </div>
  )
}

export default ExamCard