/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        nexus: {
          900: '#064e3b',
          800: '#065f46',
          500: '#10b981',
          400: '#34d399',
          accent: '#f59e0b',
        }
      }
    },
  },
  plugins: [],
}
