import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class", '[data-theme="night"]'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens mapped to rgb channel CSS variables with alpha support
        bg: "rgb(var(--bg-rgb) / <alpha-value>)",
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        "surface-raised": "rgb(var(--surface-raised-rgb) / <alpha-value>)",
        border: "rgb(var(--border-rgb) / <alpha-value>)",
        hairline: "rgb(var(--hairline-rgb) / <alpha-value>)",
        text: "rgb(var(--text-rgb) / <alpha-value>)",
        "text-muted": "rgb(var(--text-muted-rgb) / <alpha-value>)",
        "text-subtle": "rgb(var(--text-subtle-rgb) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          soft: "rgb(var(--accent-soft-rgb) / <alpha-value>)",
          deep: "rgb(var(--accent-deep-rgb) / <alpha-value>)",
        },
        link: "rgb(var(--link-rgb) / <alpha-value>)",
        success: "rgb(var(--success-rgb) / <alpha-value>)",
        danger: "rgb(var(--danger-rgb) / <alpha-value>)",
        focus: "rgb(var(--focus-rgb) / <alpha-value>)",

        // Palette aliases mapped to channel variables for automatic Night/Dawn adaptability
        void: "rgb(var(--void-rgb) / <alpha-value>)",
        "forest-night": "rgb(var(--forest-night-rgb) / <alpha-value>)",
        slate: "rgb(var(--slate-rgb) / <alpha-value>)",
        cloud: "rgb(var(--cloud-rgb) / <alpha-value>)",
        mist: "rgb(var(--mist-rgb) / <alpha-value>)",
        sage: "rgb(var(--sage-rgb) / <alpha-value>)",
        lantern: {
          DEFAULT: "rgb(var(--lantern-rgb) / <alpha-value>)",
          soft: "rgb(var(--lantern-soft-rgb) / <alpha-value>)",
          deep: "rgb(var(--lantern-deep-rgb) / <alpha-value>)",
        },
        lake: "rgb(var(--lake-rgb) / <alpha-value>)",
        leaf: "rgb(var(--leaf-rgb) / <alpha-value>)",
        "dusk-rose": "rgb(var(--dusk-rose-rgb) / <alpha-value>)",

        // Fixed palette values from Design.md §3.2
        graphite: "rgb(var(--graphite-rgb) / <alpha-value>)",
        ash: "rgb(var(--ash-rgb) / <alpha-value>)",
        viridian: "rgb(var(--viridian-rgb) / <alpha-value>)",
        pine: "rgb(var(--pine-rgb) / <alpha-value>)",
        moss: "rgb(var(--moss-rgb) / <alpha-value>)",
        cobalt: "rgb(var(--cobalt-rgb) / <alpha-value>)",
        deepsea: "rgb(var(--deepsea-rgb) / <alpha-value>)",
        skyblue: "rgb(var(--skyblue-rgb) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        serif: ["var(--font-newsreader)", "serif"],
        sans: ["var(--font-instrument)", "sans-serif"],
      },
      boxShadow: {
        lantern: "0 0 0 1px var(--hairline), 0 12px 48px -12px rgba(226,184,102,0.18)",
        "lantern-sm": "0 0 0 1px var(--hairline), 0 4px 16px -4px rgba(226,184,102,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
