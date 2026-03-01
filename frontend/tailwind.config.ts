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
          DEFAULT: "#6366f1",
          light: "#818cf8",
          dark: "#4f46e5",
        },
        accent: {
          DEFAULT: "#14b8a6",
          light: "#2dd4bf",
          dark: "#0d9488",
        },
      },
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.32, 0.72, 0, 1)",
        smooth: "cubic-bezier(0.32, 0.72, 0, 1)",
        out: "cubic-bezier(0.33, 1, 0.68, 1)",
        in: "cubic-bezier(0.32, 0, 0.67, 0)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      transitionDuration: {
        "400": "400ms",
        theme: "400ms",
      },
      backgroundImage: {
        "grid-pattern": `linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)`,
        "grid-pattern-dense": `linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)`,
      },
      backgroundSize: {
        "grid": "24px 24px",
        "grid-dense": "16px 16px",
      },
      boxShadow: {
        "brand/25": "0 10px 40px -10px rgba(99, 102, 241, 0.35)",
        "brand-light/30": "0 10px 40px -5px rgba(129, 140, 248, 0.4)",
        "brand-glow": "0 0 20px rgba(99, 102, 241, 0.2)",
        "brand-glow-lg": "0 0 40px rgba(99, 102, 241, 0.25)",
        "brand-glow-strong": "0 0 30px rgba(99, 102, 241, 0.3)",
        "glass": "0 8px 32px rgba(0, 0, 0, 0.08)",
        "glass-dark": "0 8px 32px rgba(0, 0, 0, 0.3)",
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out both",
        "slide-up": "slide-up 0.4s ease-out both",
        "zoom-in": "zoom-in 0.25s ease-out both",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "zoom-in": { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
      },
    },
  },
  plugins: [],
};

export default config;
