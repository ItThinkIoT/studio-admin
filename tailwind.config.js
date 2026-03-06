/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./*.js"
  ],
  theme: {
    extend: {
      colors: {
        // Technological Dark Theme with Emerald accents
        brand: {
          900: '#0f172a', // Deep dark background (slate-900)
          800: '#1e293b', // Card background (slate-800)
          700: '#334155',  // Border colors (slate-700)
          emerald: '#10b981', // Primary accent (emerald-500)
          emeraldHover: '#059669', // Hover accent (emerald-600)
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
