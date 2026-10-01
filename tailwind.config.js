/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        ink: {
          950: 'var(--ink-950)',
          900: 'var(--ink-900)',
          800: 'var(--ink-800)',
          700: 'var(--ink-700)',
        },
        paper: {
          DEFAULT: 'var(--paper)',
          dim: 'var(--paper-dim)',
        },
        'paper-ink': {
          DEFAULT: 'var(--paper-ink)',
          dim: 'var(--paper-ink-dim)',
        },
        brass: {
          300: 'var(--brass-300)',
          400: 'var(--brass-400)',
          500: 'var(--brass-500)',
          600: 'var(--brass-600)',
          ink: 'var(--brass-ink)',
        },
        rubric: {
          400: 'var(--rubric-400)',
          500: 'var(--rubric-500)',
          tint: 'var(--rubric-tint)',
        },
      },
      borderColor: {
        line: 'var(--ink-line)',
        'line-strong': 'var(--ink-line-strong)',
        'paper-line': 'var(--paper-line)',
      },
      fontFamily: {
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        mono: ['ui-monospace', '"Cascadia Code"', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      transitionTimingFunction: {
        'out-quart': 'var(--ease-out-quart)',
        'out-expo': 'var(--ease-out-expo)',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
      },
    },
  },
  plugins: [],
};
