import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Original palette: laterite red soil of the Ranchi plateau, sal-leaf green, haldi amber.
        paper: '#FBF6EE',
        card: '#FFFFFF',
        ink: '#1F1A17',
        muted: '#6B6259',
        line: '#E6DCCB',
        laterite: { DEFAULT: '#B5361E', dark: '#8F2A17', soft: '#F8E3DD' },
        sal: { DEFAULT: '#2E7D4F', dark: '#1F5C38', soft: '#DDEFE3' },
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
