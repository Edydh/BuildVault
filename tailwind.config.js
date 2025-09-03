/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0B0F14',
        surface: '#101826',
        border: '#1F2A37',
        primary: '#FF7A1A',
        blueprint: '#2E77FF',
        text: { primary: '#F8FAFC', secondary: '#94A3B8' },
        success: '#16B774',
        warning: '#F59E0B',
        error: '#E44F4F'
      },
      boxShadow: {
        glass: '0 10px 30px rgba(0,0,0,0.35)'
      },
      borderRadius: {
        '2xl': '1rem'
      }
    }
  },
  plugins: []
};

