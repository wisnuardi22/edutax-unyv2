'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, RotateCcw } from 'lucide-react';
import { useDb } from '@/lib/storage/useDb';
import { resetDb } from '@/lib/storage/db';
import { PORTAL_NAV_MENU } from '@/lib/domain/portal';
import { IdentitySwitcher } from './IdentitySwitcher';
import { NavDropdown } from './NavDropdown';

/** Susunan menu mengikuti bar navigasi Coretax pada panduan. */
const MENU = [
  { label: 'e-Faktur', href: '/e-faktur' },
  { label: 'eBupot', href: '/ebupot/bpmp' },
  { label: 'Surat Pemberitahuan (SPT)', href: '/spt' },
  { label: 'Pembayaran', href: '/pembayaran' },
  { label: 'Buku Besar', href: '/buku-besar' },
  { label: 'Layanan Wajib Pajak', href: '/layanan' },
  { label: 'Manajemen Akses', href: '/manajemen-akses' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { db, mutate } = useDb();
  const session = db.session;
  const activeEntity = db.entities.find((e) => e.tin === session?.impersonatingTin);

  function logout() {
    mutate((d) => {
      d.session = null;
    });
    router.push('/login');
  }

  function resetPraktikum() {
    if (!confirm('Seluruh data praktikum di browser ini akan dihapus. Lanjutkan?')) return;
    resetDb();
    router.push('/login');
  }

  function selectMain() {
    mutate((d) => {
      if (d.session) {
        d.session.impersonatingTin = null;
        d.session.activeNitku = null;
      }
    });
  }

  function selectEntity(tin: string) {
    mutate((d) => {
      const entity = d.entities.find((e) => e.tin === tin);
      if (d.session && entity) {
        d.session.impersonatingTin = tin;
        d.session.activeNitku = entity.nitkuPusat;
      }
    });
  }

  function addEntity(tinInput: string, nameInput: string, addressInput: string): string | null {
    const cleanTin = tinInput.replace(/\D/g, '');
    if (cleanTin.length !== 16) return 'NPWP harus 16 digit angka.';
    if (!nameInput.trim()) return 'Nama badan/OP wajib diisi.';
    if (db.entities.some((e) => e.tin === cleanTin)) return 'NPWP tersebut sudah terdaftar.';

    mutate((d) => {
      d.entities.push({
        tin: cleanTin,
        name: nameInput.trim(),
        address: addressInput.trim(),
        nitkuPusat: `${cleanTin}000000`,
      });
      d.tkus.push({
        nitku: `${cleanTin}000000`,
        entityTin: cleanTin,
        jenis: 'Pusat',
        nama: nameInput.trim(),
        deskripsi: 'Tempat kegiatan usaha pusat',
        kluKode: '',
        kluDeskripsi: '',
        alamat: addressInput.trim(),
        picNiks: [],
      });
    });
    return null;
  }

  if (!session) return null;

  return (
    <div className="min-h-screen">
      {/*
        Teks banner ini sengaja tetap dalam Bahasa Inggris, persis seperti
        pada slide 16 panduan Coretax — string ini memang tidak diterjemahkan
        pada aplikasi aslinya meskipun bahasa antarmuka disetel ke id-ID.
        Diposisikan di atas branding, karena begitu pula posisinya di aslinya:
        peringatan ini harus selalu terlihat terlepas dari halaman yang dibuka.
      */}
      {activeEntity && (
        <div className="bg-brand-100 px-4 py-1.5 text-center text-[13px] text-brand-800">
          You are currently impersonating user: {activeEntity.name} - {activeEntity.tin}
        </div>
      )}

      <header className="bg-brand-800 text-white">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Image src="/logo-uny.png" alt="" width={30} height={30} className="rounded-full bg-white p-0.5" />
          <span className="font-semibold">
            Edu<span className="text-brand-200">Tax</span>
          </span>
          <span className="rounded bg-white/10 px-2 py-0.5 text-xxs">Simulasi Akademik</span>

          <div className="ml-auto flex items-center gap-3 text-[13px]">
            <IdentitySwitcher
              personNik={session.personNik}
              personName={session.personName}
              entities={db.entities}
              activeEntityTin={session.impersonatingTin}
              onSelectMain={selectMain}
              onSelectEntity={selectEntity}
              onAddEntity={addEntity}
            />
            <button onClick={resetPraktikum} className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-white/10">
              <RotateCcw size={15} /> Reset data
            </button>
            <button onClick={logout} className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-white/10">
              <LogOut size={15} /> Keluar
            </button>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-1 border-t border-white/10 bg-brand-900 px-3 py-1.5 text-[13px]">
          <NavDropdown label="Portal Saya" items={PORTAL_NAV_MENU} />
          {MENU.map((m) => (
            <Link key={m.href} href={m.href} className="rounded px-2.5 py-1.5 hover:bg-white/10">
              {m.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1400px] p-4">{children}</main>
    </div>
  );
}
