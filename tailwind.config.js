/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'focus': '#FF8C66', // Sunset Orange for focus mode
        'break': '#76C7C0', // Sage Green for break mode
        'background-light': '#F9F7F3', // Off-white/Cream
        'background-dark': '#1A1A1A', // Deep Charcoal
      },
      animation: {
        'breathe': 'breathe 8s ease-in-out infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.03)' },
        },
      },
    },
  },
  plugins: [],
}

