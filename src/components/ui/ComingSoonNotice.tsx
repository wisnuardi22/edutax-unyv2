import Link from 'next/link';

/** Placeholder untuk jenis dokumen eBupot yang belum dibangun — lihat README "Urutan pengerjaan berikutnya". */
export function ComingSoonNotice({ title, note }: { title: string; note?: string }) {
  return (
    <section className="rounded-card bg-white p-5 shadow-card">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-3 rounded-md border border-line bg-canvas px-3 py-2 text-[13px] text-ink-muted">
        Modul ini belum dibangun pada tahap praktikum saat ini. {note}
        Lihat bagian &quot;Urutan pengerjaan berikutnya&quot; pada README repo untuk status
        lengkapnya, atau coba{' '}
        <Link href="/ebupot/bpmp" className="text-brand-700 underline">Bukti Pemotongan Bulanan Pegawai Tetap</Link>
        {' '}dan{' '}
        <Link href="/ebupot/bp21" className="text-brand-700 underline">BP21</Link>
        {' '}yang sudah tersedia.
      </p>
    </section>
  );
}
