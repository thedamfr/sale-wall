/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./server/**/*.pug"],
  theme: {
    extend: {
      colors: {
        cream: 'rgba(245, 230, 196, 1)', // Ancienne couleur, gardée pour compatibilité
        'noir-charbon': '#0B0B0B',
        'ivoire-sale': '#F2F2EF', 
        'or-kintsugi': '#D6B977',
        'or-kintsugi-hover': '#B99E5A',
        'wafer-start': '#E6D4A6',
        'wafer-middle': '#F2E8C8',
        'wafer-end': '#E6D4A6',
      },
      fontFamily: {
        'serif': ['Playfair Display', 'serif'],
        'sans': ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

