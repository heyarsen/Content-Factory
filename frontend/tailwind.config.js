/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#111827', // Gray-900
        },
        accent: {
          DEFAULT: '#9333EA', // Purple-600
        },
        success: {
          DEFAULT: '#16A34A', // Green-600
        },
        error: {
          DEFAULT: '#DC2626', // Red-600
        },
        background: {
          DEFAULT: '#F9FAFB', // Gray-50
        },
      },
    },
  },
  plugins: [],
}

