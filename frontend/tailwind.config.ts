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
          DEFAULT: "#D4AF37",
          light: "#F3E5AB",
          dark: "#B8972E",
        },
        earth: {
          DEFAULT: "#1B1212",
          dark: "#0F0F0F",
        },
      },
      fontFamily: {
        serif: ['Playfair Display', 'serif'],
        sans: ['Inter', 'system_ui', 'sans-serif'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(145deg, #D4AF37, #F3E5AB, #D4AF37)',
      },
      boxShadow: {
        'luxury': '0 25px 50px -12px rgb(212 175 55 / 0.15)',
        'inner-glow': 'inset 0 2px 4px 0 rgb(212 175 55 / 0.1)',
      },
    },
  },
  plugins: [],
};

export default config;
