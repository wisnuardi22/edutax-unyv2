'use client';

import Link from 'next/link';

/**
 * Daftar 10 jenis dokumen di "Modul eBupot" (slide 91, [1]). Ini stopgap
 * ringan supaya BP21 (dan modul berikutnya) bisa dicapai dari UI — bukan
 * pengganti navigasi "Pilih Modul eBupot" yang sesungguhnya (lihat item #4
 * "Tambah menu navigasi eBupot" di README), yang idealnya jadi dropdown di
 * AppShell dan berlaku di semua halaman, bukan cuma sidebar eBupot.
 */
const MODULES: { key: string; label: string; href?: string }[] = [
  { key: 'BPMP', label: 'Bukti Pemotongan Bulanan Pegawai Tetap (BPMP)', href: '/ebupot/bpmp' },
  { key: 'BP21', label: 'Bukti Pemotongan Selain Pegawai Tetap (BP21)', href: '/ebupot/bp21' },
  { key: 'BPA1', label: 'Bukti Pemotongan Masa Pajak Terakhir A1 (BPA1)' },
  { key: 'BPA2', label: 'Bukti Pemotongan Masa Pajak Terakhir A2 (BPA2)' },
  { key: 'BP26', label: 'Bukti Pemotongan PPh Pasal 26 (BP26)' },
  { key: 'BPPU', label: 'Bukti Potong Pajak Unifikasi (BPPU)' },
  { key: 'BPNR', label: 'Bukti Potong Non Residen (BPNR)' },
  { key: 'DOKLAIN', label: 'Unggah Dokumen yang Dipersamakan' },
];

export function ModuleSwitcher({ active }: { active: string }) {
  return (
    <div className="border-b border-line pb-2">
      <p className="px-2 pb-1 text-xxs font-semibold uppercase tracking-wide text-ink-muted">
        Modul eBupot
      </p>
      {MODULES.map((m) =>
        m.href ? (
          <Link
            key={m.key}
            href={m.href}
            className={`block rounded px-2 py-1.5 text-[13px] ${
              active === m.key ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink hover:bg-canvas'
            }`}
          >
            {m.label}
          </Link>
        ) : (
          <p
            key={m.key}
            className="cursor-not-allowed px-2 py-1.5 text-[13px] text-ink-muted"
            title="Disiapkan pada tahap berikutnya"
          >
            {m.label}
          </p>
        ),
      )}
    </div>
  );
}
