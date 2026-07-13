/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // «Цифровий нотний зошит»: warm paper tones, ink text, violet accent.
      // Themed colors are CSS variables (see index.css) so dark mode flips
      // every component without dark: classes. Fixed colors stay hex.
      colors: {
        paper: {
          DEFAULT: 'rgb(var(--c-paper) / <alpha-value>)',      // app background
          dark: 'rgb(var(--c-paper-dark) / <alpha-value>)',    // panels / bars
        },
        ink: {
          DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)',        // primary text
          soft: 'rgb(var(--c-ink-soft) / <alpha-value>)',      // secondary text
        },
        surface: 'rgb(var(--c-surface) / <alpha-value>)',      // cards / inputs
        // The music sheet: near-white in light mode, tinted "lit page" in dark
        // (never pure white on a dark background) — PDF export forces #FFFFFF.
        sheet: 'rgb(var(--c-sheet) / <alpha-value>)',
        accent: {
          DEFAULT: '#7C5CBF', // primary actions
          hover: '#6A4BAD',
        },
        valid: '#4C8C6A',
        warn: '#C98A2D',
        danger: '#B4533F',
        staff: '#3D3A33', // notation lines/glyphs on the sheet
      },
      fontFamily: {
        heading: ['"Fraunces Variable"', 'Georgia', 'serif'],
        sans: ['"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease',
      },
    },
  },
  plugins: [],
}
