import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#020617",
        surface: "#020617",
        primary: {
          DEFAULT: "#38bdf8",
          foreground: "#0f172a",
        },
        accent: "#22c55e",
      },
    },
  },
  plugins: [],
};

export default config;

