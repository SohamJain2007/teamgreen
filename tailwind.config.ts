import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Clean Ranchi palette: sal-forest green (Jharkhand's state tree), jharna teal (Hundru / Dassam / Jonha falls),
        // palash orange (Jharkhand's state flower), haldi amber. Cool off-white "paper" keeps it feeling clean.
        paper: '#F5F9F6',
        card: '#FFFFFF',
        ink: '#0F2A20',
        muted: '#557066',
        line: '#DAE6DF',
        sal: { DEFAULT: '#1A7A50', dark: '#125C3B', soft: '#E1F3E8' },
        jharna: { DEFAULT: '#0A7C8C', dark: '#075E6B', soft: '#DDF2F4' },
        palash: { DEFAULT: '#DD5A26', dark: '#B0401A', soft: '#FDE8DE' },
        haldi: { DEFAULT: '#C77D0A', text: '#8A5600', soft: '#FBEBC8' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
