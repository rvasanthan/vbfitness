/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Semantic color tokens using CSS variables
        bg: {
          primary: 'rgb(var(--raw-bg-primary) / <alpha-value>)',
          secondary: 'rgb(var(--raw-bg-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--raw-bg-tertiary) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--raw-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--raw-text-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--raw-text-tertiary) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--raw-border) / <alpha-value>)',
        },
        // Primary Accent
        accent: 'rgb(var(--raw-accent) / <alpha-value>)',
        
        // Semantic Status Colors
        success: 'rgb(var(--raw-success) / <alpha-value>)',
        'success-light': 'rgb(var(--raw-success-light) / <alpha-value>)',
        error: 'rgb(var(--raw-error) / <alpha-value>)',
        'error-light': 'rgb(var(--raw-error-light) / <alpha-value>)',
        warning: 'rgb(var(--raw-warning) / <alpha-value>)',
        'warning-light': 'rgb(var(--raw-warning-light) / <alpha-value>)',
        info: 'rgb(var(--raw-info) / <alpha-value>)',
        'info-light': 'rgb(var(--raw-info-light) / <alpha-value>)',
        
        // Team Colors
        team1: 'rgb(var(--raw-team1) / <alpha-value>)',
        'team1-light': 'rgb(var(--raw-team1-light) / <alpha-value>)',
        team2: 'rgb(var(--raw-team2) / <alpha-value>)',
        'team2-light': 'rgb(var(--raw-team2-light) / <alpha-value>)',
        
        // Status Colors
        in: 'rgb(var(--raw-in) / <alpha-value>)',
        'in-light': 'rgb(var(--raw-in-light) / <alpha-value>)',
        out: 'rgb(var(--raw-out) / <alpha-value>)',
        'out-light': 'rgb(var(--raw-out-light) / <alpha-value>)',
        waiting: 'rgb(var(--raw-waiting) / <alpha-value>)',
        'waiting-light': 'rgb(var(--raw-waiting-light) / <alpha-value>)',
        'waiting-brown': 'rgb(var(--raw-waiting-brown) / <alpha-value>)',
        coffee: 'rgb(var(--raw-coffee) / <alpha-value>)',
        'coffee-light': 'rgb(var(--raw-coffee-light) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      },
      borderRadius: {
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
      },
      transitionDuration: {
        150: '150ms',
        200: '200ms',
        250: '250ms',
      },
    },
  },
  plugins: [],
}

