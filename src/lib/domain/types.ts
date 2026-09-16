import type { RoleCode } from './roles';

/** Siklus hidup dokumen bukti pemotongan, mengikuti Coretax. */
export type DocStatus = 'DRAFT' | 'SUBMITTED' | 'ISSUED' | 'CANCELLED';

/** Tab daftar pada modul eBupot. */
export type DocTab = 'BELUM_TERBIT' | 'TELAH_TERBIT' | 'TIDAK_VALID';

export function tabOf(status: DocStatus): DocTab {
  if (status === 'ISSUED') return 'TELAH_TERBIT';
  if (status === 'CANCELLED') return 'TIDAK_VALID';
  return 'BELUM_TERBIT';
}

/** Sepuluh jenis dokumen pada modul eBupot (slide 65). */
export type BupotKind =
  | 'BPPU'   // Bukti Potong Pajak Unifikasi
  | 'BPNR'   // Bukti Potong Non Residen
  | 'BPSS'   // Bukti Potong Penyetoran Sendiri
  | 'BPDGG'  // Bukti Pemotongan Secara Digunggung
  | 'BP21'   // Final & Tidak Final Selain Pegawai Tetap
  | 'BP26'   // PPh Pasal 26 bagi WP Luar Negeri
  | 'BPA1'   // Masa Pajak Terakhir A1
  | 'BPA2'   // Masa Pajak Terakhir A2
  | 'BPMP'   // Bulanan Pegawai Tetap dengan TER
  | 'DOKLAIN'; // Dokumen yang dipersamakan

export interface TaxEntity {
  /** NPWP 16 digit. */
  tin: string;
  name: string;
  address: string;
  /** NITKU pusat selalu berakhiran 000000. */
  nitkuPusat: string;
}

export interface Tku {
  nitku: string;          // 22 digit: NPWP16 + 6 digit subunit
  entityTin: string;
  jenis: string;          // Kantor Cabang, Gudang, Unit Pemasaran, dst.
  nama: string;
  deskripsi: string;
  kluKode: string;
  kluDeskripsi: string;
  alamat: string;
  /** NIK 16 digit para PIC. Pusat hanya boleh 1 PIC, TKU boleh banyak. */
  picNiks: string[];
}

export interface Person {
  nik: string;            // 16 digit, jadi ID pengguna
  nama: string;
  alamat: string;
  negara: string;
  npwp16?: string;
  /** false bila NIK tidak padan -> memicu sentinel 9990000000999000 */
  padan: boolean;
}

/** Penugasan role: satu orang, satu badan, opsional dibatasi satu TKU. */
export interface RoleAssignment {
  id: string;
  personNik: string;
  entityTin: string;
  role: RoleCode;
  /** null = pihak terkait pusat (lihat semua TKU). Terisi = PIC TKU (terbatas). */
  scopeNitku: string | null;
}

export interface SignatureLog {
  provider: 'KODE_OTORISASI_DJP' | 'SERTIFIKAT_ELEKTRONIK';
  signerNik: string;
  signedAt: string;
}

/** Bentuk umum seluruh bukti pemotongan. Detail per jenis ada di `fields`. */
export interface BupotDoc {
  id: string;
  kind: BupotKind;
  entityTin: string;
  status: DocStatus;
  /** Nomor bupot, terbit hanya saat status ISSUED. */
  withholdingNumber: string | null;
  taxPeriodMonth: number;
  taxPeriodYear: number;
  /** NIK/NPWP penerima penghasilan. */
  counterpartTin: string;
  counterpartName: string;
  taxObjectCode: string;
  gross: number;
  rate: number;
  withheld: number;
  /** NITKU tempat pemotongan dilakukan. Dasar isolasi data antar cabang. */
  idPlaceOfBusinessActivity: string;
  createdByNik: string;
  createdAt: string;
  signature: SignatureLog | null;
  cancelledAt: string | null;
  fields: Record<string, unknown>;
}

export type SptKind = 'PPH_21_26' | 'PPH_UNIFIKASI';

/**
 * Lima status persis lima menu di sidebar "Surat Pemberitahuan (SPT)"
 * pada panduan Coretax: Konsep SPT, SPT Menunggu Pembayaran, SPT Dilaporkan,
 * SPT Ditolak, SPT Dibatalkan.
 */
export type SptStatus = 'KONSEP' | 'MENUNGGU_PEMBAYARAN' | 'DILAPORKAN' | 'DITOLAK' | 'DIBATALKAN';
export type SptModel = 'NORMAL' | 'PEMBETULAN';

/** Baris manual pada tabel B/C halaman utama, mengikuti slide 121-122. */
export interface SptManualRows {
  /** [14]/[17] Pembayaran PPh yang dipotong & dibayar selain mekanisme LS. */
  nonLsPayment: number;
  /** [15] Pembayaran PPh dengan SP2D, khusus instansi pemerintah. */
  sp2d: number;
  /** [16]/[18] PPh Ditanggung Pemerintah (DTP). */
  dtp: number;
  /** Item 5: PPh yang dibayar pada SPT yang diperbaiki. Hanya untuk Pembetulan. */
  paidOnCorrectedReturn: number;
}

export function emptyManualRows(): SptManualRows {
  return { nonLsPayment: 0, sp2d: 0, dtp: 0, paidOnCorrectedReturn: 0 };
}

export interface BillingInfo {
  kodeBilling: string;
  kapKjs: string;
  masaPajak: string; // MM-YYYY
  nominal: number;
  createdAt: string;
  /** Kode billing berlaku 48 jam sejak diterbitkan, meniru Coretax. */
  expiresAt: string;
}

export interface Declaration {
  agreed: boolean;
  signedAs: 'TAXPAYER' | 'REPRESENTATIVE';
  signerName: string;
}

export interface SptDoc {
  id: string;
  kind: SptKind;
  model: SptModel;
  pembetulanKe: number;
  entityTin: string;
  taxPeriodMonth: number;
  taxPeriodYear: number;
  status: SptStatus;
  manualArticle21: SptManualRows;
  manualArticle26: SptManualRows;
  declaration: Declaration;
  signature: SignatureLog | null;
  billing: BillingInfo | null;
  createdAt: string;
  submittedAt: string | null;
  rejectedReason: string | null;
  cancelledAt: string | null;
}

/** Sesi aktif: siapa yang login dan sedang mewakili badan mana (impersonating). */
export interface Session {
  personNik: string;
  personName: string;
  impersonatingTin: string | null;
  activeNitku: string | null;
  loggedInAt: string;
}

/**
 * Lima penyedia sertifikat digital yang muncul pada dropdown "Jenis
 * Sertifikat Digital" (slide 20). Kode Otorisasi DJP memakai Passphrase;
 * empat lainnya adalah provider PSrE yang memakai ID Penandatangan (Signer ID).
 */
export type CertificateProvider = 'BRIN' | 'BSSN' | 'KODE_OTORISASI_DJP' | 'PERURI' | 'PRIVY_ID';

export interface SigningCredential {
  provider: CertificateProvider;
  /** Diisi bila provider adalah salah satu PSrE (bukan Kode Otorisasi DJP). */
  signerId: string | null;
  /** Diisi hanya bila provider adalah Kode Otorisasi DJP. */
  passphrase: string | null;
  bpeNumber: string;
  requestedAt: string;
  issuedAt: string;
}

/**
 * Identitas Orang Pribadi yang sedang login (Main Account), terpisah dari
 * `Person` yang menyimpan data pegawai/subjek pemotongan. Field ini yang
 * dipakai formulir Permohonan Kode Otorisasi/Sertifikat Digital (slide 17-22)
 * — permohonan itu hanya berlaku untuk Main Account, tidak untuk Badan yang
 * sedang diwakili.
 */
export interface MainAccountProfile {
  nik: string;
  nama: string;
  alamat: string;
  email: string;
  phone: string;
  signingCredential: SigningCredential | null;
}

export function emptyMainAccountProfile(nik: string, nama: string): MainAccountProfile {
  return { nik, nama, alamat: '', email: '', phone: '', signingCredential: null };
}

/**
 * Pihak Terkait & PIC (slide 23-33, "Penggantian PIC"). Berbeda dari PIC TKU
 * (`Tku.picNiks`, yang mengatur siapa PIC per Tempat Kegiatan Usaha), ini
 * adalah PIC tingkat Badan itu sendiri — satu-satunya orang yang punya akses
 * penuh mengelola seluruh fitur Coretax milik Badan tersebut dan menjadi
 * default penandatangan. Diakses lewat Informasi Umum → Pihak Terkait pada
 * akun Badan.
 */
export type RelatedPartyKind = 'RELATED_PERSON' | 'RELATED_TAXPAYER';
export type RelatedPersonRole = 'DIREKTUR' | 'KOMISARIS' | 'PEMEGANG_SAHAM' | 'WAKIL' | 'LAINNYA';

export interface RelatedParty {
  id: string;
  entityTin: string;
  kind: RelatedPartyKind;
  role: RelatedPersonRole;
  personNik: string;
  personName: string;
  nationality: string;
  countryOfOrigin: string;
  email: string;
  phone: string;
  passportNumber: string;
  /** "Apakah Penanggung Jawab" — hanya satu yang boleh true per Badan. */
  isPic: boolean;
  validFrom: string;  // dd-mm-yyyy
  validTo: string | null;
}
