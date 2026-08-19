function Sidebar() {
  return (
    <div className="w-[260px] min-h-screen bg-black text-white p-6">
      <h1 className="text-3xl font-bold mb-10">
        TalentExam
      </h1>

      <div className="flex flex-col gap-5 text-lg">
        <button className="text-left hover:text-blue-400">
          Dashboard
        </button>

        <button className="text-left hover:text-blue-400">
          Exams
        </button>

        <button className="text-left hover:text-blue-400">
          Leaderboard
        </button>

        <button className="text-left hover:text-blue-400">
          Profile
        </button>

        <button className="text-left hover:text-blue-400">
          Results
        </button>
      </div>
    </div>
  )
}

export default Sidebar