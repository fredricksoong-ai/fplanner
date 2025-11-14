/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'fpl-purple': '#37003c',
        'fpl-accent': '#00ff88',
      },
    },
  },
  plugins: [],
}