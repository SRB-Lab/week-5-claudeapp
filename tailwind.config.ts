import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        an: {
          'bg-base':      'var(--an-bg-base)',
          'bg-subtle':    'var(--an-bg-subtle)',
          'bg-surface':   'var(--an-bg-surface)',
          'bg-elevated':  'var(--an-bg-elevated)',
          'border':       'var(--an-border-base)',
          'border-strong':'var(--an-border-strong)',
          'fg-base':      'var(--an-fg-base)',
          'fg-subtle':    'var(--an-fg-subtle)',
          'fg-muted':     'var(--an-fg-muted)',
          'fg-inverted':  'var(--an-fg-inverted)',
          'accent':       'var(--an-accent)',
          'accent-hover': 'var(--an-accent-hover)',
          'accent-subtle':'var(--an-accent-subtle)',
          'success':      'var(--an-success)',
          'warning':      'var(--an-warning)',
          'error':        'var(--an-error)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Lora', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
