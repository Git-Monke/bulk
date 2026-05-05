/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        bulk: {
          "primary": "#059669",
          "primary-focus": "#047857",
          "primary-content": "#ffffff",
          "secondary": "#3b82f6",
          "secondary-focus": "#2563eb",
          "secondary-content": "#ffffff",
          "accent": "#d97706",
          "accent-focus": "#b45309",
          "accent-content": "#ffffff",
          "neutral": "#44403c",
          "neutral-focus": "#292524",
          "neutral-content": "#fafaf9",
          "base-100": "#ffffff",
          "base-200": "#f7f6f3",
          "base-300": "#f5f5f4",
          "base-content": "#1c1917",
          "info": "#3b82f6",
          "success": "#22c55e",
          "warning": "#f59e0b",
          "error": "#b91c1c",
        },
      },
    ],
  },
}