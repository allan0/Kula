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
        gold: {
          light: "#F3E5AB",
          DEFAULT: "#D4AF37", // Classic Gold
          dark: "#996515",
        },
        earth: {
          light: "#8D6E63",
          DEFAULT: "#3E2723", // Deep Brown
          dark: "#1B1212",    // Rich Black-Brown
        },
      },
      backgroundImage: {
        'luxury-texture': "url('/assets/texture.png')", // We will add a subtle noise/grain
        'gold-gradient': "linear-gradient(to right, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)",
      },
    },
  },
  plugins: [],
};
export default config;
