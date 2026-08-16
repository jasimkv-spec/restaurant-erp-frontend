/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Monetix Solutions brand: sky-blue accent + deep navy chrome,
        // taken directly from the company logo.
        brand: {
          50: "#EAF7FD",
          100: "#CDEDFB",
          200: "#9FDFF6",
          400: "#5CC7EF",
          500: "#3FC6F2",
          600: "#1FAEE8",
          700: "#178FC0",
        },
        navy: {
          50: "#B9B4DA", // muted sidebar text
          400: "#8A82B3", // sidebar secondary text / muted labels
          600: "#2E2760", // sidebar hover / dividers
          700: "#241C57", // sidebar active item bg
          800: "#1B1140", // sidebar panel bg
          900: "#170F3D", // deepest navy - headings on light bg, logo badge
        },
      },
    },
  },
  plugins: [],
};
