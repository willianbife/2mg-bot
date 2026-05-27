import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        neon: {
          pink: "#ff2bd6",
          rose: "#ff3f8f",
          cyan: "#34f5c5",
          ink: "#07040a",
          panel: "#110915"
        }
      },
      boxShadow: {
        neon: "0 0 40px rgba(255, 43, 214, 0.22)"
      }
    }
  },
  plugins: []
};

export default config;
