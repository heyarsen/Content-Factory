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
          DEFAULT: '#0F172A',
        },
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
          DEFAULT: '#6366F1',
        },
        success: {
          DEFAULT: '#16A34A',
        },
        error: {
          DEFAULT: '#DC2626',
        },
        warning: {
          DEFAULT: '#F59E0B',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F8FAFF',
        },
        background: {
          DEFAULT: '#F5F7FB',
          subtle: '#EEF2FF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        heading: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        floating: '0 35px 80px -40px rgba(15, 23, 42, 0.45)',
      },
    },
  },
  plugins: [],
}

