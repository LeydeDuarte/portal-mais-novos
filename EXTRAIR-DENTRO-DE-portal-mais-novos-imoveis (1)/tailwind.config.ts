import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14161A',
        accent: '#257CFF'
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'Poppins', 'system-ui', 'sans-serif'], // "serif" = fonte dos títulos (hoje Poppins)
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};

export default config;
