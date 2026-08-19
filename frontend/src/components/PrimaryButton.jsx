function PrimaryButton({ text }) {
  return (
    <button className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-semibold transition">
      {text}
    </button>
  )
}

export default PrimaryButton