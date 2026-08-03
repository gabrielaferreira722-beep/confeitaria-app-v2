import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FBF7F1',
        surface: '#FFFFFF',
        ink: '#2B2320',
        muted: '#8A7B70',
        border: '#E7DED3',
        caramel: '#B5651D',
        'caramel-dark': '#8F4E15',
        rose: '#C4685A',
        sage: '#5B7A5B',
        warn: '#B4762B',
      },
      fontFamily: {
        display: ['Georgia', 'Cambria', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
      },
    },
  },
  plugins: [],
};

export default config;
