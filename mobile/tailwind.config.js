/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include any other paths to your components
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        gold: {
          light: "#F3E5AB",
          DEFAULT: "#D4AF37",
          dark: "#996515",
        },
        earth: {
          DEFAULT: "#3E2723",
          dark: "#0F0F0F",
        },
      },
    },
  },
  plugins: [],
}
