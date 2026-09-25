/**
 * Logika Bukti Pemotongan Tahunan PPh (1721-A2 / BPA2) — slide "Pembuatan
 * Bukti Pemotongan Tahunan PPh". Beda dari BPMP (TER bulanan), BPA2
 * menghitung PPh Pasal 21 SETAHUN memakai tarif progresif Pasal 17 atas
 * Penghasilan Kena Pajak, lalu dibandingkan dengan PPh yang sudah dipotong
 * bulanan sepanjang tahun (biasanya dari BPMP) untuk menentukan kurang/lebih
 * bayar pada masa pajak terakhir.
 */

/** PTKP tahunan resmi (berlaku sejak PMK-101/PMK.010/2016, belum berubah). */
export const PTKP_AMOUNTS: Record<string, number> = {
  'TK/0': 54_000_000,
  'TK/1': 58_500_000,
  'TK/2': 63_000_000,
  'TK/3': 67_500_000,
  'K/0': 58_500_000,
  'K/1': 63_000_000,
  'K/2': 67_500_000,
  'K/3': 72_000_000,
};

export const GENDER_OPTIONS = ['Pria', 'Wanita'] as const;

export const STATUS_WITHHOLDING_OPTIONS = [
  'Kurang dari Setahun',
  'Setahun Penuh',
] as const;

/** Satu-satunya Tax Object Name yang tercontoh eksplisit di slide untuk BPA2. */
export const BPA2_TAX_OBJECT = {
  name: 'Penghasilan yang Diterima atau Diperoleh Pegawai Tetap',
  article: '21' as const,
  code: '21-100-01',
  revenueCode: '411121-100',
};

/** Tarif Pasal 17 ayat (1) huruf a UU PPh (progresif). */
const BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 60_000_000, rate: 5 },
  { upTo: 250_000_000, rate: 15 },
  { upTo: 500_000_000, rate: 25 },
  { upTo: 5_000_000_000, rate: 30 },
  { upTo: Infinity, rate: 35 },
];

/** PPh Pasal 17 progresif atas Penghasilan Kena Pajak, dibulatkan ke rupiah penuh. */
export function progressiveTax(taxableIncome: number): number {
  let remaining = Math.max(0, taxableIncome);
  let tax = 0;
  let lower = 0;
  for (const b of BRACKETS) {
    const bandSize = b.upTo - lower;
    const taxedInBand = Math.min(remaining, bandSize);
    if (taxedInBand <= 0) break;
    tax += (taxedInBand * b.rate) / 100;
    remaining -= taxedInBand;
    lower = b.upTo;
    if (remaining <= 0) break;
  }
  return Math.floor(tax);
}

/**
 * Biaya jabatan: 5% dari bruto, maksimal Rp500.000/bulan dikali jumlah
 * bulan dalam periode (standar Pasal 21, PMK-250/PMK.03/2008).
 */
export function biayaJabatan(grossIncome: number, months: number): number {
  return Math.min(Math.floor((grossIncome * 5) / 100), 500_000 * Math.max(1, months));
}

export function monthsBetween(startMonth: number, startYear: number, endMonth: number, endYear: number): number {
  return (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
}

export interface GrossIncomeInput {
  salaryPensionThtJht: number;
  wifeIncomeBenefit: number;
  childrenIncomeBenefit: number;
  incomeImprovementBenefit: number;
  structuralFunctionalBenefit: number;
  riceIncomeBenefit: number;
  otherIncomeBenefit: number;
  otherFixedRegularIncome: number;
}

export function totalGrossIncome(g: GrossIncomeInput): number {
  return g.salaryPensionThtJht + g.wifeIncomeBenefit + g.childrenIncomeBenefit
    + g.incomeImprovementBenefit + g.structuralFunctionalBenefit + g.riceIncomeBenefit
    + g.otherIncomeBenefit + g.otherFixedRegularIncome;
}

export interface Bpa2Calc {
  totalGross: number;
  netIncome: number;
  netIncomeFromPrevious: number;
  totalNetIncomeForCalc: number;
  taxExemption: number;
  taxableIncome: number;
  article21TaxOnTaxableIncome: number;
  article21TaxLiability: number;
  article21TaxWithheldFromPrevious: number;
  article21TaxLiabilityInThisSlip: number;
  article21TaxWithheld: number;
  underOverPayment: number;
}

/**
 * Rangkaian penghitungan PPh Tahunan persis urutan field [17]-[19] di slide.
 * PENTING: contoh angka di slide menunjukkan Status of Tax Exemption "TK/0"
 * tapi nilai Tax Exemption yang tertera (58.500.000) sebenarnya cocok untuk
 * K/0, bukan TK/0 (54.000.000) — ini kemungkinan salah ketik pada slide itu
 * sendiri. Di sini dipakai tabel PTKP resmi (`PTKP_AMOUNTS`) yang benar
 * secara hukum, bukan meniru mentah-mentah angka yang kemungkinan keliru
 * tersebut.
 */
export function calculateBpa2(input: {
  gross: GrossIncomeInput;
  months: number;
  ptkp: string;
  netIncomeFromPrevious: number;
  article21TaxWithheldFromPrevious: number;
  article21TaxWithheld: number;
}): Bpa2Calc {
  const totalGross = totalGrossIncome(input.gross);
  const netIncome = totalGross - biayaJabatan(totalGross, input.months);
  const totalNetIncomeForCalc = netIncome + input.netIncomeFromPrevious;
  const taxExemption = PTKP_AMOUNTS[input.ptkp] ?? PTKP_AMOUNTS['TK/0'];
  const taxableIncome = Math.max(0, totalNetIncomeForCalc - taxExemption);
  const article21TaxOnTaxableIncome = progressiveTax(taxableIncome);
  const article21TaxLiability = article21TaxOnTaxableIncome;
  const article21TaxLiabilityInThisSlip = article21TaxLiability - input.article21TaxWithheldFromPrevious;
  const underOverPayment = article21TaxLiabilityInThisSlip - input.article21TaxWithheld;

  return {
    totalGross,
    netIncome,
    netIncomeFromPrevious: input.netIncomeFromPrevious,
    totalNetIncomeForCalc,
    taxExemption,
    taxableIncome,
    article21TaxOnTaxableIncome,
    article21TaxLiability,
    article21TaxWithheldFromPrevious: input.article21TaxWithheldFromPrevious,
    article21TaxLiabilityInThisSlip,
    article21TaxWithheld: input.article21TaxWithheld,
    underOverPayment,
  };
}
