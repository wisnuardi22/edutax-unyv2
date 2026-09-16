/**
 * Tarif Efektif Rata-rata (TER) bulanan — PMK 168 Tahun 2023.
 *
 * PENTING: tabel di bawah baru memuat sebagian bracket sebagai contoh bentuk
 * data. Lengkapi seluruh bracket dari Lampiran PMK-168/2023 sebelum dipakai
 * mahasiswa, dan cocokkan hasilnya dengan contoh perhitungan di lampiran
 * tersebut. Bracket ditulis sebagai batas bawah inklusif agar mudah diperiksa
 * baris per baris terhadap dokumen aslinya.
 */

export type TerCategory = 'A' | 'B' | 'C';

/** Pemetaan status PTKP ke kategori TER. */
export const PTKP_TO_TER: Record<string, TerCategory> = {
  'TK/0': 'A', 'TK/1': 'A', 'K/0': 'A',
  'TK/2': 'B', 'TK/3': 'B', 'K/1': 'B', 'K/2': 'B',
  'K/3': 'C',
};

export const PTKP_OPTIONS = Object.keys(PTKP_TO_TER);

interface Bracket {
  /** Batas bawah penghasilan bruto bulanan, inklusif. */
  from: number;
  /** Tarif dalam persen. */
  rate: number;
}

const TER_TABLE: Record<TerCategory, Bracket[]> = {
  A: [
    { from: 0, rate: 0 },
    { from: 5_400_001, rate: 0.25 },
    { from: 5_650_001, rate: 0.5 },
    { from: 5_950_001, rate: 0.75 },
    { from: 6_300_001, rate: 1 },
    // TODO: lanjutkan seluruh bracket kategori A dari Lampiran PMK-168/2023.
  ],
  B: [
    { from: 0, rate: 0 },
    { from: 6_200_001, rate: 0.25 },
    { from: 6_500_001, rate: 0.5 },
    { from: 6_850_001, rate: 0.75 },
    { from: 7_300_001, rate: 1 },
    // TODO: lanjutkan seluruh bracket kategori B.
  ],
  C: [
    { from: 0, rate: 0 },
    { from: 6_600_001, rate: 0.25 },
    { from: 6_950_001, rate: 0.5 },
    { from: 7_350_001, rate: 0.75 },
    { from: 7_800_001, rate: 1 },
    // TODO: lanjutkan seluruh bracket kategori C.
  ],
};

export function terRate(ptkp: string, gross: number): number {
  const category = PTKP_TO_TER[ptkp] ?? 'A';
  const table = TER_TABLE[category];
  let rate = 0;
  for (const b of table) {
    if (gross >= b.from) rate = b.rate;
  }
  return rate;
}

/** PPh Pasal 21 bulanan dibulatkan ke rupiah penuh. */
export function withheldByTer(ptkp: string, gross: number): { rate: number; withheld: number } {
  const rate = terRate(ptkp, gross);
  return { rate, withheld: Math.floor((gross * rate) / 100) };
}
