/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#16202B',
        paper: '#F6F5F2',
        steel: '#4A5B6B',
        line: '#E2DFD8',
        brand: {
          DEFAULT: '#1F6F5C',
          dark: '#164F42',
          light: '#E7F0EC',
        },
        status: {
          pending: '#B8762E',
          pendingBg: '#F6ECDD',
          approved: '#3B7A57',
          approvedBg: '#E7F2EA',
          rejected: '#B84C3F',
          rejectedBg: '#F7E9E6',
        },
      },
      fontFamily: {
        sans: ['"Public Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        none: 'none',
      },
    },
  },
  plugins: [],
}
