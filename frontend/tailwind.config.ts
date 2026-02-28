import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#5b21b6",
          light: "#7c3aed",
          dark: "#4c1d95",
        },
      },
      boxShadow: {
        "brand/25": "0 10px 40px -10px rgba(91, 33, 182, 0.35)",
        "brand-light/30": "0 10px 40px -5px rgba(124, 58, 237, 0.4)",
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out both",
        "slide-up": "slide-up 0.35s ease-out both",
        "zoom-in": "zoom-in 0.2s ease-out both",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "zoom-in": { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
      },
      transitionDuration: { "400": "400ms" },
    },
  },
  plugins: [],
};

export default config;

