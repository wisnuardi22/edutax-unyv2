import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'EduTax Universitas Negeri Yogyakarta',
  description: 'Simulasi pembelajaran administrasi perpajakan untuk lingkungan akademik.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={poppins.variable}>
      {/*
        `poppins.className` diterapkan langsung ke body (bukan hanya lewat
        variabel CSS di <html>) supaya font-family Poppins pasti berlaku,
        tidak bergantung pada Tailwind Preflight meneruskan `theme.fontFamily.sans`
        dengan benar. Ini yang menyebabkan font sempat tampil sebagai serif
        bawaan browser pada sebagian environment.
      */}
      <body className={poppins.className}>{children}</body>
    </html>
  );
}
