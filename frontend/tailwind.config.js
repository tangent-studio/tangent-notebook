/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Lora", "serif"],
        serif: ["Lora", "serif"],
      },
      fontSize: {
        base: "14px",
      },
    },
  },
};
