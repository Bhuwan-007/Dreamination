import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#090D11",
        "forest-night": "#0C1C17",
        slate: "#151A1E",
        graphite: "#282E31",
        ash: "#4B5151",
        cloud: "#E9EAEB",
        mist: "#BDCEBC",
        sage: "#77917F",
        lantern: {
          DEFAULT: "#E2B866",
          soft: "#F3DDA6",
          deep: "#B58A3C",
        },
        viridian: "#437666",
        pine: "#3A5248",
        moss: "#444E37",
        leaf: "#909653",
        lake: "#559CA9",
        "dusk-rose": "#C9747C",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        serif: ["var(--font-newsreader)", "serif"],
        sans: ["var(--font-instrument)", "sans-serif"],
      },
      boxShadow: {
        lantern: "0 0 0 1px rgba(226,184,102,0.28), 0 12px 48px -12px rgba(226,184,102,0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
