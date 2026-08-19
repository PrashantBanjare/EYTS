function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-100 p-10">
      <h1 className="text-4xl font-bold mb-10">
        Admin Dashboard
      </h1>

      <div className="grid grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-lg font-semibold mb-2">
            Total Students
          </h2>

          <p className="text-4xl font-bold text-blue-500">
            1200
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-lg font-semibold mb-2">
            Exams Conducted
          </h2>

          <p className="text-4xl font-bold text-green-500">
            15
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-lg font-semibold mb-2">
            Revenue
          </h2>

          <p className="text-4xl font-bold text-purple-500">
            ₹2.5L
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-lg font-semibold mb-2">
            Active Exams
          </h2>

          <p className="text-4xl font-bold text-red-500">
            3
          </p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow">
        <h2 className="text-2xl font-semibold mb-6">
          Recent Exam Activity
        </h2>

        <div className="space-y-4">
          <div className="border p-4 rounded-xl">
            Student Rahul completed Mock Test 1
          </div>

          <div className="border p-4 rounded-xl">
            Payment received from Aman
          </div>

          <div className="border p-4 rounded-xl">
            New exam published by admin
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard