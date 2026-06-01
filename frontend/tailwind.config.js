/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        ring:       "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          light:      "hsl(158 50% 90%)",
          dark:       "hsl(158 64% 24%)",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* ── Custom palette ── */
        emerald: {
          50:  "hsl(158 60% 96%)",
          100: "hsl(158 55% 90%)",
          200: "hsl(158 50% 80%)",
          300: "hsl(158 48% 65%)",
          400: "hsl(158 52% 50%)",
          500: "hsl(158 64% 40%)",
          600: "hsl(158 64% 32%)",
          700: "hsl(158 64% 24%)",
          800: "hsl(158 64% 16%)",
          900: "hsl(158 64% 10%)",
        },
        gold: {
          50:  "hsl(43 85% 97%)",
          100: "hsl(43 85% 94%)",
          200: "hsl(43 80% 85%)",
          300: "hsl(43 78% 72%)",
          400: "hsl(43 82% 60%)",
          500: "hsl(43 85% 50%)",
          600: "hsl(38 80% 42%)",
          700: "hsl(35 75% 32%)",
        },
        cream: {
          50:  "hsl(40 40% 99%)",
          100: "hsl(40 30% 97%)",
          200: "hsl(40 25% 93%)",
          300: "hsl(40 22% 87%)",
          400: "hsl(40 18% 78%)",
          500: "hsl(40 15% 65%)",
        },
        forest: {
          900: "hsl(150 20% 8%)",
          800: "hsl(150 18% 14%)",
          700: "hsl(150 15% 22%)",
          600: "hsl(150 12% 32%)",
          500: "hsl(150 10% 44%)",
        },
      },
      borderRadius: {
        "4xl": "2rem",
        "3xl": "1.5rem",
        "2xl": "1rem",
        xl:    "0.75rem",
        lg:    "var(--radius)",
        md:    "calc(var(--radius) - 2px)",
        sm:    "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        xs:      "var(--shadow-xs)",
        sm:      "var(--shadow-sm)",
        md:      "var(--shadow-md)",
        lg:      "var(--shadow-lg)",
        glow:    "var(--shadow-glow)",
        "card":  "0 1px 3px 0 rgb(21 56 37 / 0.06), 0 1px 2px -1px rgb(21 56 37 / 0.04)",
        "card-hover": "0 4px 12px 0 rgb(21 56 37 / 0.10), 0 2px 4px -2px rgb(21 56 37 / 0.05)",
        "emerald-glow": "0 0 20px -4px hsl(158 64% 32% / 0.35)",
        "gold-glow":    "0 0 20px -4px hsl(43 85% 50% / 0.35)",
        "inset-sm":     "inset 0 1px 2px 0 rgb(21 56 37 / 0.05)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
        xs:    ["0.75rem",  { lineHeight: "1rem"     }],
        sm:    ["0.875rem", { lineHeight: "1.25rem"  }],
      },
      backgroundImage: {
        "gradient-emerald": "linear-gradient(135deg, hsl(158 64% 32%) 0%, hsl(158 55% 42%) 100%)",
        "gradient-gold":    "linear-gradient(135deg, hsl(43 85% 46%) 0%, hsl(43 90% 58%) 100%)",
        "gradient-cream":   "linear-gradient(135deg, hsl(40 30% 97%) 0%, hsl(40 25% 93%) 100%)",
        "gradient-forest":  "linear-gradient(135deg, hsl(158 64% 32%) 0%, hsl(150 50% 22%) 100%)",
        "noise":            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")",
      },
      animation: {
        "shimmer":    "shimmer 1.6s ease-in-out infinite",
        "ticker":     "ticker 28s linear infinite",
        "pulse-dot":  "pulse-dot 2s ease-in-out infinite",
        "count-up":   "count-up 0.4s ease-out both",
        "fade-in":    "fade-in 0.3s ease-out both",
        "slide-up":   "slide-up 0.35s ease-out both",
      },
      keyframes: {
        "fade-in":  {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)"   },
        },
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
      },
    },
  },
  plugins: [],
};
