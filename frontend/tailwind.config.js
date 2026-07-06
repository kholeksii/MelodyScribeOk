/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // «Цифровий нотний зошит»: warm paper tones, ink text, violet accent
      colors: {
        paper: {
          DEFAULT: '#FAF6EF', // app background
          dark: '#F3EDE2',    // panels / cards
        },
        ink: {
          DEFAULT: '#2B2A26', // primary text
          soft: '#6B675E',    // secondary text
        },
        accent: {
          DEFAULT: '#7C5CBF', // primary actions
          hover: '#6A4BAD',
        },
        valid: '#4C8C6A',
        warn: '#C98A2D',
        danger: '#B4533F',
        staff: '#3D3A33', // notation lines/glyphs on paper
      },
      fontFamily: {
        heading: ['"Fraunces Variable"', 'Georgia', 'serif'],
        sans: ['"Inter Variable"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
