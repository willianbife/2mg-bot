import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#1E90FF",
          secondary: "#4B0082",
          success: "#2ECC71",
          danger: "#E74C3C",
          warning: "#F39C12",
          info: "#3498DB",
          neutral: "#95A5A6",
          accent: "#FF6B6B",
          ink: "#0A0A0A",
          panel: "#1A1A1A"
        }
      },
      boxShadow: {
        brand: "0 0 40px rgba(30, 144, 255, 0.15)"
      }
    }
  },
  plugins: []
};

export default config;
