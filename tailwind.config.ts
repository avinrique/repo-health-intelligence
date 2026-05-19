import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        ink: {
          base: "#08080d",
          elev: "#0f0f17",
          surface: "#13131e",
          surface2: "#1a1a28",
          border: "#232336",
          borderStrong: "#34344e",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
