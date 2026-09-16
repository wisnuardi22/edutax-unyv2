import { notFound } from 'next/navigation';
import { PORTAL_NAV_MENU } from '@/lib/domain/portal';
import { BelumTersedia } from '@/components/ui/BelumTersedia';

/**
 * Handler generik untuk item dropdown "Portal Saya" yang belum dibangun
 * penuh (Dokumen Saya, Notifikasi Saya, dst. — lihat PORTAL_NAV_MENU).
 * "Permohonan Kode Otorisasi/Sertifikat Digital" tidak lewat sini karena
 * sudah punya halaman sendiri di /portal/sertifikat-digital.
 */
export default function PortalMenuStubPage({ params }: { params: { slug: string } }) {
  const item = PORTAL_NAV_MENU.find((m) => m.href === `/portal/menu/${params.slug}`);
  if (!item) notFound();
  return <BelumTersedia judul={item!.label} tahap="tahap pengembangan berikutnya" />;
}
