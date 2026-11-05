/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // City-themed tokens (values set at runtime by applyCityTheme). Names are historical:
        // terracotta = primary, saffron = secondary, olive = tertiary, azul = deep, rosa = rose, cream = background.
        cream: { DEFAULT: 'rgb(var(--c-bg) / <alpha-value>)', 100: 'rgb(var(--c-bg-100) / <alpha-value>)', 200: 'rgb(var(--c-bg-200) / <alpha-value>)', warm: 'rgb(var(--c-bg-warm) / <alpha-value>)' },
        ink: { DEFAULT: '#1E1B18', soft: '#4A433C', mute: '#71675E' },
        terracotta: { DEFAULT: 'rgb(var(--c-primary) / <alpha-value>)', light: 'rgb(var(--c-primary-light) / <alpha-value>)', dark: 'rgb(var(--c-primary-dark) / <alpha-value>)', 50: 'rgb(var(--c-primary-50) / <alpha-value>)' },
        saffron: { DEFAULT: 'rgb(var(--c-secondary) / <alpha-value>)', light: 'rgb(var(--c-secondary-light) / <alpha-value>)', 50: 'rgb(var(--c-secondary-50) / <alpha-value>)' },
        olive: { DEFAULT: 'rgb(var(--c-tertiary) / <alpha-value>)', light: 'rgb(var(--c-tertiary-light) / <alpha-value>)', 50: 'rgb(var(--c-tertiary-50) / <alpha-value>)' },
        azul: { DEFAULT: 'rgb(var(--c-deep) / <alpha-value>)', light: 'rgb(var(--c-deep-light) / <alpha-value>)', 50: 'rgb(var(--c-deep-50) / <alpha-value>)' },
        rosa: { DEFAULT: 'rgb(var(--c-rose) / <alpha-value>)', 50: 'rgb(var(--c-rose-50) / <alpha-value>)' },
      },
      fontFamily: {
        display: ['"Fraunces Variable"', 'Georgia', 'serif'],
        sans: ['"Inter Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(30,27,24,.04), 0 8px 24px -8px rgba(30,27,24,.12)',
        lift: '0 2px 4px rgba(30,27,24,.05), 0 18px 40px -12px rgba(30,27,24,.22)',
        glow: '0 10px 30px -8px rgb(var(--c-primary) / .55)',
        pop: '0 6px 0 0 rgb(var(--c-primary-dark))',
      },
      borderRadius: { '4xl': '2rem' },
    },
  },
  plugins: [],
};
