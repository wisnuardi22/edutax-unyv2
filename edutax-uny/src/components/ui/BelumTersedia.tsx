/**
 * Layar untuk modul yang belum dikerjakan. Ditulis sebagai arahan, bukan
 * permintaan maaf: mahasiswa perlu tahu apa yang bisa dikerjakan sekarang.
 */
export function BelumTersedia({ judul, tahap }: { judul: string; tahap: string }) {
  return (
    <section className="rounded-card bg-white p-8 shadow-card">
      <h1 className="text-lg font-semibold">{judul}</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-muted">
        Modul ini dibuka pada {tahap}. Sementara ini kerjakan Manajemen Akses dan modul
        Bukti Pemotongan Bulanan Pegawai Tetap terlebih dahulu.
      </p>
    </section>
  );
}
