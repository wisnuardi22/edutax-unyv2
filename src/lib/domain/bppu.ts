/**
 * Nama Objek Pajak untuk EBUPOT BPU (Bukti Pemotongan/Pemungutan Unifikasi),
 * slide 5-7 (Pasal 23) dan 11-12 (Pasal 4 ayat 2). Satu formulir BPU
 * dipakai untuk SEMUA pasal yang tercakup Unifikasi — bukan wizard
 * "pilih jenis dulu" terpisah. Ini terlihat dari slide 11: field "Jenis
 * Pajak" muncul sebagai kolom READ-ONLY yang otomatis terisi begitu "Nama
 * Objek Pajak" dipilih, sama seperti Tax Article/Tax Object Code — bukan
 * langkah awal yang terpisah. Artikel yang tercakup (dari tabel B Induk SPT
 * di slide 21-22): Article 4 Section 2, Article 15, Article 22, Article 23,
 * Article 26.
 *
 * PENTING — status verifikasi per baris:
 * - "Persewaan Tanah dan/atau Bangunan" (Pasal 4 ayat 2, kode 28-403-02,
 *   tarif 10%, KAP 411128-403) TERVERIFIKASI PENUH dari contoh terisi di
 *   slide 11 PDF — satu-satunya objek yang benar-benar ditunjukkan terisi.
 * - Objek lain di bawah memakai kode/tarif dari pengetahuan umum UU PPh
 *   Pasal 23 / PP 4 ayat 2 yang lazim dipakai, TAPI PDF tidak pernah
 *   menunjukkan layar Income Tax yang terisi untuk Pasal 23 (slide 2-7
 *   berhenti di langkah pilih Fasilitas Pajak, sebelum sampai ke Nama Objek
 *   Pajak). Jangan jadikan baris-baris ini acuan resmi tanpa mencocokkan ke
 *   PMK-141/PMK.03/2015 atau referensi KAP-KJS terbaru — tandai sebagai
 *   "perlu dilengkapi" sesuai instruksi, bukan sebagai aturan pasti.
 */

export type BppuArticle = '4(2)' | '15' | '22' | '23' | '26';
export type Sifat = 'FINAL' | 'TIDAK_FINAL';

export interface BppuTaxObject {
  name: string;
  article: BppuArticle;
  code: string;
  sifat: Sifat;
  /** Persen. */
  rate: number;
  kap: string;
  /** true hanya untuk baris yang benar-benar ditunjukkan terisi di PDF. */
  verified: boolean;
}

export const BPPU_TAX_OBJECTS: BppuTaxObject[] = [
  {
    name: 'Persewaan Tanah dan/atau Bangunan',
    article: '4(2)',
    code: '28-403-02',
    sifat: 'FINAL',
    rate: 10,
    kap: '411128-403',
    verified: true,
  },
  {
    // Belum terverifikasi dari PDF — lihat catatan PENTING di atas.
    name: 'Jasa Teknik, Jasa Manajemen, Jasa Konsultan, dan Jasa Lain (Pasal 23)',
    article: '23',
    code: '24-100-08',
    sifat: 'TIDAK_FINAL',
    rate: 2,
    kap: '411124-100',
    verified: false,
  },
  {
    // Belum terverifikasi dari PDF — lihat catatan PENTING di atas.
    name: 'Sewa dan Penghasilan Lain Sehubungan Penggunaan Harta (Selain Tanah/Bangunan)',
    article: '23',
    code: '24-104-04',
    sifat: 'TIDAK_FINAL',
    rate: 2,
    kap: '411124-100',
    verified: false,
  },
  {
    // Belum terverifikasi dari PDF — lihat catatan PENTING di atas.
    name: 'Dividen yang Diterima Wajib Pajak Badan Dalam Negeri (Pasal 23)',
    article: '23',
    code: '24-101-01',
    sifat: 'TIDAK_FINAL',
    rate: 15,
    kap: '411124-101',
    verified: false,
  },
  {
    // Belum terverifikasi dari PDF — lihat catatan PENTING di atas.
    name: 'Pengalihan Hak atas Tanah dan/atau Bangunan',
    article: '4(2)',
    code: '28-402-01',
    sifat: 'FINAL',
    rate: 2.5,
    kap: '411128-402',
    verified: false,
  },
];

export const BPPU_TAX_FACILITY_OPTIONS = [
  'Tanpa Fasilitas',
  'PPh Ditanggung Pemerintah (DTP)',
  'Fasilitas Lainnya',
] as const;

export const BPPU_REFERENCE_DOCUMENT_TYPES = [
  'Akta Perjanjian',
  'Kontrak/Perjanjian',
  'Invoice',
  'Bukti Pembayaran',
] as const;

export function taxObjectByName(name: string): BppuTaxObject {
  return BPPU_TAX_OBJECTS.find((o) => o.name === name) ?? BPPU_TAX_OBJECTS[0];
}

/** PPh dipotong/dipungut = Dasar Pengenaan Pajak × Rate%, dibulatkan ke rupiah penuh. */
export function withheldByTaxObject(name: string, dpp: number): { rate: number; withheld: number } {
  const { rate } = taxObjectByName(name);
  return { rate, withheld: Math.floor((dpp * rate) / 100) };
}

export const BPPU_ARTICLE_LABEL: Record<BppuArticle, string> = {
  '4(2)': 'Pasal 4 Ayat 2',
  '15': 'Pasal 15',
  '22': 'Pasal 22',
  '23': 'Pasal 23',
  '26': 'Pasal 26',
};
