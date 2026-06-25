/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        paper: '#FFFCF0',
        base: {
          50:  '#F2F0E5',
          100: '#F2F0E5',
          150: '#E6E4D9',
          200: '#DAD8CE',
          300: '#B7B5AC',
          500: '#575653',
          600: '#403E3C',
          700: '#343331',
          800: '#282726',
          900: '#1C1B1A',
          950: '#100F0F',
        },
        blue: {
          400: '#4385BE',
          600: '#205EA6',
        },
        red: {
          400: '#D14D41',
          600: '#AF3029',
        },
        orange: {
          400: '#DA702C',
          600: '#BC5215',
        },
        green: {
          400: '#879A39',
          600: '#66800B',
        },
      },
    },
  },
}
