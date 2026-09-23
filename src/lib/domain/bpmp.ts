/**
 * Tax Certificate & Tax Object Name untuk EBUPOT MP (Bukti Pemotongan
 * Bulanan Pegawai Tetap) — slide "Tax Facility" [10] dan "Tax Object Name"
 * [11]: begitu Tax Object Name dipilih, Tax Article dan Tax Object Code
 * terisi otomatis. Rate (%) dan PPh dipotong tetap dari tabel TER
 * (`ter.ts`) berdasarkan PTKP — Tax Object Name TIDAK mengubah cara hitung
 * TER, hanya menentukan kode objek pajak yang dilaporkan.
 *
 * PENTING: hanya kode untuk "Pegawai Tetap" yang terverifikasi dari PDF
 * panduan — 21-100-01 untuk pegawai residen (muncul di banyak slide), dan
 * 21-100-32 untuk pegawai berstatus asing/WNA (muncul di contoh baris
 * template impor). Kode untuk "Pensiunan Secara Teratur" dan "Fasilitas di
 * Daerah Tertentu" BELUM ada contoh eksplisit di PDF — nilai di bawah masih
 * perkiraan pola penomoran, cocokkan ke referensi resmi sebelum dipakai
 * menilai ketepatan jawaban mahasiswa.
 */

export interface TaxObjectOption {
  name: string;
  article: '21';
  /** Kode dasar untuk pegawai residen. */
  code: string;
  /** Kode untuk pegawai berstatus asing/WNA, bila berbeda dari kode dasar. */
  codeForeign: string;
  revenueCode: string;
}

export const BPMP_TAX_OBJECTS: TaxObjectOption[] = [
  {
    name: 'Penghasilan yang Diterima atau Diperoleh Pegawai Tetap',
    article: '21',
    code: '21-100-01',
    codeForeign: '21-100-32', // terverifikasi dari contoh baris template impor (CounterpartOption=Foreign)
    revenueCode: '411121-100',
  },
  {
    // Belum terverifikasi — perkiraan pola, lihat catatan PENTING di atas.
    name: 'Penghasilan yang Diterima atau Diperoleh Pensiunan Secara Teratur',
    article: '21',
    code: '21-100-02',
    codeForeign: '21-100-33',
    revenueCode: '411121-100',
  },
  {
    // Belum terverifikasi — perkiraan pola, lihat catatan PENTING di atas.
    name: 'Penghasilan yang Diterima atau Diperoleh Pegawai Tetap yang Menerima Fasilitas di Daerah Tertentu',
    article: '21',
    code: '21-100-03',
    codeForeign: '21-100-34',
    revenueCode: '411121-100',
  },
];

export const BPMP_TAX_CERTIFICATE_OPTIONS = [
  'Tanpa Fasilitas',
  'PPh Ditanggung Pemerintah (DTP)',
  'Fasilitas Lainnya',
] as const;

export function taxObjectByName(name: string): TaxObjectOption {
  return BPMP_TAX_OBJECTS.find((o) => o.name === name) ?? BPMP_TAX_OBJECTS[0];
}

export function taxObjectCodeFor(name: string, foreignEmployee: boolean): string {
  const obj = taxObjectByName(name);
  return foreignEmployee ? obj.codeForeign : obj.code;
}
