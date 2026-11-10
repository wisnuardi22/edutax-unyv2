/**
 * Nama Objek Pajak untuk Bukti Pemotongan PPh Pasal 21 Selain Pegawai Tetap
 * (BP21) — slide "Income Tax" [8]-[11] pada panduan Coretax: begitu Tax
 * Object Name dipilih, Tax Article, Tax Object Code, Income Tax Status, dan
 * Revenue Code terisi otomatis, dan PPh dihitung sebagai:
 *
 *   Income Tax Withheld = Penghasilan Bruto × Deemed Net Income% × Rate%
 *
 * (persis contoh pada slide: Rp2.000.000 × 50% × 5% = Rp50.000 untuk
 * "Imbalan kepada Tenaga Ahli"). Ini BUKAN `Bruto × Rate%` langsung —
 * Deemed Net Income% adalah Norma Penghitungan Neto yang mengubah dasar
 * pengenaan pajak sebelum dikalikan tarif.
 *
 * PENTING: hanya entri "Imbalan kepada Tenaga Ahli" (kode 21-100-07, deemed
 * 50%, rate 5%) yang benar-benar terverifikasi dari contoh eksplisit pada
 * PDF panduan. Entri lain di bawah adalah perkiraan berdasarkan pola umum
 * Coretax dan BELUM diverifikasi — cocokkan kode objek pajak, persentase
 * deemed net income, dan tarifnya dengan referensi resmi (PER-16/PJ/2016
 * atau dokumentasi Coretax terbaru) sebelum dipakai menilai ketepatan
 * jawaban mahasiswa.
 */

export type IncomeTaxStatus = 'FINAL' | 'TIDAK_FINAL';

export interface TaxObjectOption {
  name: string;
  article: '21';
  taxObjectCode: string;
  incomeTaxStatus: IncomeTaxStatus;
  /** KAP-KJS, dipakai juga sebagai kode setoran pada kode billing. */
  revenueCode: string;
  /** Persen — Norma Penghitungan Neto, dikalikan ke bruto sebelum tarif. */
  deemedNetIncome: number;
  /** Persen, dikalikan ke (bruto × deemedNetIncome). */
  rate: number;
}

export const BP21_TAX_OBJECTS: TaxObjectOption[] = [
  {
    // Satu-satunya entri yang terverifikasi persis dari contoh PDF (slide Income Tax [8]-[11]).
    name: 'Imbalan kepada Tenaga Ahli (Pengacara, Akuntan, Arsitek, Dokter, Konsultan, Notaris, Pejabat Pembuat Akte Tanah, Penilai, Aktuaris)',
    article: '21',
    taxObjectCode: '21-100-07',
    incomeTaxStatus: 'TIDAK_FINAL',
    revenueCode: '411121-100',
    deemedNetIncome: 50,
    rate: 5,
  },
  {
    // Belum terverifikasi — perkiraan, lihat catatan PENTING di atas.
    name: 'Upah Harian/Mingguan/Satuan/Borongan (Bukan Pegawai)',
    article: '21',
    taxObjectCode: '21-100-01',
    incomeTaxStatus: 'TIDAK_FINAL',
    revenueCode: '411121-100',
    deemedNetIncome: 100,
    rate: 5,
  },
  {
    // Belum terverifikasi — perkiraan, lihat catatan PENTING di atas.
    name: 'Penghasilan Peserta Kegiatan',
    article: '21',
    taxObjectCode: '21-100-08',
    incomeTaxStatus: 'TIDAK_FINAL',
    revenueCode: '411121-100',
    deemedNetIncome: 100,
    rate: 5,
  },
  {
    // Belum terverifikasi — perkiraan, lihat catatan PENTING di atas.
    name: 'Imbalan kepada Distributor MLM/Direct Selling dan Kegiatan Sejenis',
    article: '21',
    taxObjectCode: '21-100-10',
    incomeTaxStatus: 'TIDAK_FINAL',
    revenueCode: '411121-100',
    deemedNetIncome: 100,
    rate: 5,
  },
  {
    // Belum terverifikasi — perkiraan, lihat catatan PENTING di atas.
    name: 'Honorarium/Imbalan Lain kepada Pejabat Negara, PNS, TNI/Polri (APBN/APBD)',
    article: '21',
    taxObjectCode: '21-401-01',
    incomeTaxStatus: 'FINAL',
    revenueCode: '411121-402',
    deemedNetIncome: 100,
    rate: 5,
  },
  {
    // Belum terverifikasi — perkiraan, lihat catatan PENTING di atas.
    name: 'Uang Pesangon yang Dibayarkan Sekaligus',
    article: '21',
    taxObjectCode: '21-402-01',
    incomeTaxStatus: 'FINAL',
    revenueCode: '411121-402',
    deemedNetIncome: 100,
    rate: 5,
  },
];

export const BP21_TAX_FACILITY_OPTIONS = [
  'Tanpa Fasilitas',
  'Surat Keterangan Bebas (SKB)',
  'Ditanggung Pemerintah (DTP)',
] as const;

export const BP21_REFERENCE_DOCUMENT_TYPES = [
  'Bukti Pembayaran',
  'Kontrak/Perjanjian',
  'Invoice',
  'Kuitansi',
] as const;

export function taxObjectByName(name: string): TaxObjectOption {
  return BP21_TAX_OBJECTS.find((o) => o.name === name) ?? BP21_TAX_OBJECTS[0];
}

/**
 * PPh Pasal 21 dipotong = Bruto × Deemed Net Income% × Rate%, dibulatkan ke
 * rupiah penuh. Lihat catatan PENTING di atas soal entri yang belum
 * terverifikasi.
 */
/**
 * PPh Pasal 21 dipotong untuk Bukan Pegawai / Tenaga Ahli (PMK-168/2023):
 * Dasar Pengenaan Pajak (DPP) = 50% × Penghasilan Bruto.
 * Tarif menggunakan tarif progresif Pasal 17 UU PPh atas dasar pengenaan pajak.
 * (Untuk 2 juta -> DPP 1 juta x 5% = 50.000)
 * (Untuk 200 juta -> DPP 100 juta -> 60jt x 5% + 40jt x 15% = 3jt + 6jt = 9.000.000)
 */
export function withheldByTaxObject(
  name: string,
  gross: number,
): { deemedNetIncome: number; rate: number; withheld: number } {
  const { deemedNetIncome, rate } = taxObjectByName(name);
  const deemedNetAmount = (gross * deemedNetIncome) / 100;
  
  if (name.startsWith('Imbalan kepada Tenaga Ahli')) {
    // Progresif Pasal 17
    let remaining = deemedNetAmount;
    let tax = 0;
    const b1 = Math.min(remaining, 60_000_000);
    tax += (b1 * 5) / 100;
    remaining -= b1;
    if (remaining > 0) {
      const b2 = Math.min(remaining, 190_000_000); // 250jt - 60jt
      tax += (b2 * 15) / 100;
      remaining -= b2;
    }
    if (remaining > 0) {
      const b3 = Math.min(remaining, 250_000_000); // 500jt - 250jt
      tax += (b3 * 25) / 100;
      remaining -= b3;
    }
    if (remaining > 0) {
      const b4 = Math.min(remaining, 4_500_000_000); // 5M - 500jt
      tax += (b4 * 30) / 100;
      remaining -= b4;
    }
    if (remaining > 0) {
      tax += (remaining * 35) / 100;
    }
    const effRate = gross > 0 ? (tax / gross) * 100 : rate;
    return { deemedNetIncome, rate: effRate, withheld: Math.floor(tax) };
  }

  return { deemedNetIncome, rate, withheld: Math.floor((deemedNetAmount * rate) / 100) };
}
