function Modal({ title, message }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
      <div className="bg-white w-[400px] p-8 rounded-2xl shadow-lg">
        <h2 className="text-2xl font-bold mb-4">
          {title}
        </h2>

        <p className="text-gray-600 mb-8">
          {message}
        </p>

        <div className="flex justify-end">
          <button className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default Modal