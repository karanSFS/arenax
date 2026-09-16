import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/game/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary neon palette
        neon: {
          cyan: "#00f5ff",
          purple: "#bf5fff",
          pink: "#ff2d78",
          green: "#39ff14",
          orange: "#ff6b00",
          yellow: "#ffd700",
        },
        // Dark UI
        dark: {
          900: "#050508",
          800: "#0a0a0f",
          700: "#0f0f1a",
          600: "#141428",
          500: "#1a1a35",
          400: "#242450",
          300: "#2e2e6b",
          200: "#3d3d8a",
          100: "#5050bb",
        },
        // Glass
        glass: {
          light: "rgba(255,255,255,0.05)",
          medium: "rgba(255,255,255,0.08)",
          heavy: "rgba(255,255,255,0.12)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-orbitron)", "monospace"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "arena-grid": "linear-gradient(rgba(0,245,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,255,0.05) 1px, transparent 1px)",
        "hero-gradient": "linear-gradient(135deg, #050508 0%, #0a0a1f 50%, #050508 100%)",
      },
      backgroundSize: {
        "grid-sm": "20px 20px",
        "grid-md": "40px 40px",
        "grid-lg": "60px 60px",
      },
      animation: {
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "slide-up": "slide-up 0.5s ease-out",
        "slide-down": "slide-down 0.5s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
        "shimmer": "shimmer 2s linear infinite",
        "rotate-slow": "rotate 8s linear infinite",
        "border-spin": "border-spin 4s linear infinite",
        "particle-float": "particle-float 6s ease-in-out infinite",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { opacity: "1", filter: "brightness(1)" },
          "50%": { opacity: "0.8", filter: "brightness(1.3)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "slide-up": {
          from: { transform: "translateY(20px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          from: { transform: "translateY(-20px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { transform: "scale(0.9)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "border-spin": {
          "0%": { borderColor: "#00f5ff" },
          "33%": { borderColor: "#bf5fff" },
          "66%": { borderColor: "#ff2d78" },
          "100%": { borderColor: "#00f5ff" },
        },
        "particle-float": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)", opacity: "0" },
          "10%, 90%": { opacity: "1" },
          "50%": { transform: "translateY(-100px) rotate(180deg)" },
        },
      },
      boxShadow: {
        "neon-cyan": "0 0 10px rgba(0,245,255,0.5), 0 0 30px rgba(0,245,255,0.2)",
        "neon-purple": "0 0 10px rgba(191,95,255,0.5), 0 0 30px rgba(191,95,255,0.2)",
        "neon-pink": "0 0 10px rgba(255,45,120,0.5), 0 0 30px rgba(255,45,120,0.2)",
        "neon-green": "0 0 10px rgba(57,255,20,0.5), 0 0 30px rgba(57,255,20,0.2)",
        "glass": "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
        "card": "0 4px 24px rgba(0,0,0,0.6)",
        "card-hover": "0 8px 40px rgba(0,245,255,0.15)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
        "128": "32rem",
      },
    },
  },
  plugins: [],
};

export default config;
