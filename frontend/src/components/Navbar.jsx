function Navbar() {
  return (
    <nav className="w-full bg-black text-white px-8 py-4 flex items-center justify-between">
      <h1 className="text-2xl font-bold">
        TalentExam
      </h1>

      <div className="flex items-center gap-6 text-lg">
        <button className="hover:text-gray-300">
          Login
        </button>

        <button className="bg-blue-500 px-4 py-2 rounded-lg hover:bg-blue-600">
          Signup
        </button>
      </div>
    </nav>
  )
}

export default Navbar