/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgMain:    '#FCF3E4',
        cardBg:    '#FFFFFF',
        maroon: {
          DEFAULT: '#D6402E', // Rooster Red
          dark: '#141414', // Signature Black
        },
        textMain:  '#111111',
        textMuted: '#6B7280',
        borderLight: '#E7B6AC', // Soft Rose
        // Storefront palette — used throughout Navbar/Footer/Cart/Checkout/
        // Login/Products/Profile/Favorites/Drawers but never previously
        // defined here, so every bg-sage/text-sageDark/border-sand/etc.
        // class in those files was silently rendering with no color at all.
        forestDark: '#2B1108',
        sage:       '#C8523D',
        sageDark:   '#8C2A1E',
        sageDeep:   '#5C1710',
        sand:       '#EFE1C8',
      },
      fontFamily: {
        sans:      ['Inter', 'sans-serif'],
        headline:  ['Inter', 'sans-serif'],
      },
      boxShadow: {
        soft:   '0 1px 3px rgba(0,0,0,0.05)',
      },
      borderRadius: {
        'card': '12px',
        'btn': '10px',
        'input': '10px',
        'table': '12px',
      },
      animation: {
        'float': 'float 4s ease-in-out infinite',
        'floatDelay': 'float 4s ease-in-out 1.5s infinite',
        'slideUp': 'slideUp 0.6s ease forwards',
        'fadeIn': 'fadeIn 0.5s ease forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
