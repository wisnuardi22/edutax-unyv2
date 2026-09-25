# EduTax Universitas Negeri Yogyakarta

Simulasi administrasi perpajakan untuk praktikum mahasiswa. Alur, istilah, dan
status dokumen mengikuti panduan Coretax DJP; tampilan memakai palet biru-putih
bergaya SAP Fiori dengan huruf Poppins.

Seluruh data disimpan di `localStorage` browser masing-masing. Tidak ada server
dan tidak ada basis data. Identitas contoh (Main Account "RAKA" dan satu
Taxpayer/Badan) disemai otomatis begitu login — data transaksi (bupot, SPT,
role akses) tetap kosong dan diisi mahasiswa sendiri selama praktikum.

## Menjalankan

```bash
npm install
npm run dev     # http://localhost:3000
```

Akun kelas: `edutax` / `edutax2026`, captcha diketik sesuai gambar.

## Struktur folder

```
edutax-uny/
├── public/
│   └── logo-uny.png
├── src/
│   ├── app/
│   │   ├── layout.tsx              # font Poppins, metadata
│   │   ├── globals.css             # token warna & kelas komponen
│   │   ├── page.tsx                # redirect ke /login
│   │   ├── login/page.tsx          # layar login, memicu ensureSeedData()
│   │   └── (portal)/
│   │       ├── layout.tsx          # penjaga sesi + AppShell
│   │       ├── portal/
│   │       │   ├── page.tsx        # Taxpayer 360-Degree Overview
│   │       │   ├── menu/[slug]/    # stub 11 item menu Portal Saya lainnya
│   │       │   └── sertifikat-digital/  # Permohonan Kode Otorisasi/Sertel
│   │       ├── manajemen-akses/page.tsx
│   │       ├── ebupot/bpmp/page.tsx     # modul BPMP (acuan bentuk modul lain)
│   │       └── spt/                     # daftar SPT + editor /spt/[id]
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx        # header, banner impersonating, bar menu
│   │   │   ├── IdentitySwitcher.tsx# dropdown Main Account/Taxpayers
│   │   │   └── NavDropdown.tsx     # dropdown generik untuk item bar menu
│   │   └── ui/                     # SignDialog, BelumTersedia, dll.
│   └── lib/
│       ├── domain/
│       │   ├── roles.ts            # konstanta ROLE_CTAS_PORTAL_*
│       │   ├── types.ts            # entitas, status dokumen, sesi
│       │   ├── portal.ts           # data contoh (seed) + menu Portal Saya
│       │   ├── ter.ts              # tarif efektif rata-rata PMK-168/2023
│       │   └── sptCalc.ts          # resume Pasal 21/26 dari bupot terbit
│       ├── storage/
│       │   ├── db.ts               # baca/tulis/reset/ekspor localStorage
│       │   └── useDb.ts            # hook sinkronisasi antar tab
│       └── auth/access.ts          # otorisasi jenis pajak x TKU
├── tailwind.config.ts
├── next.config.mjs
└── tsconfig.json
```

## Keputusan yang sudah dikunci

**Status dokumen.** `DRAFT → SUBMITTED → ISSUED → CANCELLED`, dipetakan ke tiga
tab Coretax lewat `tabOf()`: Belum Terbit, Telah Terbit, Tidak Valid. Kirim tidak
sama dengan terbit — dokumen baru masuk lampiran SPT setelah diterbitkan dan
ditandatangani.

**Otorisasi dua sumbu.** Lihat `src/lib/auth/access.ts`. Satu penugasan role
berisi orang, badan, kode role, dan `scopeNitku`. `scopeNitku: null` berarti
pihak terkait pusat yang melihat seluruh TKU; terisi berarti PIC TKU yang hanya
melihat dokumen TKU tersebut.

**Nomor bupot.** Dibuat saat terbit, bukan saat simpan, memakai `counters` per
badan per tahun agar urut dan tidak bentrok.

**NIK tidak padan.** Bila NIK tidak ditemukan pada daftar orang, sistem mencatat
`9990000000999000` seperti Coretax dan menampilkan penjelasan bahwa bukti potong
itu tidak dapat dikreditkan.

## Modul yang sudah selesai

**Pihak Terkait & Penggantian PIC** (`/portal` → sidebar "Pihak Terkait", hanya
untuk akun Badan) — mengikuti slide 23-33 dan screenshot revisi apa adanya:
- Tabel Pihak Terkait dengan **seluruh 15 kolom** persis referensi (termasuk
  yang baru terlihat setelah digulir ke kanan): Tindakan, NIK/NPWP Orang,
  Jenis Wajib Pajak, Kategori Wajib Pajak, Nama Orang, Kewarganegaraan,
  Nomor Paspor, Saham, Kriteria Pemilik Manfaat, Merupakan Orang Terkait,
  Merupakan Wajib Pajak Terkait, Apakah Penanggung Jawab, Adalah Data
  Eksternal, Valid Dari, Valid Sampai. "Jenis/Kategori Wajib Pajak" dan
  "Merupakan Orang/Wajib Pajak Terkait" dihitung otomatis dari `kind`
  (`taxpayerClassification()` di `types.ts`) — bukan input terpisah, karena
  keduanya memang deskripsi klasifikasi pajak orangnya sendiri, berbeda dari
  `role` (Direktur/Komisaris/dst., jabatannya di badan) yang tetap diisi di
  dialog Tambah/Edit tapi tidak jadi kolom tabel, sesuai referensi.
- "Adalah Data Eksternal" selalu tidak tercentang — pada Coretax asli kolom
  ini menandai baris yang masuk lewat integrasi sistem lain, dan tidak ada
  jalur seperti itu di simulasi ini.
- Tombol Tambah membuka dialog dengan dropdown Jenis Pihak Terkait (Related
  Person/Related Taxpayer), checkbox "Apakah PIC?", dropdown Jenis Orang
  Terkait (Direktur/Komisaris/Pemegang Saham/Wakil/Lainnya), field NIK/TIN yang
  auto-mengisi Nama & Kewarganegaraan bila cocok dengan `Person` yang sudah
  terdaftar di Manajemen Akses, Saham dan Kriteria Pemilik Manfaat (keduanya
  opsional), serta Valid Dari (wajib) dan Valid Sampai (opsional).
- **Hanya satu PIC per Badan ditegakkan lewat validasi, bukan auto-swap.**
  Mencentang "Apakah PIC?" pada pihak baru saat PIC lain masih aktif akan
  ditolak dengan pesan yang menuntun ke prosedur yang benar — lepas dulu
  status PIC lama (Edit → hilangkan centang → Save) sebelum menetapkan yang
  baru. Ini sengaja tidak dibuat otomatis, karena PDF mengajarkan urutan dua
  langkah ini sebagai prosedur yang harus dipahami, bukan detail teknis yang
  boleh disembunyikan.
- **Pola draft-lalu-Kirim.** Perubahan pada dialog Tambah/Edit/Hapus hanya
  tersimpan sebagai state lokal komponen sampai kotak Pernyataan dicentang
  dan tombol Kirim ditekan — meniru pemisahan eksplisit antara "Save" pada
  dialog dan "Kirim" pada penutup formulir yang ditunjukkan di slide 30-31.
- **PIC Badan diintegrasikan ke model otorisasi** (`isEntityPic()` di
  `src/lib/auth/access.ts`): siapa pun yang `isPic: true` untuk Badan yang
  sedang diwakili otomatis lolos `hasRole()`, `isPusat()`, `canDraft()`, dan
  `canSign()` tanpa perlu role eksplisit apa pun — persis catatan di slide 33
  bahwa PIC "dapat mengelola seluruh fitur serta menandatangani semua
  permohonan". Ini berbeda dari PIC TKU (`Tku.picNiks`) yang hanya membatasi
  cakupan satu TKU, bukan akses penuh ke seluruh Badan.
- **Tabel 15 kolom, sama persis urutan pada slide** (gulir ke kanan): Tindakan,
  NIK/NPWP Orang, Jenis Wajib Pajak, Kategori Wajib Pajak, Nama Orang,
  Kewarganegaraan, Nomor Paspor, Saham, Kriteria Pemilik Manfaat, Merupakan
  Orang Terkait, Merupakan Wajib Pajak Terkait, Apakah Penanggung Jawab,
  Adalah Data Eksternal, Valid Dari, Valid Sampai. Empat kolom boolean terakhir
  dirender sebagai kotak centang biru kecil (`CheckboxCell`), bukan teks atau
  badge, supaya visualnya sama persis dengan screenshot. "Jenis/Kategori Wajib
  Pajak" dihitung dari `kind` lewat `taxpayerClassification()` — ini
  klasifikasi status pajak orangnya sendiri, berbeda dari `role`
  (Direktur/Komisaris/dst.) yang merupakan jabatannya di badan.
- "Saham" dan "Kriteria Pemilik Manfaat" tidak muncul sebagai input pada
  dialog Tambah di slide 30, jadi diperlakukan sebagai field opsional bebas
  isi (default kosong) alih-alih dipaksa mengikuti aturan bisnis yang tidak
  didokumentasikan. "Adalah Data Eksternal" tidak diekspos sebagai input
  sama sekali — di Coretax asli kolom itu menandai baris yang masuk lewat
  integrasi sistem lain (mis. AHU Online), bukan diketik manual.

**Informasi Umum Wajib Pajak** (`/portal` → sidebar "Informasi Umum") — dua
sub-tab General dan Taxpayer Flags mengikuti slide 24/28 apa adanya: kolom
kiri (NPWP, Nama, Jenis & Kategori Wajib Pajak, Tanggal Pendaftaran/Aktivasi,
Status) dan kolom kanan berisi 11 Taxpayer Flags dengan tanda centang/silang
hijau-merah, plus Bahasa/Kantor Wilayah/Kantor Pelayanan Pajak/kontak utama.
Contoh asli DJP pada slide kebetulan berupa Instansi Pemerintah, sedangkan
Badan contoh aplikasi ini adalah PT swasta — label "Kategori Institusi
Pemerintah" diganti "Kategori Wajib Pajak" karena field itu tidak relevan
untuk badan usaha biasa, dan nilai-nilai flag disesuaikan dengan wajar untuk
perusahaan dagang biasa, dijelaskan lewat catatan kaki di halaman itu sendiri.
Main Account (Orang Pribadi) mendapat versi ringkas tanpa Taxpayer Flags,
karena flag-flag tersebut (faktur pajak, PPN, dst.) memang konsep khusus
Badan. Tombol Edit belum berfungsi (menampilkan pesan "tahap pengembangan
berikutnya") karena slide yang tersedia belum mendokumentasikan alur edit-nya.
Ditambahkan pula baris **"PIC (Penanggung Jawab) Aktif"** yang membaca
`db.relatedParties` — begitu PIC ditentukan lewat tab Pihak Terkait, namanya
langsung terlihat di sini tanpa perlu berpindah tab. Ini bukan field asli
pada slide (panduan aslinya mengarahkan ke submenu Pihak Terkait terpisah
untuk melihat PIC), ditandai jelas di catatan kaki halaman sebagai pintasan
tambahan khusus EduTax.

**Tabel lebar tidak lagi menggeser seluruh halaman.** Tabel Pihak Terkait
15-kolom sebelumnya membuat seluruh halaman (termasuk sidebar) ikut bergeser
horizontal saat tabel di-scroll, karena grid item CSS secara bawaan tidak mau
menyusut di bawah lebar intrinsik kontennya. `min-w-0` sudah ada di kontainer
`<section>`, tapi sebagai lapisan pertahanan kedua `overflow-x-hidden`
ditambahkan eksplisit ke `<body>` di `globals.css` — jadi meskipun ada tabel
lebar di halaman lain nanti, hanya tabelnya sendiri yang bisa digeser
(lewat `overflow-x-auto` pada pembungkusnya), bukan seluruh halaman.

**Informasi Umum Wajib Pajak** (`/portal` → sidebar "Informasi Umum") —
struktur & label mengikuti screenshot revisi apa adanya: tombol Edit, sub-tab
General/Taxpayer Flags, kolom kiri (NPWP, Kode Unit Kerja, Nama, Jenis Wajib
Pajak, Kategori Wajib Pajak, Tanggal Pendaftaran, Tanggal Aktivasi, Status)
dan kolom kanan (11 Taxpayer Flags dengan ikon ✓/✕, Bahasa, Kantor Wilayah,
Kantor Pelayanan Pajak, kontak utama). **Isinya disesuaikan konteks**, bukan
disalin literal — contoh asli DJP kebetulan berupa Instansi Pemerintah
("Kategori Institusi Pemerintah", flag PPN eCommerce, dsb.), sementara Badan
seed aplikasi ini ("PT Karya Mandiri Sejahtera") adalah PT swasta biasa,
sehingga field itu diganti padanan yang relevan ("Kategori Wajib Pajak") dan
dicatat jelas di footnote halaman. Untuk Main Account (RAKA), flag-flag itu
disembunyikan dengan penjelasan karena memang tidak berlaku untuk Orang
Pribadi. Sidebar "Informasi Rincian" juga diperbaiki jadi 17 item persis
screenshot (sebelumnya keliru menyertakan "Kewajiban Perpajakan" yang
ternyata tidak ada di referensi, dan melewatkan "Nomor Identifikasi
Eksternal"/"Jenis Pajak"), plus dua pintasan ("Wakil/Kuasa Saya", "Wajib
Pajak yang Diwakili") yang tampil di atas daftar utama — sengaja muncul dua
kali karena begitu pula tampilan aslinya, bukan duplikasi yang salah ketik.

**Perbaikan tampilan (font & header).** Font Poppins sempat tidak kepakai di
sebagian environment (tampil sebagai serif bawaan browser) karena hanya
dititipkan lewat variabel CSS `--font-poppins` di `<html>`, mengandalkan
Tailwind Preflight meneruskannya secara implisit ke `body`. Sekarang
`poppins.className` diterapkan langsung ke `<body>` di `src/app/layout.tsx`
(pola resmi Next.js untuk kasus begini), plus `font-sans` di-`@apply` eksplisit
pada `body` di `globals.css` sebagai lapisan kedua. Header (`AppShell.tsx`)
juga dilengkapi utility bar penuh persis referensi: ikon muat ulang, pil versi
(punya EduTax sendiri, bukan nomor build DJP), dropdown bahasa, ikon
notifikasi dengan lencana jumlah (dihitung sungguhan dari bupot berstatus
SUBMITTED dan SPT berstatus KONSEP, bukan angka dekoratif), ikon bantuan,
dropdown identitas, teks "Login terakhir", tombol Reset data (tambahan
EduTax), dan tombol Keluar. Sidebar pada halaman Portal Saya, eBupot, dan SPT
juga diubah dari lebar piksel tetap menjadi `minmax()` supaya lebih adaptif
mengikuti lebar layar.

**Data contoh otomatis** (`src/lib/domain/portal.ts`, fungsi `ensureSeedData`)
— dipanggil saat login, bukan menunggu pendaftaran manual. Begitu masuk,
dropdown identitas sudah terisi Main Account **RAKA** (NIK `3271022601770007`)
dan satu Taxpayer **PT Karya Mandiri Sejahtera** (NPWP `0012345678910000`,
NPWP-nya persis contoh PDF; namanya sengaja diganti dari "PT NYA RAKA" yang
jelas plesetan DJP). Formulir Sertifikat Digital juga langsung terisi Alamat/
Email/Telepon sesuai nilai yang tertulis eksplisit di slide, tanpa perlu
diketik dulu — persis anotasi "akan terisi secara otomatis oleh sistem".
Data transaksi lain (bupot, SPT, role akses) tetap kosong, diisi mahasiswa.

**Dropdown identitas & impersonating** (`src/components/layout/IdentitySwitcher.tsx`)
— dropdown di pojok kanan header dengan dua kelompok persis slide 15: Main
Account dan Taxpayers. Memilih salah satu langsung berpindah identitas. Saat
impersonating, banner "You are currently impersonating user: ..." muncul di
atas branding — teks ini sengaja dibiarkan dalam Bahasa Inggris karena begitu
pula pada Coretax asli meski antarmuka disetel id-ID. Di bagian bawah dropdown
ada pintasan "Daftarkan Taxpayer baru" untuk skenario multi-badan di kemudian
hari — ini tambahan EduTax, bukan sesuatu yang wajib dipakai.

**Taxpayer 360-Degree Overview** (`/portal`) — bukan lagi form registrasi,
tapi persis tampilan slide 15-16: sidebar "Informasi Rincian" berisi 16 item
lengkap (Ikhtisar Profil Wajib Pajak, Informasi Umum, Alamat, Detail Kontak,
Pihak Terkait, PBB, KLU, Detail Bank, Unit Keluarga, TKU/Sub Unit, Kewajiban
Perpajakan, Wakil/Kuasa, Wajib Pajak yang Diwakili, Verifikasi Dua Langkah,
Permohonan Tertunda, Semua Permohonan) — semuanya terlihat, tidak dikurangi;
hanya "Ikhtisar Profil Wajib Pajak" yang datanya sudah terisi penuh, sisanya
ditandai belum tersedia. Isi ikhtisar berubah mengikuti identitas aktif (Main
Account menampilkan data OP, Taxpayer menampilkan data Badan) lewat
`profileForMainAccount()`/`profileForEntity()` di `lib/domain/portal.ts`.
Nilai seperti Taxpayer Type, TIN Status, tanggal registrasi, dan kantor pajak
tidak semuanya terbaca jelas pada screenshot panduan (tertutup kotak anotasi
merah) — bagian yang eksplisit tertulis di slide dipertahankan apa adanya,
sisanya diisi nilai yang wajar untuk simulasi, ditandai jelas di kode mana
yang otentik dan mana yang rekaan.

**Menu Portal Saya** — sekarang dropdown asli di bar navigasi atas (bukan tab
dalam halaman), lewat `NavDropdown`, persis slide 17: 12 item, dengan
**Permohonan Kode Otorisasi/Sertifikat Digital** (`/portal/sertifikat-digital`)
diimplementasikan penuh mengikuti slide 17-22:
- Formulir 4 blok: Manajemen Kasus (Kanal & tanggal otomatis), Identitas Wajib
  Pajak (NIK/nama otomatis dari sesi), Detail Kontak (email/telepon sudah
  tersemai sejak awal, lihat "Data contoh otomatis" di atas), dan Rincian
  Sertifikat (dropdown 5 provider; field berubah kondisional — ID
  Penandatangan untuk provider PSrE, Passphrase untuk Kode Otorisasi DJP).
- Verifikasi Identitas dengan Take a Photo/Upload Photo — di praktikum ini
  sekadar mengunggah berkas apa pun sudah dianggap "terverifikasi" karena
  tidak ada pencocokan Dukcapil/Imigrasi sungguhan; ini dinyatakan eksplisit
  di layar, bukan disamarkan.
- Setelah Kirim: pesan "Sertifikat Digital Berhasil Dibuat!" dengan dua
  tombol unduhan (Bukti Tanda Terima, Surat Penerbitan Sertifikat Digital)
  yang menghasilkan file teks sederhana lewat Blob di browser — bukan
  dokumen resmi DJP, dan judul filenya menyebutkan itu.
- Aturan **"hanya bisa dari Main Account"** ditegakkan: bila dropdown header
  sedang menunjukkan sebuah Badan, halaman ini menampilkan penjelasan dan
  mengarahkan kembali ke dropdown identitas, bukan formulirnya.
- Kredensial tersimpan di `db.mainAccountProfile`, model yang sengaja
  dipisah dari `Person` — `Person` merepresentasikan pegawai/subjek
  pemotongan, sedangkan `MainAccountProfile` merepresentasikan identitas OP
  yang sedang login.
- 11 item menu lainnya (Dokumen Saya, Notifikasi Saya, dst.) mengarah ke
  `/portal/menu/[slug]`, sebuah halaman generik yang menampilkan judul item
  tersebut dengan penanda belum tersedia — terlihat lengkap sesuai slide 17,
  belum ada isinya.


**Manajemen Akses** (`/manajemen-akses`) — tiga tab: daftar orang (dengan
penanda NIK padan/tidak padan), Tempat Kegiatan Usaha beserta PIC (pusat
dibatasi satu PIC, TKU boleh banyak, subunit `000000` terkunci untuk pusat),
dan Tetapkan Role memakai `ROLE_GROUPS`.

**eBupot BPMP** (`/ebupot/bpmp`) — tiga tab Belum Terbit/Telah Terbit/Tidak
Valid, formulir dengan tarif TER otomatis, dialog tanda tangan bersama
(`src/components/ui/SignDialog.tsx`), dan penomoran bupot saat terbit.

**SPT Masa PPh 21/26** (`/spt` dan `/spt/[id]`) — mengikuti slide 115-137 apa
adanya:
- Sidebar lima status: Konsep SPT, SPT Menunggu Pembayaran, SPT Dilaporkan,
  SPT Ditolak, SPT Dibatalkan.
- Wizard tiga langkah pembuatan konsep: Pilih Jenis Pajak → Pilih periode →
  Pilih Model SPT (Normal/Pembetulan). Jenis pajak selain PPh 21/26
  dinonaktifkan dengan keterangan "disiapkan pada tahap berikutnya", bukan
  disembunyikan, supaya mahasiswa tahu cakupan penuh Coretax.
- Halaman Utama dengan lima tab: Induk, Identitas Pemotong (otomatis dari
  data badan), B. Article 21 Income Tax dan C. Article 26 Income Tax
  (masing-masing bagian I Withheld enam baris dan bagian II Borne by
  Government), lalu D. Declaration and Signature.
- Baris 1 setiap tabel dijumlahkan otomatis dari bupot berstatus ISSUED pada
  periode yang sama (`src/lib/domain/sptCalc.ts`); baris SP2D, DTP, dan
  "dibayar pada SPT yang diperbaiki" diisi manual sesuai anotasi [14]-[18]
  pada panduan.
- Tombol **Simpan Konsep** dan **Bayar dan Lapor** persis slide 134. Bayar dan
  Lapor membuka dialog tanda tangan; bila kurang bayar, kode billing terbit
  otomatis (slide 135-136) dan SPT pindah ke Menunggu Pembayaran; bila nihil,
  langsung ke Dilaporkan.
- Simulasi pembayaran memindahkan status ke Dilaporkan tanpa input NTPN,
  sesuai catatan pada slide 137.
- Lampiran L-IA (BPMP bulanan), L-IB (khusus masa pajak terakhir, dengan
  keterangan bila diisi di luar Desember), L-II (sub-tab BPA1/BPA2, rekap
  tahunan), dan L-III (sub-tab BP21/BP26). L-II dan L-III akan kosong sampai
  modul pembuatan BPA1, BPA2, BP21, BP26 dibangun — ini konsisten dengan
  keadaan "Tidak ada data yang ditemukan" pada screenshot panduan, bukan bug.

## Urutan pengerjaan berikutnya

1. ~~Terapkan `filterVisibleBupots()`/`canDraft`/`canSign` pada tabel BPMP dan
   halaman SPT.~~ **Selesai.** Lihat juga `canDraftSpt`/`canSignSpt`/
   `filterVisibleSpts` (khusus SPT — hanya pihak terkait pusat, karena SPT
   tidak punya field NITKU) di `src/lib/auth/access.ts`.
2. ~~Salin bentuk formulir BPMP untuk BP21~~ **Selesai, dan sudah disamakan
   ulang setelah BPMP dirombak (item #8b)** — lihat `ebupot/bp21/page.tsx`
   dan tabel Tax Object Name di `lib/domain/bp21.ts`. Tiga hal yang baru
   ketahuan beda saat disandingkan ke BPMP versi terverifikasi, sudah
   ditambal: (a) bug tombol "+ Create" yang tidak `resetForm()` dulu — bisa
   "nyangkut" ke draft terakhir yang diedit; (b) "ID Place of Business
   Activity (Pemotong)" sekarang dropdown TKU sungguhan dari `db.tkus`,
   bukan teks otomatis dari `session.activeNitku`; (c) tabel daftar
   disederhanakan jadi 4 kolom (Tax Period/Withholding Number/Status/
   E-Sign Status) persis slide 83/92, detail lengkap dipindah ke dialog
   "Lihat". Impor Data juga sudah dinaikkan ke XML asli (SpreadsheetML)
   sama seperti BPMP — sebelumnya masih CSV. Satu-satunya sisa gap: kode
   objek pajak selain "Imbalan kepada Tenaga Ahli" masih perkiraan (lihat
   catatan PENTING di `bp21.ts`), karena PDF panduan hanya memberi satu
   contoh eksplisit.
   **BPA2 sekarang juga sudah dibangun lengkap** (lihat `ebupot/bpa2/page.tsx`
   dan `lib/domain/bpa2.ts`) — General Information (Working for a Second
   Employer, Tax Period Start/End, NIP/NRP, Gender, Golongan), Gross Income
   per komponen, dan kalkulasi PPh tahunan progresif Pasal 17 penuh (biaya
   jabatan dibatasi Rp500rb/bulan, PTKP, tarif berjenjang 5-35%), sudah
   diverifikasi cocok persis dengan contoh angka di slide (110jt → net 105jt
   → PKP 46,5jt → PPh 2.325.000). Tombol "Dari BPMP" bisa auto-sum PPh yang
   sudah dipotong bulanan dari `db.bupots` kind BPMP untuk periode yang sama.
   BPA2 IKUT memakai Sign Document (beda dari BPMP, sama seperti BP21) —
   terverifikasi dari urutan screenshot Terbitkan → Sign Document → "Data
   successfully issued". `taxPeriodMonth/Year` di top-level BupotDoc dipakai
   untuk masa AKHIR (bukan awal) supaya otomatis nyambung ke SPT masa yang
   tepat di L-IB — masa awal disimpan di `fields.startMonth/startYear`.
   Satu catatan jujur: PTKP `TK/0` di slide contoh menghasilkan Rp58.500.000,
   padahal tabel PTKP resmi untuk TK/0 adalah Rp54.000.000 (Rp58.500.000 itu
   nilai K/0) — kemungkinan salah ketik di slide aslinya sendiri. Kode ini
   memakai tabel PTKP resmi yang benar, bukan angka di slide yang tidak
   konsisten dengan anotasi teksnya sendiri (lihat catatan PENTING di
   `bpa2.ts`).
   **BPA1, BP26, BPPU, BPNR, BPSS, BPDGG, DOKLAIN masih placeholder**
   ("segera hadir") — link-nya sudah ada di dropdown eBupot (item #5), tapi
   isinya belum dibangun. BPA1 kemungkinan bisa menyalin banyak dari BPA2
   (sama-sama rekap tahunan), tapi field spesifiknya belum pernah terlihat
   di PDF (guide melompat dari BP21 langsung ke BPA2 tanpa merinci BPA1).
3. Hubungkan `db.mainAccountProfile.signingCredential` ke `SignDialog`. Saat
   ini `SignDialog` menerima kata sandi apa saja tanpa memeriksa apakah
   kredensial sudah pernah didaftarkan lewat Permohonan Kode Otorisasi/
   Sertifikat Digital.
4. ~~Filter dropdown "Taxpayers" pada `IdentitySwitcher`~~ **Selesai** — lihat
   `visibleEntities` di `AppShell.tsx`. Aturannya: tampil kalau NIK Anda
   sudah punya PIC/role untuk Badan itu, ATAU Badan itu belum punya PIC sama
   sekali (supaya Badan seed Tahap 1 yang sengaja kosong tetap bisa diakses
   untuk menetapkan PIC pertama kalinya). Taxpayer baru yang didaftarkan
   lewat "Daftarkan Taxpayer baru" otomatis dapat PIC default = pendaftarnya
   sendiri, meniru slide 24 ("Default PIC ... merujuk pada Identitas
   Penanggungjawab" saat registrasi NPWP asli).
5. ~~`ModuleSwitcher` baru stopgap ringan~~ **Selesai, dan lebih baik dari
   rencana awal** — `ModuleSwitcher` dihapus, diganti dropdown "Pilih Modul
   eBupot" sungguhan di `AppShell` (lihat `NavDropdown` +
   `lib/domain/ebupotMenu.ts`), persis menu asli Coretax. `NavDropdown` jadi
   generik (terima prop `href`) supaya bisa dipakai untuk "Portal Saya" dan
   "eBupot" sekaligus.
6. Modul BPPU untuk Unifikasi beserta SPT Masa Unifikasi (Induk, Daftar-I,
   Daftar-II), memakai pola yang sama dengan SPT PPh 21/26.
7. Alur SPT Ditolak dan SPT Dibatalkan belum punya pemicu (trigger) di UI;
   saat ini kedua status hanya siap menampung data bila suatu saat diisi lewat
   simulasi penolakan DJP atau pembatalan oleh Wajib Pajak.
8. ~~Impor XML dan ekspor CSV/Excel/PDF~~ **Selesai untuk BPMP dan BP21** —
   dan setelah dicek ulang lewat 11 screenshot asli EBUPOT MP yang dikirim
   user, ternyata "XML" itu asli SpreadsheetML (Excel 2003 XML Spreadsheet,
   makanya file-nya langsung terbuka jadi tabel di Excel) — bukan CSV yang
   di-ganti-nama. `lib/storage/csv.ts` sekarang punya `toSpreadsheetXml`/
   `downloadXmlTemplate`/`parseSpreadsheetXml` (pakai DOMParser/
   XMLSerializer bawaan browser, tanpa dependency tambahan) dan BPMP memakai
   XML asli ini untuk Impor Data, kolom persis template resmi: `TIN`,
   `TaxPeriodMonth`, `TaxPeriodYear`, `CounterpartOption`,
   `CounterpartPassport`, `CounterpartTin`, `StatusTaxExemption`, `Position`,
   `TaxCertificate`, `TaxObjectCode`, `Gross`, `Rate`,
   `IDPlaceOfBusinessActivity`, `WithholdingDate`. BP21 masih pakai CSV
   (dipertahankan apa adanya, cukup untuk simulasi kelas) — lihat catatan
   PENTING di `csv.ts` soal beda keduanya. Export CSV/Excel/PDF di kedua
   modul masih lewat trik ekspor HTML/dialog cetak browser, bukan library
   `.xlsx`/PDF sungguhan (belum ada di `package.json`).
8b. **BPMP (form acuan) dirombak total setelah dicek ulang terhadap 11
   screenshot asli** yang dikirim user (bukan cuma slide PDF) — ternyata versi
   sebelumnya kehilangan banyak field nyata: **Foreign Employee** (toggle
   Ya/Tidak) + **Passport Number** (muncul kalau Ya), **Address**/**Country**
   (auto dari data pegawai), **Tax Certificate** (dropdown: Tanpa Fasilitas/
   PPh DTP/Fasilitas Lainnya — sebelumnya di-hardcode), **Tax Object Name**
   (dropdown 3 pilihan, meng-auto-isi Tax Article/Tax Object Code — kode
   berubah otomatis kalau Foreign Employee=Ya, cuma "Pegawai Tetap"
   (21-100-01/21-100-32) yang terverifikasi dari screenshot, dua nama objek
   lain masih perkiraan pola, lihat `lib/domain/bpmp.ts`), **ID Place of
   Business Activity** (sebelumnya teks otomatis, sekarang dropdown TKU
   sungguhan dari `db.tkus`), field **Status** ("NORMAL"), icon **edit**
   (pensil) untuk draft, dan judul tab yang benar ("EBUPOT MP ISSUED"/
   "EBUPOT MP INVALID" — bukan terjemahan Indonesia). Tabel daftar juga
   disederhanakan jadi 4 kolom (Tax Period/Withholding Number/Status/ID
   Place of Business Activity) persis screenshot, dengan detail lengkap
   (NIK/Nama/Bruto/Rate/dst) dipindah ke dialog "Lihat" — bukan tabel lebar
   seperti sebelumnya.
9. **Kejutan penting soal PIC/login** (dan sudah dicek ulang lewat
   render gambar slide 15 & 24, bukan cuma teks): slide 15 justru
   mengonfirmasi model EduTax sudah benar — "PIC/Wakil/Kuasa *login* sebagai
   *representative* lalu memilih *role* WP Badan/Orang Pribadi mana yang
   akan diwakili": satu login (RAKA) bisa mewakili banyak Badan asalkan
   *NIK RAKA sendiri* diberi PIC/role di masing-masing Badan itu — persis
   pola "Main Account" + "Taxpayers" pada `IdentitySwitcher`. Bedanya, EduTax
   cuma punya *satu* login bersama sekelas (`login/page.tsx`) — tidak ada
   cara login sebagai NIK lain. Jadi PIC/Role yang diberikan ke NIK selain
   NIK Main Account TIDAK AKAN PERNAH terasa aksesnya oleh siapa pun di
   kelas ini. Ini bukan bug (logic `isEntityPic`/`canDraft`/`canSign` sudah
   benar), tapi gap UX yang bikin bingung — sudah ditambal dengan callout +
   tombol "Ini saya" di dialog Pihak Terkait (`portal/page.tsx`) dan badge
   "Anda" di tabel Perwakilan Saya (`manajemen-akses/page.tsx`). Kalau mau
   benar-benar mendukung multi-siswa-satu-Badan, perlu login per-NIK, bukan
   satu Main Account bersama.
10. **BPMP TIDAK memakai Sign Document** — koreksi penting setelah
    membandingkan urutan 11 screenshot asli: klik "Terbitkan" pada BPMP
    langsung menuju notifikasi "Data successfully issued" TANPA dialog tanda
    tangan di antaranya (beda dari BP21/BPA2 yang memang memakai Sign
    Document). Versi sebelumnya salah menambahkan `SignDialog` ke BPMP —
    sudah dihapus dari `ebupot/bpmp/page.tsx`.
11. **Database pegawai dummy diperluas dari 1 jadi 10 orang** (lihat
    `PRACTICE_PERSON_SEEDS` di `lib/domain/portal.ts`), lengkap dengan
    `gender`, `jabatan`, `ptkp`, `statusPegawai`, `nip`, `golongan` (field
    baru di `Person`) — dipakai untuk auto-fill NIK di BPMP/BP21/BPA2, plus
    satu pegawai WNA (untuk uji toggle Foreign Employee di BPMP) dan satu NIK
    yang sengaja tidak padan (untuk uji sentinel `9990000000999000`). Ketiga
    form eBupot sekarang menampilkan pesan "Data tidak ditemukan" yang
    eksplisit saat NIK 16 digit tidak cocok dengan siapa pun di database,
    bukan diam-diam membiarkan field lain kosong.

## Yang harus dilengkapi sebelum dipakai di kelas

`src/lib/domain/ter.ts` baru memuat sebagian bracket TER sebagai contoh bentuk
data. Lengkapi dari Lampiran PMK-168/2023 dan uji dengan contoh perhitungan di
lampiran tersebut, karena angka inilah yang akan dipelajari mahasiswa.

`src/lib/domain/bp21.ts` menghitung PPh sebagai Bruto × Deemed Net Income% ×
Rate% (bukan flat Bruto × Rate%), persis contoh pada slide. Tapi hanya entri
"Imbalan kepada Tenaga Ahli" (kode 21-100-07, deemed 50%, rate 5%) yang
terverifikasi dari PDF panduan — entri Tax Object Name lainnya masih
perkiraan dan perlu dicocokkan ke referensi resmi (lihat catatan PENTING di
file tersebut) sebelum dipakai menilai ketepatan angka mahasiswa. Field
"ID Place of Business Activity of Income Recipient" (NITKU milik penerima
penghasilan) juga belum ada di data model — baru NITKU pemotong yang dipakai.

## Deploy ke Vercel

```bash
git init && git add . && git commit -m "EduTax UNY: kerangka awal"
git remote add origin https://github.com/<akun>/edutax-uny.git
git push -u origin main
```

Di Vercel: Add New Project, pilih repo ini, framework terdeteksi Next.js, tanpa
variabel lingkungan. Setiap push ke `main` otomatis ter-deploy.

Catatan untuk pengajar: data tersimpan per browser, jadi hasil kerja mahasiswa
tidak saling menimpa meski memakai akun yang sama. Tombol Reset data di header
mengembalikan keadaan kosong, dan `exportDb()` di `src/lib/storage/db.ts` bisa
dipasang sebagai tombol unduh JSON untuk pengumpulan tugas.
