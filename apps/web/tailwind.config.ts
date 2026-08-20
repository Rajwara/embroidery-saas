import type { Config } from "tailwindcss";

// shadcn's CLI writes CSS variables into globals.css assuming Tailwind v4's
// config-less @theme block, which this project (still on Tailwind v3) has no
// equivalent for -- these mappings are what make classes like bg-background/
// border-border/text-foreground resolve, matching the standard "shadcn on
// Tailwind v3" config shape.
const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Every CSS variable is bare oklch channels (L C H, no wrapper) --
        // wrapping it here with <alpha-value> is what lets Tailwind's
        // opacity modifiers (bg-primary/80, text-destructive/20, ...) work,
        // which shadcn's own generated component source uses extensively.
        background: "oklch(var(--background) / <alpha-value>)",
        foreground: "oklch(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "oklch(var(--card) / <alpha-value>)",
          foreground: "oklch(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "oklch(var(--popover) / <alpha-value>)",
          foreground: "oklch(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "oklch(var(--primary) / <alpha-value>)",
          foreground: "oklch(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "oklch(var(--secondary) / <alpha-value>)",
          foreground: "oklch(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "oklch(var(--muted) / <alpha-value>)",
          foreground: "oklch(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "oklch(var(--accent) / <alpha-value>)",
          foreground: "oklch(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "oklch(var(--destructive) / <alpha-value>)",
          foreground: "oklch(var(--destructive-foreground) / <alpha-value>)",
        },
        border: "oklch(var(--border) / <alpha-value>)",
        input: "oklch(var(--input) / <alpha-value>)",
        ring: "oklch(var(--ring) / <alpha-value>)",
        chart: {
          "1": "oklch(var(--chart-1) / <alpha-value>)",
          "2": "oklch(var(--chart-2) / <alpha-value>)",
          "3": "oklch(var(--chart-3) / <alpha-value>)",
          "4": "oklch(var(--chart-4) / <alpha-value>)",
          "5": "oklch(var(--chart-5) / <alpha-value>)",
        },
        sidebar: {
          DEFAULT: "oklch(var(--sidebar) / <alpha-value>)",
          foreground: "oklch(var(--sidebar-foreground) / <alpha-value>)",
          primary: "oklch(var(--sidebar-primary) / <alpha-value>)",
          "primary-foreground": "oklch(var(--sidebar-primary-foreground) / <alpha-value>)",
          accent: "oklch(var(--sidebar-accent) / <alpha-value>)",
          "accent-foreground": "oklch(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "oklch(var(--sidebar-border) / <alpha-value>)",
          ring: "oklch(var(--sidebar-ring) / <alpha-value>)",
        },
        // The brand palette, plain hex (not theme tokens) -- for spots that
        // need a specific brand hue directly rather than a semantic role
        // (status lights, chart fills). Each color with a text-contrast
        // problem on white (checked against WCAG 4.5:1) gets a darkened
        // "-text" sibling for use as small text on a light background;
        // blue/purple already clear 4.5:1 at full saturation, no variant
        // needed. Reserved as status colors (see badge.tsx) -- never
        // repurposed as "series N" in a categorical chart.
        brand: {
          red: "#E63946",
          "red-text": "#DA3642",
          orange: "#FF8C00",
          "orange-text": "#B26200",
          yellow: "#FFC300",
          "yellow-text": "#947100",
          green: "#009B72",
          "green-text": "#008763",
          blue: "#0077B6",
          purple: "#8A2BE2",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
