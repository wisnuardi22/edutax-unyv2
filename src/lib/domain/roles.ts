/**
 * Konstanta role akses.
 * Nama role disalin apa adanya dari panduan Coretax (slide 45-48), termasuk
 * ejaan "WITHOLDING" yang memang tertulis dengan satu huruf H di dokumen DJP.
 * Jangan "dikoreksi" agar mahasiswa terbiasa dengan penamaan aslinya.
 */

export const ROLES = {
  // Bukti Potong PPh 21/26
  EBUPOT_21_DRAFTER: 'ROLE_CTAS_PORTAL_EBUPOT_21/26_DRAFTER',
  EBUPOT_21_SIGNER: 'ROLE_CTAS_PORTAL_EBUPOT_21/26_SIGNER',

  // Bukti Potong PPh Unifikasi
  EBUPOT_UNIFIKASI_DRAFTER: 'ROLE_CTAS_PORTAL_EBUPOT_DRAFTER',
  EBUPOT_UNIFIKASI_SIGNER: 'ROLE_CTAS_PORTAL_EBUPOT_SIGNER',

  // SPT Masa PPh 21/26
  SPT_21_DRAFTER: 'ROLE_CTAS_PORTAL_ARTICLE_21/26_WITHOLDING_DRAFTER',
  SPT_21_SIGNER: 'ROLE_CTAS_PORTAL_ARTICLE_21/26_WITHOLDING_SIGNER',

  // SPT Masa PPh Unifikasi
  SPT_UNIFIKASI_DRAFTER: 'ROLE_CTAS_PORTAL_TAX_WITHOLDING_DRAFTER',
  SPT_UNIFIKASI_SIGNER: 'ROLE_CTAS_PORTAL_TAX_WITHOLDING_SIGNER',

  // Faktur Pajak & SPT Masa PPN (disiapkan untuk tahap lanjutan)
  TAX_INVOICE_DRAFTER: 'ROLE_CTAS_PORTAL_TAX_INVOICE_DRAFTER',
  TAX_INVOICE_SIGNER: 'ROLE_CTAS_PORTAL_TAX_INVOICE_SIGNER',
  VAT_RETURN_DRAFTER: 'ROLE_CTAS_PORTAL_VAT_TAX_RETURN_DRAFTER',
  VAT_RETURN_SIGNER: 'ROLE_CTAS_PORTAL_VAT_TAX_RETURN_SIGNER',

  // Bea Meterai
  STAMP_DUTY_DRAFTER: 'ROLE_CTAS_PORTAL_STAMP_DUTY_TAX_RETURN_DRAFTER',
  STAMP_DUTY_SIGNER: 'ROLE_CTAS_PORTAL_STAMP_DUTY_TAX_RETURN_SIGNER',

  // Registrasi & layanan
  REG_BASIC: 'ROLE_CTAS_PORTAL_REPRESENTATIVE_EXTERNAL_REG_BASIC',
  REG_DATA_UPDATE: 'ROLE_CTAS_PORTAL_REPRESENTATIVE_EXTERNAL_REG_DATA_UPDATE',
  PAY_BASIC: 'ROLE_CTAS_PORTAL_REPRESENTATIVE_EXTERNAL_PAY_BASIC',
  TPS_BASIC: 'ROLE_CTAS_PORTAL_REPRESENTATIVE_EXTERNAL_TPS_BASIC',
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

/** Label bahasa Indonesia untuk ditampilkan di layar "Tetapkan Role". */
export const ROLE_LABELS: Record<string, string> = {
  [ROLES.EBUPOT_21_DRAFTER]: 'Pembuat draft Bukti Potong PPh Pasal 21/26',
  [ROLES.EBUPOT_21_SIGNER]: 'Penandatangan Bukti Potong PPh Pasal 21/26',
  [ROLES.EBUPOT_UNIFIKASI_DRAFTER]: 'Pembuat draft Bukti Potong PPh Unifikasi',
  [ROLES.EBUPOT_UNIFIKASI_SIGNER]: 'Penandatangan Bukti Potong PPh Unifikasi',
  [ROLES.SPT_21_DRAFTER]: 'Pembuat draft SPT Masa PPh Pasal 21/26',
  [ROLES.SPT_21_SIGNER]: 'Penandatangan SPT Masa PPh Pasal 21/26',
  [ROLES.SPT_UNIFIKASI_DRAFTER]: 'Pembuat draft SPT Masa PPh Unifikasi',
  [ROLES.SPT_UNIFIKASI_SIGNER]: 'Penandatangan SPT Masa PPh Unifikasi',
  [ROLES.TAX_INVOICE_DRAFTER]: 'Pembuat draft faktur pajak',
  [ROLES.TAX_INVOICE_SIGNER]: 'Penandatangan faktur pajak',
  [ROLES.VAT_RETURN_DRAFTER]: 'Pembuat draft SPT Masa PPN',
  [ROLES.VAT_RETURN_SIGNER]: 'Penandatangan SPT Masa PPN',
  [ROLES.STAMP_DUTY_DRAFTER]: 'Pembuat draft SPT Masa Bea Meterai',
  [ROLES.STAMP_DUTY_SIGNER]: 'Penandatangan SPT Masa Bea Meterai',
  [ROLES.REG_BASIC]: 'Role dasar modul registrasi bagi Kuasa Wajib Pajak',
  [ROLES.REG_DATA_UPDATE]: 'Role untuk Perubahan Data Wajib Pajak',
  [ROLES.PAY_BASIC]: 'Role dasar modul pembayaran bagi Wakil/Kuasa',
  [ROLES.TPS_BASIC]: 'Role dasar modul Layanan Perpajakan',
};

/** Pengelompokan role untuk layar pemilihan, mengikuti slide "Jenis Role Akses". */
export const ROLE_GROUPS = [
  { key: 'bp_fp', label: 'Terkait BP/FP', roles: [
    ROLES.EBUPOT_21_DRAFTER, ROLES.EBUPOT_21_SIGNER,
    ROLES.EBUPOT_UNIFIKASI_DRAFTER, ROLES.EBUPOT_UNIFIKASI_SIGNER,
    ROLES.TAX_INVOICE_DRAFTER, ROLES.TAX_INVOICE_SIGNER,
  ]},
  { key: 'spt', label: 'Terkait SPT', roles: [
    ROLES.SPT_21_DRAFTER, ROLES.SPT_21_SIGNER,
    ROLES.SPT_UNIFIKASI_DRAFTER, ROLES.SPT_UNIFIKASI_SIGNER,
    ROLES.VAT_RETURN_DRAFTER, ROLES.VAT_RETURN_SIGNER,
    ROLES.STAMP_DUTY_DRAFTER, ROLES.STAMP_DUTY_SIGNER,
  ]},
  { key: 'uang', label: 'Terkait Uang', roles: [ROLES.PAY_BASIC] },
  { key: 'registrasi', label: 'Terkait Registrasi', roles: [ROLES.REG_BASIC, ROLES.REG_DATA_UPDATE] },
  { key: 'layanan', label: 'Terkait Layanan', roles: [ROLES.TPS_BASIC] },
] as const;
