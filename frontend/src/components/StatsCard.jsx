function StatsCard({ title, value, color }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow">
      <h2 className="text-xl font-semibold mb-3">
        {title}
      </h2>

      <p className={`text-4xl font-bold ${color}`}>
        {value}
      </p>
    </div>
  )
}

export default StatsCard