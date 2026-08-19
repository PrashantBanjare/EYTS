import PrimaryButton from "./PrimaryButton"

function Hero() {
  return (
    <section className="flex flex-col items-center justify-center text-center mt-28 px-6">
      <h1 className="text-6xl font-bold leading-tight max-w-4xl">
        Crack Competitive Exams With Real-Time Rankings
      </h1>

      <p className="text-gray-600 text-xl mt-6 max-w-2xl">
        Attempt timed exams, track performance, compete on leaderboard,
        and improve your ranking with TalentExam Platform.
      </p>

      <div className="flex gap-6 mt-10">
        <PrimaryButton text="Start Exam" />

        <button className="border border-black px-8 py-4 rounded-xl text-lg font-semibold hover:bg-black hover:text-white transition">
          View Leaderboard
        </button>
      </div>
    </section>
  )
}

export default Hero