/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070b09',
          900: '#0b110e',
          850: '#0f1713',
          800: '#131d18',
          700: '#1c2a23',
          600: '#2a3b32',
          500: '#4a5d53',
          400: '#7d9187',
          300: '#a9b9b0',
          200: '#d3ddd7',
          100: '#eef3f0',
        },
        volt: {
          300: '#d9f99d',
          400: '#bef264',
          500: '#a3e635',
          600: '#84cc16',
        },
        leaf: {
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        amp: {
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
        },
        danger: {
          400: '#f87171',
          500: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(163,230,53,.25), 0 8px 30px -8px rgba(163,230,53,.35)',
      },
      keyframes: {
        pulseDot: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
        flow: { to: { strokeDashoffset: '-24' } },
        fadeUp: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
      },
      animation: {
        pulseDot: 'pulseDot 1.6s ease-in-out infinite',
        flow: 'flow 1.2s linear infinite',
        fadeUp: 'fadeUp .35s ease-out both',
      },
    },
  },
  plugins: [],
};
