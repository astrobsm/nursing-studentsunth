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
        'green-deep': '#006400',
        'green-medium': '#228B22',
        'green-light': '#90EE90',
        'green-pale': '#E8F5E9',
        'yellow-accent': '#FFD700',
        'yellow-light': '#FFF8DC',
      },
    },
  },
  plugins: [],
};
export default config;
