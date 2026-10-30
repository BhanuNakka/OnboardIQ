/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 950: '#0b1b2b', 900: '#10273d', 800: '#17364f', 700: '#214b65' },
        teal: { 600: '#087f8c', 500: '#0d95a1', 50: '#e8f6f6' },
        ink: '#1b2b3a', muted: '#627385', line: '#e5ebf0', canvas: '#f4f7f9'
      },
      boxShadow: { soft: '0 10px 35px rgba(19, 43, 63, .07)' },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'] }
    }
  },
  plugins: []
};
