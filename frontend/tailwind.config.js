/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          light: '#FAF8F5', // paperback background light
          dark: '#F5F1EA',  // active nav pills / secondary light background
        },
        ink: {
          light: '#F4F0EB', // text for dark mode
          dark: '#1A1A1A',  // text for light mode
        },
        accent: {
          warm: '#E05A47',  // warm orange/red highlight
          hover: '#C94B39',
        },
        slate: {
          muted: '#64748B', // secondary gray text
          mutedDark: '#94A3B8',
        },
        darkbg: {
          main: '#121417',  // main dark background
          card: '#1D2127',  // card/panel dark background
          pill: '#2D333D',  // active nav pills dark background
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Outfit"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderWidth: {
        'fine': '1px',
      },
      borderColor: {
        'fine-light': 'rgba(0, 0, 0, 0.06)',
        'fine-dark': 'rgba(255, 255, 255, 0.06)',
      }
    },
  },
  plugins: [],
}
