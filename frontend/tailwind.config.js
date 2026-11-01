/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        page: token('page'),
        surface: token('surface'),
        line: token('line'),
        ink: token('ink'),
        muted: token('muted'),
        accent: { DEFAULT: token('accent'), hover: token('accent-hover'), ink: token('accent-ink') },
        tint: token('tint'),
        warn: { DEFAULT: token('warn'), tint: token('warn-tint') },
        info: { DEFAULT: token('info'), tint: token('info-tint') },
        danger: { DEFAULT: token('danger'), tint: token('danger-tint') },
        air: { DEFAULT: token('air'), tint: token('air-tint') },
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'] },
    },
  },
  plugins: [],
};
