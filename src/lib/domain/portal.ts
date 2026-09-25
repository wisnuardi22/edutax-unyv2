import type { Database } from '@/lib/storage/db';

/**
 * Identitas contoh persis slide 15-16 panduan: RAKA sebagai Main Account.
 * Nama badan sengaja DIGANTI dari "PT NYA RAKA" (jelas nama plesetan/
 * placeholder ala DJP) menjadi nama perusahaan yang terasa sungguhan, sesuai
 * permintaan eksplisit — NPWP-nya tetap sama seperti contoh (0012345678910000).
 */
export const MAIN_ACCOUNT_SEED = { nik: '3271022601770007', name: 'RAKA' };

export const PRACTICE_PERSON_SEEDS = [
  {
    nik: '1871121205870009',
    nama: 'Ramda',
    alamat: 'Jl. Pendidikan No. 1, Yogyakarta',
    negara: 'Indonesia',
    email: 'ramda@edutax.ac.id',
    phone: '081234567890',
    gender: 'Pria',
    jabatan: 'Staf Keuangan',
    ptkp: 'K/0',
    statusPegawai: 'Pegawai Tetap',
    nip: '198507012010011001',
    golongan: 'IIIa',
    employerTin: '0012345678910000',
  },
  {
    nik: '3404051503890002',
    nama: 'Siti Nurhaliza',
    alamat: 'Jl. Kaliurang No. 12, Sleman',
    negara: 'Indonesia',
    email: 'siti.nurhaliza@edutax.ac.id',
    phone: '081234567891',
    gender: 'Wanita',
    jabatan: 'Kepala Bagian Umum',
    ptkp: 'K/1',
    statusPegawai: 'PNS',
    nip: '198903152012022002',
    golongan: 'IIIb',
    employerTin: '0012345678910000',
  },
  {
    nik: '3471081108920003',
    nama: 'Budi Santoso',
    alamat: 'Jl. Malioboro No. 45, Yogyakarta',
    negara: 'Indonesia',
    email: 'budi.santoso@edutax.ac.id',
    phone: '081234567892',
    gender: 'Pria',
    jabatan: 'Staf IT',
    ptkp: 'TK/0',
    statusPegawai: 'Pegawai Tetap',
    nip: '199208112015011003',
    golongan: 'IIa',
    employerTin: '0012345678910000',
  },
  {
    nik: '3372022009910004',
    nama: 'Dewi Kusuma',
    alamat: 'Jl. Slamet Riyadi No. 78, Surakarta',
    negara: 'Indonesia',
    email: 'dewi.kusuma@edutax.ac.id',
    phone: '081234567893',
    gender: 'Wanita',
    jabatan: 'Bendahara',
    ptkp: 'TK/0',
    statusPegawai: 'Pegawai Tetap',
    nip: '199109202016022004',
    golongan: 'IIIa',
    employerTin: '0012345678910000',
  },
  {
    nik: '3578040207880005',
    nama: 'Ahmad Fauzi',
    alamat: 'Jl. Diponegoro No. 5, Surabaya',
    negara: 'Indonesia',
    email: 'ahmad.fauzi@edutax.ac.id',
    phone: '081234567894',
    gender: 'Pria',
    jabatan: 'Kepala Divisi Operasional',
    ptkp: 'K/2',
    statusPegawai: 'PNS',
    nip: '198804072009011005',
    golongan: 'IVa',
    employerTin: '0012345678910000',
  },
  {
    nik: '3216091412870006',
    nama: 'Rina Marlina',
    alamat: 'Jl. Ahmad Yani No. 23, Bogor',
    negara: 'Indonesia',
    email: 'rina.marlina@edutax.ac.id',
    phone: '081234567895',
    gender: 'Wanita',
    jabatan: 'Staf Administrasi',
    ptkp: 'K/0',
    statusPegawai: 'Pegawai Tetap',
    nip: '198712142011022006',
    golongan: 'IIb',
    employerTin: '0012345678910000',
  },
  {
    nik: '3175051006950007',
    nama: 'Hendra Wijaya',
    alamat: 'Jl. Fatmawati No. 67, Jakarta Selatan',
    negara: 'Indonesia',
    email: 'hendra.wijaya@edutax.ac.id',
    phone: '081234567896',
    gender: 'Pria',
    jabatan: 'Pensiunan Staf',
    ptkp: 'K/0',
    statusPegawai: 'Pensiunan',
    employerTin: '0012345678910000',
  },
  {
    nik: '3273010311930008',
    nama: 'Maya Sari',
    alamat: 'Jl. Braga No. 34, Bandung',
    negara: 'Indonesia',
    email: 'maya.sari@edutax.ac.id',
    phone: '081234567897',
    gender: 'Wanita',
    jabatan: 'Konsultan Pajak',
    ptkp: 'TK/0',
    statusPegawai: 'Bukan Pegawai',
    employerTin: '0012345678910000',
  },
  {
    // Contoh pegawai berstatus asing/WNA — untuk menguji toggle Foreign Employee di BPMP.
    nik: '9500000000000009',
    npwp16: '9500000000000009',
    nama: 'John Smith',
    alamat: 'Apartment Menteng Park, Jakarta Pusat',
    negara: 'Amerika Serikat',
    email: 'john.smith@edutax.ac.id',
    phone: '081234567898',
    gender: 'Pria',
    jabatan: 'Advisor Teknis',
    ptkp: 'TK/0',
    statusPegawai: 'Pegawai Tetap',
    nip: '200001012021011009',
    golongan: '-',
    employerTin: '0012345678910000',
  },
  {
    // Contoh NIK yang SENGAJA tidak padan — untuk menguji sentinel 9990000000999000.
    nik: '3200000000000010',
    nama: 'Contoh Tidak Padan',
    alamat: 'Tidak diketahui',
    negara: 'Indonesia',
    employerTin: '0012345678910000',
    padan: false,
  },
] as const;

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

  for (const person of PRACTICE_PERSON_SEEDS) {
    if (!db.persons.some((p) => p.nik === person.nik)) {
      // Default padan: true, kecuali seed itu sendiri sudah menyatakan false
      // (dipakai untuk contoh "NIK tidak padan" — lihat entri terakhir di atas).
      db.persons.push({ padan: true, ...person });
    }
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
/**
 * Sidebar "Informasi Rincian" di halaman Taxpayer 360, urutan dan daftar
 * persis screenshot revisi (gabungan gambar 1 dan 2): 17 item, tanpa
 * "Kewajiban Perpajakan" yang sempat salah saya masukkan sebelumnya —
 * sebagai gantinya ada "Nomor Identifikasi Eksternal" dan "Jenis Pajak".
 * "Wakil/Kuasa Saya" dan "Wajib Pajak yang Diwakili" sengaja muncul lagi di
 * sini meski juga tampil sebagai pintasan di atas — itu memang begitu pada
 * screenshot aslinya, bukan duplikasi yang salah ketik.
 */
export const INFORMASI_RINCIAN_MENU = [
  { key: 'ikhtisar', label: 'Ikhtisar Profil Wajib Pajak' },
  { key: 'informasi-umum', label: 'Informasi Umum' },
  { key: 'alamat', label: 'Alamat' },
  { key: 'detail-kontak', label: 'Detail Kontak' },
  { key: 'pihak-terkait', label: 'Pihak Terkait' },
  { key: 'pbb', label: 'Objek Pajak Bumi dan Bangunan (PBB)' },
  { key: 'klu', label: 'Klasifikasi Lapangan Usaha (KLU)' },
  { key: 'detail-bank', label: 'Detail Bank' },
  { key: 'unit-keluarga', label: 'Data Unit Keluarga' },
  { key: 'tku', label: 'Tempat Kegiatan Usaha/Sub Unit' },
  { key: 'nomor-id-eksternal', label: 'Nomor Identifikasi Eksternal' },
  { key: 'jenis-pajak', label: 'Jenis Pajak' },
  { key: 'wakil-kuasa', label: 'Wakil/Kuasa Saya' },
  { key: 'wp-diwakili', label: 'Wajib Pajak yang Diwakili' },
  { key: 'verifikasi-2fa', label: 'Verifikasi Dua Langkah' },
  { key: 'permohonan-tertunda', label: 'Permohonan Tertunda' },
  { key: 'semua-permohonan', label: 'Semua Permohonan' },
] as const;

/**
 * Dua pintasan yang tampil DI ATAS "Informasi Detail" pada sidebar, persis
 * screenshot — merujuk key yang sama dengan item di dalam
 * `INFORMASI_RINCIAN_MENU` (bukan tab terpisah), karena memang konten yang
 * dituju sama persis.
 */
export const PROFIL_SHORTCUT_KEYS = ['wakil-kuasa', 'wp-diwakili'] as const;

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
