import type { Config } from 'tailwindcss';

/**
 * Palet mengacu SAP Fiori Horizon (biru-putih), bukan biru-kuning DJP.
 * Kuning UNY dipakai terbatas sebagai warna aksi utama saja.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF5FF',
          100: '#D8E8FF',
          200: '#AECFFF',
          300: '#7FB2FF',
          400: '#3D8DF7',
          500: '#0070F2', // aksi & tautan
          600: '#0057D2',
          700: '#0040A0',
          800: '#0A2E5C', // header aplikasi
          900: '#06203F', // panel gelap
        },
        canvas: '#EDF1F6', // latar halaman Fiori
        line: '#D9E1EA',
        ink: {
          DEFAULT: '#1D2D3E',
          muted: '#5B738B',
        },
        accent: '#F5B301', // kuning UNY, hanya untuk tombol utama
        good: '#30914C',
        warn: '#E76500',
        bad: '#CC1919',
      },
      fontFamily: {
        sans: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Skala rapat khas aplikasi administrasi: tabel padat, bukan marketing page
        xxs: ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(29,45,62,0.08), 0 0 0 1px rgba(217,225,234,0.9)',
      },
      borderRadius: {
        card: '10px',
      },
    },
  },
  plugins: [],
};

export default config;
