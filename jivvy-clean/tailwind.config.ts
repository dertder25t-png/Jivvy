import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#FAFAFA", // zinc-50
          dark: "#09090b",    // zinc-950
        },
        surface: {
          DEFAULT: "#FFFFFF",
          dark: "#18181b",    // zinc-900
        },
        primary: {
          DEFAULT: "#2563eb", // Focus Blue
          foreground: "#ffffff",
        },
        text: {
          primary: {
            DEFAULT: "#18181b", // zinc-900
            dark: "#f4f4f5",    // zinc-100
          },
          secondary: {
            DEFAULT: "#71717a", // zinc-500
            dark: "#a1a1aa",    // zinc-400
          },
        },
        border: {
          DEFAULT: "#e4e4e7", // zinc-200
          dark: "#27272a",    // zinc-800
        }
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)"],
        mono: ["var(--font-geist-mono)"],
      },
    },
  },
  plugins: [],
};
export default config;
