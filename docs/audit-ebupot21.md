# Audit kesesuaian E-Bupot 21

> Audit awal sebelum perbaikan. Lihat [hasil perbaikan](perbaikan-ebupot21.md) untuk status terbaru.

Tanggal: 29 September 2026.
Acuan: E-Bupot 21.pdf, 79 halaman, berkas yang diberikan pengguna. Nomor halaman di laporan ini adalah nomor halaman PDF (1-79).

## Kesimpulan

**Belum sepenuhnya sesuai.** Struktur BPMP, BP21, BPA2, dan SPT sudah tersedia. Namun terdapat kesalahan perhitungan, penyimpanan, dan pemetaan lampiran yang mengubah hasil praktikum. Prioritas utama adalah TER BPMP, integrasi BPA2 ke SPT, dan pemulihan data BPA2 saat edit.

## Metode dan batas pemeriksaan

- Membaca teks semua 79 halaman PDF serta gambar halaman 10, 19, 26, 40, 41, 49-51, 62, 68, 71, 73, dan 76.
- Menelusuri halaman BPMP/BP21/BPA2, daftar/editor SPT, fungsi perhitungan, impor/ekspor, identitas, login, tanda tangan, dan aturan akses yang terkait.
- Menjalankan fungsi TypeScript asli menggunakan Node untuk mereproduksi contoh angka dan kesalahan BPA2/SPT. Perubahan state React pada kasus edit direproduksi dari pemetaan data di kode; belum diuji melalui klik browser.
- `npm run typecheck` dicoba, tetapi gagal dimulai karena `tsc` belum tersedia. Dependensi proyek belum terpasang. Build dan pengujian browser belum dilakukan; kesamaan visual aplikasi secara menyeluruh belum dapat dinyatakan.
- Audit ini menilai kesesuaian terhadap PDF yang diberikan, bukan verifikasi terhadap seluruh regulasi pajak terbaru. Instruksi operasional di PDF diperlakukan sebagai bahan pembanding.
- Tidak mengubah kode aplikasi. Perubahan yang sudah ada pada `src/lib/domain/portal.ts` dibiarkan.

## Peta cakupan modul

| Bagian PDF | Implementasi | Penilaian |
| --- | --- | --- |
| Login dan impersonating, hlm. 2-4 | Login kelas, pemilih identitas, banner impersonating | Impersonating tersedia; login sengaja disederhanakan menjadi akun kelas |
| BPMP, hlm. 5-21 | Form, autofill, tiga status, edit/hapus, terbit/batal, impor/ekspor | Alur dasar tersedia; perhitungan TER belum sesuai |
| BP21, hlm. 22-34 | Form identitas/pajak/referensi, status, tanda tangan | Contoh tenaga ahli sesuai; validasi dan objek lain belum lengkap |
| BPA2, hlm. 35-46 | Identitas, delapan komponen bruto, perhitungan, tanda tangan, unduh | Form utama tersedia; edit mengubah angka, Get data belum berfungsi |
| NIK tidak terbaca, hlm. 47-54 | Lookup lokal dan konstanta nomor pengganti | Penanganan NIK tak ditemukan belum sesuai |
| SPT Masa, hlm. 55-79 | Wizard, induk, L-IA/L-IB/L-II/L-III, deklarasi, billing, pelaporan | Struktur tersedia; integrasi BPA2 dan beberapa tabel salah/belum lengkap |

## Temuan prioritas tinggi

### 1. TER BPMP belum lengkap; contoh modul menghasilkan pajak yang salah

- PDF hlm. 8-10: K/0, bruto Rp10.000.000, tarif 2%, PPh Rp200.000.
- Hasil fungsi aplikasi: tarif 1%, PPh Rp100.000.
- `src/lib/domain/ter.ts:28`: kategori A/B/C masing-masing hanya berisi lima rentang dan berhenti pada 1%; ada TODO pelengkapan tabel.
- Contoh impor hlm. 19, K/0 dengan bruto Rp40.000.000, menunjukkan tarif 16%; aplikasi menghasilkan 1%.
- Perbaikan: lengkapi tabel TER dan uji contoh serta batas setiap rentang. Kesalahan ini turut memengaruhi jumlah BPMP yang ditarik ke BPA2 dan SPT.

### 2. L-IB memakai BPMP dan dibatasi Desember

- PDF hlm. 38 dan 66-68: masa terakhir dapat terjadi saat pegawai berhenti; L-IB menampilkan BPA1/BPA2 dan kurang/lebih potong masa terakhir.
- `src/app/(portal)/spt/[id]/page.tsx:76,275-285`: hanya menganggap bulan 12 sebagai masa terakhir, lalu memasukkan `bpmpRows`.
- Dampak: BPA2 yang berakhir Oktober tidak muncul; pada Desember yang tampil justru data bulanan BPMP.
- Perbaikan: bentuk L-IB dari bukti tahunan terbit yang berakhir pada masa SPT, dengan bruto masa terakhir dan nilai kurang/lebih potong, bukan bruto/pajak tahunan.

### 3. BPA2 tidak masuk resume PPh Pasal 21

- PDF hlm. 43, 61-62, 68: penerbitan BPA2 terhubung dengan SPT dan rekonsiliasi masa terakhir.
- `src/lib/domain/sptCalc.ts:10`: `ARTICLE_21_KINDS` hanya BPMP, BP21, BPA1.
- Uji satu BPA2 terbit: resume tetap nol meskipun BPA2 mempunyai nilai kurang/lebih potong.
- Perbaikan: integrasikan rekonsiliasi BPA2. Jangan sekadar menambahkan jenis BPA2 lalu menjumlahkan `withheld`, karena field itu menyimpan pajak slip tahunan, sedangkan L-IB memerlukan selisih masa terakhir.

### 4. Buka ulang BPA2 menghilangkan nilai PPh yang sudah dipotong

- PDF hlm. 41 membedakan pajak terutang dalam slip, PPh yang telah dipotong, dan selisih kurang/lebih potong.
- `src/app/(portal)/ebupot/bpa2/page.tsx:190`: edit memakai `setTaxWithheld(doc.withheld)`.
- Baris 236/254 menyimpan `doc.withheld` sebagai `article21TaxLiabilityInThisSlip`, bukan input `taxWithheld`. Input tersebut juga tidak disimpan tersendiri dalam `fields`.
- Reproduksi: bruto Rp110.000.000, 10 bulan, K/0, dipotong Rp3.400.000 menghasilkan pajak slip Rp2.325.000 dan selisih -Rp1.075.000. Saat edit, input berubah menjadi Rp2.325.000 sehingga selisih menjadi nol. Simpan ulang akan menetapkan hasil yang berubah itu.
- Perbaikan: simpan dan pulihkan ketiga nilai secara terpisah.

### 5. NIK yang tidak ditemukan justru dipertahankan

- PDF hlm. 49-51: muncul konfirmasi penggantian menjadi `9990000000999000` dan identitas penerima penghasilan pengganti.
- BPMP baris 170, BP21 baris 173, BPA2 sekitar baris 198 memakai `clean && (!person || person.padan) ? clean : nomorPengganti`.
- Saat `person` tidak ada, `!person` bernilai benar sehingga NIK asli dipertahankan. Pesan dan konstanta pengganti sudah ada, tetapi kondisi ini tidak mengikuti alur PDF.
- BPMP juga hanya mencari `person.nik` saat simpan, padahal autofill menerima `nik` atau `npwp16`.
- Perbaikan: satukan resolusi identitas; bedakan valid, belum padan, dan tak ditemukan; tampilkan konfirmasi dan pertahankan NIK asal untuk penelusuran. Selaraskan NITKU penerima BP21 dengan identitas hasil resolusi.

### 6. Kolom L-III tidak cocok dengan isi baris

- PDF hlm. 73-74 menunjukkan jenis pajak, nomor bukti, tanggal, kode objek, bruto, dan PPh pada kolom masing-masing.
- `src/app/(portal)/spt/[id]/page.tsx:604`: header mempunyai 8 kolom, tetapi baris data hanya 5 sel.
- Nomor bukti muncul di kolom Jenis Pajak; bruto di kolom Nomor Bukti; PPh di kolom Tanggal. Tanggal, kode objek, dan posisi nominal yang benar tidak dirender.
- Perbaikan: samakan jumlah dan urutan sel dengan header serta lengkapi kolom sesuai modul.

### 7. Submit dan penerbitan belum memvalidasi data wajib

- Form PDF menandai kolom wajib, antara lain NIK, penghasilan, referensi dokumen, dan NITKU.
- `saveDraft` BPMP/BP21/BPA2 hanya mengecek peran sebelum menyimpan. Tombol Submit memanggil fungsi yang sama tanpa pemeriksaan kelengkapan. Penerbitan juga tidak mengulang validasi isi dokumen.
- BPA2 tidak menolak rentang awal/akhir terbalik atau lintas tahun; input nominal menerima angka negatif. BP21 dapat disubmit dengan nomor/tanggal referensi kosong.
- Perbaikan: bedakan kelonggaran draft dan syarat Submit/Terbitkan; validasi panjang identitas, angka, periode, referensi, dan NITKU.

## Temuan kelengkapan dan kesesuaian lainnya

### 8. L-II belum menampilkan seluruh rincian modul

- PDF hlm. 71: tanggal bukti, kode objek, masa perolehan, kode negara, NITKU, status, dan total juga tersedia.
- `LampiranTahunan` pada editor SPT baris 537 hanya menampilkan NIK, nama, nomor, bruto, dan PPh.
- L-IA/L-II/L-III juga belum mempunyai seluruh filter, jumlah total, ekspor, dan pagination yang terlihat pada screenshot modul.

### 9. Impor BPMP belum mempertahankan seluruh data template

- PDF hlm. 18 menyebut berkas XML; hlm. 19 memperlihatkan kolom termasuk `Rate` dan `WithholdingDate`.
- Template aplikasi diunduh sebagai `.xls` berisi SpreadsheetML. Parser hanya menerima pola `Row/Cell/Data`. PDF tidak menyertakan skema XML, sehingga kompatibilitas dengan berkas asli Coretax belum dapat dibuktikan dari screenshot.
- Pada `bpmp/page.tsx:306` dan seterusnya, `Rate` diabaikan dan dihitung ulang melalui TER yang belum lengkap; `WithholdingDate` tidak disimpan, sementara lampiran menggunakan `createdAt`.
- `TaxObjectName` selalu diset ke objek pertama meskipun kode impor berbeda; mengedit hasil impor dapat mengubah kode objek.
- Perbaikan: uji dengan berkas XML acuan, simpan tanggal pemotongan, dan jaga konsistensi kode/nama objek.

### 10. Tombol Get data BPA2 belum bekerja

- PDF hlm. 41 memperlihatkan pengambilan data slip pemberi kerja sebelumnya.
- `bpa2/page.tsx:578`: tombol tidak mempunyai handler. Angka hanya dapat diisi manual.
- Perbaikan: implementasikan pencarian slip simulasi beserta validasi pemilik/periode, atau beri status belum tersedia secara jelas.

### 11. Deklarasi, tanda tangan SPT, dan unduh billing belum persis modul

- PDF hlm. 75: nama otomatis mengikuti user aktif. Wizard aplikasi memulai `signerName` kosong dan nama tetap dapat diedit bebas; memilih Representative tidak mengisinya otomatis.
- PDF hlm. 76: ada langkah Simpan lalu Konfirmasi Tanda Tangan. `SignDialog` langsung menyediakan konfirmasi.
- PDF hlm. 76-77: billing otomatis terbentuk dan terunduh. Aplikasi membuat objek billing dan menampilkan kartu, tanpa unduh billing otomatis maupun tombol unduh pada kartu.
- Status Menunggu Pembayaran menjadi Dilaporkan tanpa input NTPN sudah dimodelkan melalui tombol Simulasikan Pembayaran.

### 12. Kelebihan pembayaran belum diteruskan antarperiode

- PDF hlm. 62 memuat baris kelebihan pembayaran periode sebelumnya dan keterangan penerusan kelebihan.
- `sptCalc.ts:58` menetapkan `carryForward = 0` untuk semua kasus. Nilai total pembayaran dibatasi minimal nol; pesan pelaporan menyebut nihil untuk semua nilai nonpositif.
- Perbaikan: bedakan nihil dan lebih bayar serta lacak kompensasi antar-SPT.

### 13. Keluaran unduh masih berupa ringkasan

- PDF hlm. 46 dan 78 menyediakan unduh BPA2, induk SPT, dan BPE.
- Tombol tersedia, tetapi memakai tabel HTML dan dialog cetak browser. BPA2 hanya memuat enam baris ringkasan, bukan seluruh rincian form. Ekspor Excel juga berupa HTML berekstensi `.xls`.
- Ini dapat diterima sebagai penyederhanaan praktikum bila memang disepakati, tetapi belum setara dokumen unduhan lengkap. PDF acuan tidak memperlihatkan seluruh isi file BPA2/BPE, sehingga format persis perlu contoh berkas tambahan.

### 14. Objek pajak di luar contoh belum terverifikasi

- `src/lib/domain/bp21.ts` secara eksplisit menyatakan hanya objek tenaga ahli terverifikasi; objek lain adalah perkiraan dan tarif semuanya dipatok 5%.
- `src/lib/domain/bpmp.ts` menandai beberapa kode pensiunan/fasilitas daerah sebagai perkiraan.
- Pilihan fasilitas disimpan, tetapi belum memengaruhi fungsi hitung. Penjelasan pengecualian DTP dalam PDF hlm. 9 juga perlu dipertahankan pada materi praktikum.
- Perbaikan: validasi terhadap referensi resmi sebelum objek tambahan dipakai sebagai kunci jawaban. Audit ini tidak menyimpulkan ketepatan pajak seluruh pilihan tersebut.

## Bagian yang sudah mengikuti contoh utama

- Pemilih Main Account/Taxpayers dan banner impersonating tersedia.
- Menu eBupot memuat jenis yang disebut modul.
- BPMP/BP21/BPA2 memiliki tiga tab Belum Terbit, Telah Terbit, Tidak Valid; draft dan submit berada pada Belum Terbit.
- Edit/hapus draft, penerbitan, pembatalan, nomor saat terbit, dan pemindahan status tersedia dalam kode.
- BP21 dan BPA2 membuka dialog tanda tangan; urutan BPMP langsung terbit mengikuti screenshot PDF hlm. 15-16.
- Autofill identitas lokal, komponen utama BPMP/BP21, dan delapan komponen bruto BPA2 tersedia.
- Contoh BP21 tenaga ahli: Rp2.000.000 x 50% x 5% = Rp50.000, sesuai hlm. 26.
- Wizard SPT tiga langkah, induk otomatis, input SP2D/DTP, tab lampiran, deklarasi, serta simulasi pembayaran tersedia.

## Catatan tentang acuan dan penyederhanaan

- PDF hlm. 39 memberi contoh PTKP TK/0, tetapi hlm. 41 menampilkan pengurang Rp58.500.000. Kode memetakan TK/0 ke Rp54.000.000 dan K/0 ke Rp58.500.000. Contoh angka BPA2 dalam audit memakai K/0 agar sesuai angka pada gambar hlm. 41. Perbedaan internal PDF ini perlu ditetapkan dahulu dalam skenario latihan; jangan menyamakan label secara paksa.
- Login akun kelas, penyimpanan localStorage, dan pembayaran simulasi adalah keputusan desain yang tercatat dalam README, bukan otomatis kesalahan implementasi.
- BP26/BPA1 dan beberapa menu lain masih bertanda Segera. PDF menyebut menu dan lampirannya, tetapi tidak memberikan tutorial pembuatan BP26/BPA1 selengkap BPMP/BP21/BPA2. Ini batas cakupan fitur, bukan alasan untuk menyatakan semua menu tersebut wajib selesai agar tiga tutorial utama dapat dipraktikkan.
- Susunan form aplikasi memakai modal dan grid beberapa kolom, sedangkan banyak screenshot PDF berupa form satu kolom dengan label di kiri. Kesamaan visual akhir tetap perlu pengujian browser.

## Urutan perbaikan

1. Lengkapi TER dan pastikan contoh BPMP Rp10 juta menghasilkan Rp200 ribu.
2. Simpan input PPh dipotong BPA2 secara terpisah; pastikan buka/simpan ulang tidak mengubah hasil.
3. Perbaiki L-IB, resume BPA2, dan penerusan lebih bayar tanpa menghitung pajak tahunan dua kali.
4. Perbaiki resolusi NIK dan validasi Submit/Terbitkan.
5. Perbaiki urutan kolom L-III dan rincian L-II.
6. Lengkapi impor, Get data, deklarasi, unduh billing, dan keluaran dokumen.
7. Setelah dependensi tersedia, jalankan typecheck/build dan praktikum browser dari login sampai pelaporan dengan contoh pada PDF.
