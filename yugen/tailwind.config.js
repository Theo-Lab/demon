/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
        'cinzel-deco': ['"Cinzel Decorative"', 'serif'],
        crimson: ['"Crimson Text"', 'serif'],
      },
    },
  },
  plugins: [],
}

