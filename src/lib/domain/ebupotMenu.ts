import type { NavSubItem } from '@/components/layout/NavDropdown';

/**
 * Isi dropdown "eBupot" pada nav bar, urutan dan label disalin persis dari
 * screenshot menu asli (bukan dari slide PDF, yang tidak menunjukkan menu
 * ini secara utuh): BPPU, BPNR, Penyetoran Sendiri, Pemotongan Secara
 * Digunggung, BP21, BP26, BPA1, BPA2, Bukti Pemotongan Bulanan Pegawai Tetap
 * (BPMP), lalu Unggah Dokumen. BPMP dan BP21 sudah punya halaman sungguhan;
 * sisanya menuju halaman "segera hadir" (lihat `ComingSoonNotice`) supaya
 * dropdown ini tidak berujung 404 sebelum modulnya dibangun.
 */
export const EBUPOT_MENU: NavSubItem[] = [
  { label: 'BPPU', href: '/ebupot/bppu', badge: 'Segera' },
  { label: 'BPNR', href: '/ebupot/bpnr', badge: 'Segera' },
  { label: 'Penyetoran Sendiri', href: '/ebupot/bpss', badge: 'Segera' },
  { label: 'Pemotongan Secara Digunggung', href: '/ebupot/bpdgg', badge: 'Segera' },
  { label: 'BP21 - Bukti Pemotongan Selain Pegawai Tetap', href: '/ebupot/bp21' },
  { label: 'BP26 - Bukti Pemotongan Wajib Pajak Luar Negeri', href: '/ebupot/bp26', badge: 'Segera' },
  { label: 'BPA1 - Bukti Pemotongan A1 Masa Pajak Terakhir', href: '/ebupot/bpa1', badge: 'Segera' },
  { label: 'BPA2 - Bukti Pemotongan A2 Masa Pajak Terakhir', href: '/ebupot/bpa2', badge: 'Segera' },
  { label: 'Bukti Pemotongan Bulanan Pegawai Tetap', href: '/ebupot/bpmp' },
  { label: 'Unggah Dokumen yang Dipersamakan', href: '/ebupot/doklain', badge: 'Segera' },
];
