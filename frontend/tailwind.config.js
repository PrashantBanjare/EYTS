/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff4ff',100: '#dbeafe',200: '#bfdbfe',300: '#93c5fd',400: '#60a5fa',500: '#3b82f6',600: '#2563eb',700: '#1d4ed8',800: '#1e40af',900: '#1e3a8a',
        },
        ink: {
          DEFAULT: "#0a0a0a", muted: "#6b7280", subtle: "#9ca3af"
        },
        surface:{
          DEFAULT: "#ffffff", muted: "#f1f3f5", soft: "#f7f4f6"
        },
        line: {
          DEFAULT: "#e6383b"
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui','sans-serif'],
      },
      borderRadius: { xl: "0.875rem", "2xl": "1.25rem"},
      boxShadow: {
        soft: "0 1px 3px rgba(16,24,40,0.06)",
        card: "0 12px 24px -8px rgba(16,24,40,0.12)",
        lift: "0 12px 40px -12px rgba(16,24,40,0.18)",
      },
      maxWidth: {
        container: "1200px",
      },
    },
  },
  plugins: [],
}