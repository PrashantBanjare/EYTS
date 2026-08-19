function InputField({ type, placeholder }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      className="border border-gray-300 p-4 rounded-lg outline-none focus:border-blue-500 w-full"
    />
  )
}

export default InputField