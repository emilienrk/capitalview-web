/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography'
import forms from '@tailwindcss/forms'

export default {
  darkMode: 'selector',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '2rem',
        lg: '4rem',
        xl: '5rem',
        '2xl': '6rem',
      },
    },
    extend: {
      colors: {
        // Values live in src/styles/theme.css so styles and palettes can swap them.
        // ── Brand ─────────────────────────────────
        primary: {
          DEFAULT: 'var(--cv-primary)',
          hover: 'var(--cv-primary-hover)',
          active: 'var(--cv-primary-active)',
          light: 'var(--cv-primary-light)',
          content: 'var(--cv-primary-content)',
        },
        secondary: {
          DEFAULT: 'var(--cv-secondary)',
          hover: 'var(--cv-secondary-hover)',
          light: 'var(--cv-secondary-light)',
          content: '#ffffff',
        },

        // ── Feedback ──────────────────────────────
        info: {
          DEFAULT: 'var(--cv-info)',
          light: 'var(--cv-info-light)',
          content: '#ffffff',
        },
        success: {
          DEFAULT: 'var(--cv-success)',
          light: 'var(--cv-success-light)',
          content: '#ffffff',
        },
        warning: {
          DEFAULT: 'var(--cv-warning)',
          light: 'var(--cv-warning-light)',
          content: '#ffffff',
        },
        danger: {
          DEFAULT: 'var(--cv-danger)',
          light: 'var(--cv-danger-light)',
          content: '#ffffff',
        },

        // ── Backgrounds ───────────────────────────
        background: {
          DEFAULT: 'var(--cv-background)',
          subtle: 'var(--cv-background-subtle)',
          dark: 'var(--cv-background-dark)',
          'dark-subtle': 'var(--cv-background-dark-subtle)',
        },

        // ── Surfaces (cards, panels, modals) ──────
        surface: {
          DEFAULT: 'var(--cv-surface)',
          hover: 'var(--cv-surface-hover)',
          border: 'var(--cv-surface-border)',
          active: 'var(--cv-surface-active)',
          dark: 'var(--cv-surface-dark)',
          'dark-hover': 'var(--cv-surface-dark-hover)',
          'dark-border': 'var(--cv-surface-dark-border)',
        },

        // ── Typography ────────────────────────────
        text: {
          main: 'var(--cv-text-main)',
          body: 'var(--cv-text-body)',
          muted: 'var(--cv-text-muted)',
          inverted: '#ffffff',
          'dark-main': 'var(--cv-text-dark-main)',
          'dark-body': 'var(--cv-text-dark-body)',
          'dark-muted': 'var(--cv-text-dark-muted)',
        },

        // ── Sidebar ───────────────────────────────
        sidebar: {
          DEFAULT: 'var(--cv-sidebar)',
          dark: 'var(--cv-sidebar-dark)',
          border: 'var(--cv-sidebar-border)',
          'dark-border': 'var(--cv-sidebar-dark-border)',
          active: 'var(--cv-sidebar-active)',
          'dark-active': 'var(--cv-sidebar-dark-active)',
        },
      },
      fontFamily: {
        sans: 'var(--cv-font-sans)',
        display: 'var(--cv-font-display)',
        mono: 'var(--cv-font-mono)',
      },
      borderRadius: {
        'primary': 'var(--cv-radius-primary)',
        'secondary': 'var(--cv-radius-secondary)',
        'card': 'var(--cv-radius-card)',
        'button': 'var(--cv-radius-button)',
        'input': 'var(--cv-radius-input)',
        'badge': 'var(--cv-radius-badge)',
        'sm': 'var(--cv-radius-sm)',
        'md': 'var(--cv-radius-md)',
        'lg': 'var(--cv-radius-lg)',
        'xl': 'var(--cv-radius-xl)',
        '2xl': 'var(--cv-radius-2xl)',
        '3xl': 'var(--cv-radius-3xl)',
        'full': '9999px',
      },
      boxShadow: {
        'sm': 'var(--cv-shadow-sm)',
        'DEFAULT': 'var(--cv-shadow)',
        'md': 'var(--cv-shadow-md)',
        'lg': 'var(--cv-shadow-lg)',
        'soft': 'var(--cv-shadow-soft)',
        'card': 'var(--cv-shadow-card)',
        'modal': 'var(--cv-shadow-modal)',
      },
      spacing: {
        'sidebar': '16rem',
      },
      transitionTimingFunction: {
        'out': 'var(--cv-ease-out)',
        'drawer': 'var(--cv-ease-drawer)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s var(--cv-ease-out)',
        'slide-up': 'slideUp 0.3s var(--cv-ease-out)',
        'slide-in-left': 'slideInLeft 0.3s var(--cv-ease-out)',
        'spin-slow': 'spin 1.5s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    typography,
    forms,
  ],
}
