import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // ── Tenant Mobile UI design-system tokens ──────────────────────
        // Fully namespaced (bg-tenant-*, text-tenant-*, border-tenant-*)
        // and driven by CSS variables scoped to `.tenant-portal` — see
        // src/app/(tenant)/tenant-theme.css. This intentionally does not
        // touch `background` / `primary` / etc. above, which the Owner,
        // Admin and Auth screens already rely on.
        tenant: {
          bg: 'hsl(var(--tenant-background) / <alpha-value>)',
          'bg-subtle': 'hsl(var(--tenant-background-subtle) / <alpha-value>)',
          surface: 'hsl(var(--tenant-surface) / <alpha-value>)',
          'surface-elevated': 'hsl(var(--tenant-surface-elevated) / <alpha-value>)',
          'surface-hover': 'hsl(var(--tenant-surface-hover) / <alpha-value>)',
          border: 'hsl(var(--tenant-border) / <alpha-value>)',
          'border-strong': 'hsl(var(--tenant-border-strong) / <alpha-value>)',
          fg: 'hsl(var(--tenant-foreground) / <alpha-value>)',
          muted: 'hsl(var(--tenant-muted) / <alpha-value>)',
          'muted-subtle': 'hsl(var(--tenant-muted-subtle) / <alpha-value>)',
          primary: 'hsl(var(--tenant-primary) / <alpha-value>)',
          'primary-hover': 'hsl(var(--tenant-primary-hover) / <alpha-value>)',
          'primary-fg': 'hsl(var(--tenant-primary-foreground) / <alpha-value>)',
          success: 'hsl(var(--tenant-success) / <alpha-value>)',
          'success-subtle': 'hsl(var(--tenant-success-subtle) / <alpha-value>)',
          warning: 'hsl(var(--tenant-warning) / <alpha-value>)',
          'warning-subtle': 'hsl(var(--tenant-warning-subtle) / <alpha-value>)',
          danger: 'hsl(var(--tenant-danger) / <alpha-value>)',
          'danger-subtle': 'hsl(var(--tenant-danger-subtle) / <alpha-value>)',
          info: 'hsl(var(--tenant-info) / <alpha-value>)',
          'info-subtle': 'hsl(var(--tenant-info-subtle) / <alpha-value>)',
          purple: 'hsl(var(--tenant-accent-purple) / <alpha-value>)',
          'purple-subtle': 'hsl(var(--tenant-accent-purple-subtle) / <alpha-value>)',
          teal: 'hsl(var(--tenant-accent-teal) / <alpha-value>)',
          'teal-subtle': 'hsl(var(--tenant-accent-teal-subtle) / <alpha-value>)',
          ring: 'hsl(var(--tenant-ring) / <alpha-value>)',
        },
        // ── Owner Dashboard design-system tokens ───────────────────────
        // Namespaced (bg-owner-*, text-owner-*, border-owner-*), driven by
        // CSS variables scoped to `.owner-shell` — see
        // src/app/(owner)/owner-theme.css. Independent from both the
        // shadcn defaults (used by Admin/Auth) and the tenant-* tokens
        // (used only inside the Tenant Portal) — the three shells don't
        // share color state.
        owner: {
          bg: 'hsl(var(--owner-background) / <alpha-value>)',
          'bg-subtle': 'hsl(var(--owner-background-subtle) / <alpha-value>)',
          surface: 'hsl(var(--owner-surface) / <alpha-value>)',
          'surface-elevated': 'hsl(var(--owner-surface-elevated) / <alpha-value>)',
          'surface-hover': 'hsl(var(--owner-surface-hover) / <alpha-value>)',
          border: 'hsl(var(--owner-border) / <alpha-value>)',
          'border-strong': 'hsl(var(--owner-border-strong) / <alpha-value>)',
          fg: 'hsl(var(--owner-foreground) / <alpha-value>)',
          muted: 'hsl(var(--owner-muted) / <alpha-value>)',
          'muted-subtle': 'hsl(var(--owner-muted-subtle) / <alpha-value>)',
          primary: 'hsl(var(--owner-primary) / <alpha-value>)',
          'primary-hover': 'hsl(var(--owner-primary-hover) / <alpha-value>)',
          'primary-fg': 'hsl(var(--owner-primary-foreground) / <alpha-value>)',
          success: 'hsl(var(--owner-success) / <alpha-value>)',
          'success-subtle': 'hsl(var(--owner-success-subtle) / <alpha-value>)',
          warning: 'hsl(var(--owner-warning) / <alpha-value>)',
          'warning-subtle': 'hsl(var(--owner-warning-subtle) / <alpha-value>)',
          danger: 'hsl(var(--owner-danger) / <alpha-value>)',
          'danger-subtle': 'hsl(var(--owner-danger-subtle) / <alpha-value>)',
          info: 'hsl(var(--owner-info) / <alpha-value>)',
          'info-subtle': 'hsl(var(--owner-info-subtle) / <alpha-value>)',
          purple: 'hsl(var(--owner-accent-purple) / <alpha-value>)',
          'purple-subtle': 'hsl(var(--owner-accent-purple-subtle) / <alpha-value>)',
          teal: 'hsl(var(--owner-accent-teal) / <alpha-value>)',
          'teal-subtle': 'hsl(var(--owner-accent-teal-subtle) / <alpha-value>)',
          ring: 'hsl(var(--owner-ring) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // ── Tenant Mobile UI radius scale (namespaced so the Owner/Admin
        // dashboards, which use the default shadcn radius keys above, are
        // never affected) ──────────────────────────────────────────────
        'tenant-xs': '8px',
        'tenant-sm': '10px',
        'tenant-md': '12px',
        'tenant-lg': '16px',
        'tenant-xl': '20px',
        'tenant-2xl': '24px',
        'tenant-3xl': '28px',
        'tenant-full': '9999px',
        // ── Owner Dashboard radius scale — tighter than the tenant mobile
        // scale (desktop SaaS density, not native-app card sizing) ──────
        'owner-xs': '6px',
        'owner-sm': '8px',
        'owner-md': '10px',
        'owner-lg': '12px',
        'owner-xl': '16px',
        'owner-2xl': '20px',
        'owner-full': '9999px',
      },
      boxShadow: {
        'tenant-xs': '0 1px 2px 0 hsl(var(--tenant-shadow-color) / 0.25)',
        'tenant-sm': '0 2px 8px -2px hsl(var(--tenant-shadow-color) / 0.3)',
        'tenant-md': '0 6px 20px -6px hsl(var(--tenant-shadow-color) / 0.35)',
        'tenant-lg': '0 16px 40px -12px hsl(var(--tenant-shadow-color) / 0.45)',
        'tenant-glow': '0 8px 24px -6px hsl(var(--tenant-glow) / 0.5)',
        'tenant-glow-lg': '0 14px 36px -8px hsl(var(--tenant-glow) / 0.55)',
        'owner-xs': '0 1px 2px 0 hsl(var(--owner-shadow-color) / 0.2)',
        'owner-sm': '0 2px 6px -2px hsl(var(--owner-shadow-color) / 0.25)',
        'owner-md': '0 8px 24px -8px hsl(var(--owner-shadow-color) / 0.3)',
        'owner-lg': '0 20px 48px -16px hsl(var(--owner-shadow-color) / 0.4)',
        'owner-glow': '0 6px 20px -4px hsl(var(--owner-glow) / 0.4)',
      },
      fontFamily: {
        'tenant-display': ['var(--font-tenant-display)', 'Inter', 'sans-serif'],
        'owner-display': ['var(--font-owner-display)', 'Inter', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'tenant-fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'tenant-scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'tenant-sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'tenant-fade-in': 'tenant-fade-in 0.25s ease-out',
        'tenant-scale-in': 'tenant-scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        'tenant-sheet-up': 'tenant-sheet-up 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        // Owner Dashboard aliases — same motion curves as the tenant ones,
        // just named for this shell so component code reads clearly.
        'owner-fade-in': 'tenant-fade-in 0.25s ease-out',
        'owner-scale-in': 'tenant-scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        'owner-sheet-up': 'tenant-sheet-up 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
