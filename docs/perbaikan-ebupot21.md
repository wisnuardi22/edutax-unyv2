# Hasil perbaikan E-Bupot 21

## Perubahan yang sudah diterapkan

- Tabel TER kategori A/B/C lengkap dengan batas atas inklusif. Contoh K/0 bruto Rp10 juta menghasilkan PPh Rp200 ribu.
- BP21 tenaga ahli menggunakan tarif progresif atas 50% bruto. Tarif tidak lagi dipatok 5% untuk semua besar penghasilan.
- BPA2 menyimpan PPh yang sudah dipotong secara terpisah. Nilai draft lama dipulihkan dari pajak slip dikurangi selisih kurang/lebih potong, sehingga buka ulang tidak mengubah angka. PKP dibulatkan ke bawah dalam ribuan rupiah.
- Bruto masa terakhir tersedia untuk L-IB. Get data mengambil slip sebelumnya dengan pemeriksaan penerima, periode, dan hak akses; input manual tetap tersedia.
- L-IB memakai BPA1/BPA2 pada bulan terakhir yang sebenarnya, termasuk Oktober. Resume SPT menggunakan selisih masa terakhir, bukan pajak tahunan penuh.
- L-II dan L-III dilengkapi dengan tanggal, kode objek, periode, negara, NITKU, total, pencarian, ekspor, dan pagination. Posisi kolom L-III diperbaiki.
- Kompensasi lebih bayar mengikuti SPT terakhir yang dilaporkan dan pembetulan terbaru. SPT baru menyimpan salinan data saat tanda tangan agar laporan tidak berubah akibat perubahan bupot berikutnya.
- Nama penandatangan mengikuti pengguna aktif. Tanda tangan SPT menggunakan Simpan lalu Konfirmasi. Billing otomatis diunduh sebagai PDF dan tersedia tombol unduh ulang.
- Unduhan PDF menghasilkan berkas langsung, termasuk rincian penghasilan dan rekonsiliasi BPA2. Template dan ekspor Excel menggunakan XML SpreadsheetML.
- NIK yang tidak ditemukan/belum padan menggunakan nomor pengganti setelah konfirmasi, dengan NIK asal disimpan. Lookup menerima NIK maupun NPWP16.
- Submit/Terbitkan memvalidasi identitas, PTKP, cakupan NITKU, periode, nominal, data kepegawaian, dan referensi. Dokumen Submitted yang belum terbit tetap dapat diedit. BPMP/BP21 draft lama dihitung ulang saat terbit.
- Impor memeriksa tarif TER, mempertahankan tanggal dan objek pajak, serta membaca namespace XML dan sel kosong dengan ss:Index.
- Hidrasi sesi localStorage pada portal diperbaiki.

## Hasil pengujian

| Pemeriksaan | Hasil |
| --- | --- |
| npm test | 9 uji lulus |
| npm run test:e2e | 5 skenario browser Edge lulus |
| npm run typecheck | Lulus |
| npm run build | Lulus, 23 halaman statis dibuat |
| Pemeriksaan visual | Screenshot L-IB dan PDF billing terbaca |

Uji fungsi mencakup contoh modul, seluruh batas TER, pemulihan BPA2 lama, filter masa/status/badan, kompensasi, pembetulan, identitas, dan validasi.

Uji browser mencakup edit/simpan/terbit BPA2, L-IB Oktober, L-II/L-III, deklarasi, billing PDF, pelaporan setelah pembayaran, NIK pengganti, impor XML, dan Get data. Error JavaScript/hidrasi juga diperiksa. Pengujian memakai konteks browser terisolasi dan tidak mengubah data praktikum pengguna.

Untuk mengulang tes browser, jalankan `npm run dev -- --port 3001`, lalu `npm run test:e2e` pada terminal lain. Microsoft Edge perlu terpasang. Alternatif alamat server dapat diberikan melalui TEST_BASE_URL.

## Batas fitur

- Objek BP21 selain tenaga ahli, fasilitas daerah tertentu, kode pensiunan asing, dan fasilitas pajak yang belum terverifikasi ditandai belum tersedia serta tidak dapat diterbitkan. Draft lama tetap disimpan. Input SP2D/DTP pada SPT tetap tersedia.
- XML merupakan format praktikum SpreadsheetML. Kompatibilitas skema XML produksi Coretax memerlukan contoh berkas asli dan belum dinyatakan.
- PDF merupakan dokumen praktikum dengan rincian data, bukan replika persis formulir resmi DJP.
- BP26/BPA1 dan menu lain yang sebelumnya belum dibangun tetap belum tersedia. Tutorial utama PDF berfokus pada BPMP/BP21/BPA2.
- SPT yang sudah ditandatangani sebelum perbaikan belum mempunyai salinan data pelaporan. Input lama yang sudah tertimpa tidak selalu dapat dipulihkan. Tidak ada reset atau penghapusan data praktikum.
- Perbedaan label PTKP pada contoh PDF tidak disalin: TK/0 tetap Rp54 juta dan K/0 Rp58,5 juta.

## Rujukan

- Modul pengguna: E-Bupot 21.pdf, 79 halaman.
- [Buku Cermat Pemotongan PPh Pasal 21 DJP](https://pajak.go.id/sites/default/files/2024-01/Buku%20Cermat%20Pemotongan%20PPh%20Pasal%2021_0.pdf): tabel TER 6.2-6.4, dasar pemotongan bukan pegawai, tarif progresif, dan pembulatan PKP.
- [Lampiran PER-2/PJ/2024](https://stats.pajak.go.id/sites/default/files/Lampiran_PER02PJ2024.pdf): kode 21-100-02 untuk pensiunan berkala dalam negeri.
