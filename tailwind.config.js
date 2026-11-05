/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: { DEFAULT: '#FBF6EE', 100: '#F6EEE1', 200: '#EFE3CF' },
        ink: { DEFAULT: '#1E1B18', soft: '#4A433C', mute: '#7A7067' },
        terracotta: { DEFAULT: '#C2593A', light: '#E07A55', dark: '#963F26', 50: '#FBEDE6' },
        saffron: { DEFAULT: '#E3A33B', light: '#F2C66E', 50: '#FDF4E2' },
        olive: { DEFAULT: '#5E7149', light: '#8DA46F', 50: '#EEF2E8' },
        azul: { DEFAULT: '#1F3A5F', light: '#3C6A9E', 50: '#E7EEF6' },
        rosa: { DEFAULT: '#D98C8C', 50: '#FAEDEC' },
      },
      fontFamily: {
        display: ['"Fraunces Variable"', 'Georgia', 'serif'],
        sans: ['"Inter Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(30,27,24,.04), 0 8px 24px -8px rgba(30,27,24,.12)',
        lift: '0 2px 4px rgba(30,27,24,.05), 0 18px 40px -12px rgba(30,27,24,.22)',
      },
      borderRadius: { '4xl': '2rem' },
    },
  },
  plugins: [],
};
