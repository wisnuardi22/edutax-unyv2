import type { Database } from '@/lib/storage/db';

/**
 * Identitas contoh persis slide 15-16 panduan: RAKA sebagai Main Account.
 * Nama badan sengaja DIGANTI dari "PT NYA RAKA" (jelas nama plesetan/
 * placeholder ala DJP) menjadi nama perusahaan yang terasa sungguhan, sesuai
 * permintaan eksplisit — NPWP-nya tetap sama seperti contoh (0012345678910000).
 */
export const MAIN_ACCOUNT_SEED = { nik: '3271022601770007', name: 'RAKA' };

export const SEED_ENTITY = {
  tin: '0012345678910000',
  name: 'PT KARYA MANDIRI SEJAHTERA',
  address: 'Jl. Sudirman Kav. 25, Jakarta Pusat',
};

/**
 * Mengisi identitas contoh begitu mahasiswa login, supaya dropdown identitas
 * langsung terisi (Main Account + satu Taxpayer) tanpa perlu pendaftaran
 * manual lebih dulu. Dipanggil dari halaman login, dijaga idempoten lewat
 * pengecekan TIN supaya tidak dobel kalau mahasiswa login berkali-kali.
 */
export function ensureSeedData(db: Database) {
  if (!db.entities.some((e) => e.tin === SEED_ENTITY.tin)) {
    db.entities.push({
      tin: SEED_ENTITY.tin,
      name: SEED_ENTITY.name,
      address: SEED_ENTITY.address,
      nitkuPusat: `${SEED_ENTITY.tin}000000`,
    });
    db.tkus.push({
      nitku: `${SEED_ENTITY.tin}000000`,
      entityTin: SEED_ENTITY.tin,
      jenis: 'Pusat',
      nama: SEED_ENTITY.name,
      deskripsi: 'Tempat kegiatan usaha pusat',
      kluKode: '',
      kluDeskripsi: '',
      alamat: SEED_ENTITY.address,
      picNiks: [MAIN_ACCOUNT_SEED.nik],
    });
  }

  // Alamat, email, dan nomor telepon di bawah ini tertulis eksplisit pada
  // slide Permohonan Sertifikat Digital sebagai contoh nilai yang "akan
  // terisi secara otomatis oleh sistem" — disemai di sini supaya formulir
  // itu langsung terisi penuh sejak kunjungan pertama, tanpa mahasiswa harus
  // mengetik alamat/kontak sendiri lebih dulu.
  if (!db.mainAccountProfile) {
    db.mainAccountProfile = {
      nik: MAIN_ACCOUNT_SEED.nik,
      nama: MAIN_ACCOUNT_SEED.name,
      alamat: 'Jl. Jenderal Gatot Subroto Kav. 40-42, Senayan, Kebayoran Baru, Jakarta Selatan',
      email: 'testingctas@kemenkeu.go.id',
      phone: '+6281999760161',
      signingCredential: null,
    };
  }
}

/** Item dropdown navigasi "Portal Saya" di header, persis daftar slide 17. */
export const PORTAL_NAV_MENU: { label: string; href: string }[] = [
  { label: 'Dokumen Saya', href: '/portal/menu/dokumen-saya' },
  { label: 'Notifikasi Saya', href: '/portal/menu/notifikasi-saya' },
  { label: 'Kasus Saya', href: '/portal/menu/kasus-saya' },
  { label: 'Kasus Berjalan Saya', href: '/portal/menu/kasus-berjalan-saya' },
  { label: 'Profil Saya', href: '/portal/menu/profil-saya' },
  { label: 'Aktivasi NIK', href: '/portal/menu/aktivasi-nik' },
  { label: 'Permohonan Kode Otorisasi/Sertifikat Digital', href: '/portal/sertifikat-digital' },
  { label: 'Pengukuhan PKP', href: '/portal/menu/pengukuhan-pkp' },
  { label: 'Pendaftaran Objek Pajak PBB P5L', href: '/portal/menu/pbb-p5l' },
  { label: 'Perubahan Data', href: '/portal/menu/perubahan-data' },
  { label: 'Perubahan Status', href: '/portal/menu/perubahan-status' },
  { label: 'Penghapusan & Pencabutan', href: '/portal/menu/penghapusan-pencabutan' },
];

/** Sidebar "Informasi Rincian" di halaman Taxpayer 360, persis slide 15-16. */
export const INFORMASI_RINCIAN_MENU = [
  { key: 'ikhtisar', label: 'Ikhtisar Profil Wajib Pajak' },
  { key: 'informasi-umum', label: 'Informasi Umum' },
  { key: 'alamat', label: 'Alamat' },
  { key: 'detail-kontak', label: 'Detail Kontak' },
  { key: 'pihak-terkait', label: 'Pihak Terkait' },
  { key: 'pbb', label: 'Objek Pajak Bumi dan Bangunan (PBB)' },
  { key: 'klu', label: 'Klasifikasi Lapangan Usaha (KLU)' },
  { key: 'detail-bank', label: 'Detail Bank' },
  { key: 'unit-keluarga', label: 'Unit Keluarga untuk Kepentingan Perpajakan' },
  { key: 'tku', label: 'Tempat Kegiatan Usaha/Sub Unit' },
  { key: 'kewajiban', label: 'Kewajiban Perpajakan' },
  { key: 'wakil-kuasa', label: 'Wakil/Kuasa' },
  { key: 'wp-diwakili', label: 'Wajib Pajak yang Diwakili/Dikuasakan' },
  { key: 'verifikasi-2fa', label: 'Verifikasi Dua Langkah' },
  { key: 'permohonan-tertunda', label: 'Permohonan Tertunda' },
  { key: 'semua-permohonan', label: 'Semua Permohonan' },
] as const;

export interface Profile360 {
  name: string;
  tin: string;
  address: string;
  mainActivity: string;
  taxpayerType: string;
  taxpayerCategory: string;
  tinStatus: string;
  dateRegistered: string;
  activationDate: string;
  vatStatus: string;
  vatAppointmentDate: string;
  regionalTaxOffice: string;
  localTaxOffice: string;
  supervisorySection: string;
  lastProfileUpdate: string;
}

/**
 * Nilai field di bawah ini sebagian eksplisit tertulis pada slide (Name,
 * Taxpayer Identification Number, Main Activity, Alamat), dan sebagian lagi
 * diisi sendiri karena tertutup kotak anotasi merah pada screenshot asli —
 * ditandai di sini supaya jelas mana yang otentik dan mana yang rekaan wajar.
 */
export function profileForMainAccount(nik: string, name: string): Profile360 {
  return {
    name,
    tin: nik,
    // Alamat ini eksplisit tertulis pada slide Permohonan Sertifikat Digital.
    address: 'Jl. Jenderal Gatot Subroto Kav. 40-42, Senayan, Kebayoran Baru, Jakarta Selatan',
    // Eksplisit tertulis pada slide dropdown identitas.
    mainActivity: 'PEGAWAI SWASTA',
    // Di bawah ini tertutup anotasi pada screenshot asli — diisi wajar.
    taxpayerType: 'Orang Pribadi',
    taxpayerCategory: 'Dalam Negeri',
    tinStatus: 'ACTIVE',
    dateRegistered: '15/03/2015',
    activationDate: '20/03/2015',
    vatStatus: 'NON PKP',
    vatAppointmentDate: '-',
    regionalTaxOffice: 'Kanwil DJP Jakarta Selatan II',
    localTaxOffice: 'KPP Pratama Jakarta Kebayoran Baru Tiga',
    supervisorySection: 'Seksi Pengawasan dan Konsultasi I',
    lastProfileUpdate: '31/10/2024',
  };
}

export function profileForEntity(tin: string, name: string, address: string): Profile360 {
  // Field "Name" pada slide untuk Badan tertulis "NYA RAKA" (tanpa awalan PT),
  // jadi awalan "PT " dilepas di sini agar pola sama persis dengan aslinya.
  const displayName = name.replace(/^PT\s+/i, '');
  return {
    name: displayName,
    tin,
    address,
    mainActivity: 'PERDAGANGAN BESAR BERBAGAI MACAM BARANG',
    taxpayerType: 'Badan',
    taxpayerCategory: 'Dalam Negeri',
    tinStatus: 'ACTIVE',
    dateRegistered: '10/01/2018',
    activationDate: '15/01/2018',
    vatStatus: 'PKP',
    vatAppointmentDate: '15/01/2018',
    regionalTaxOffice: 'Kanwil DJP Jakarta Selatan II',
    localTaxOffice: 'KPP Pratama Jakarta Kebayoran Baru Tiga',
    supervisorySection: 'Seksi Pengawasan dan Konsultasi II',
    lastProfileUpdate: '31/10/2024',
  };
}
