export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Semantic theme tokens — backed by CSS variables
        canvas: 'var(--bg)',          // main background
        lift:   'var(--bg-elevated)', // cards, sidebars
        float:  'var(--bg-overlay)',  // inputs, tags, hover fills
        wire: {
          DEFAULT: 'var(--border)',
          dim:     'var(--border-subtle)',
        },
        ink: {
          DEFAULT: 'var(--text)',
          mid:     'var(--text-muted)',
          low:     'var(--text-faint)',
        },
        brand: {
          DEFAULT: 'var(--accent)',
          wash:    'var(--accent-subtle)',
        },
      },
    },
  },
  plugins: [],
}
