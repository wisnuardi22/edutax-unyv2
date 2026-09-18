'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, RotateCcw, RefreshCw, Bell, HelpCircle } from 'lucide-react';
import { useDb } from '@/lib/storage/useDb';
import { addAuditEvent, resetDb } from '@/lib/storage/db';
import { PORTAL_NAV_MENU } from '@/lib/domain/portal';
import { IdentitySwitcher } from './IdentitySwitcher';
import { NavDropdown } from './NavDropdown';

/** Versi aplikasi EduTax sendiri — bukan nomor build Coretax DJP. */
const APP_VERSION = '1.0.0-edutax';

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

function formatLoginTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { db, mutate } = useDb();
  const session = db.session;
  const activeEntity = db.entities.find((e) => e.tin === session?.impersonatingTin);

  // Indikator lonceng notifikasi: jumlah dokumen yang sungguhan menunggu
  // tindakan (bupot SUBMITTED belum terbit, SPT masih KONSEP) — bukan angka
  // dekoratif, supaya ikonnya ada gunanya, bukan cuma tempelan visual.
  const pendingCount =
    db.bupots.filter((b) => b.status === 'SUBMITTED').length +
    db.spts.filter((s) => s.status === 'KONSEP').length;

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
        addAuditEvent(d, 'Impersonating', `${entity.tin} ${entity.name}`);
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
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
          {/* Branding EduTax, menggantikan logo DJP/Reformasi Perpajakan/SIAP. */}
          <div className="flex shrink-0 items-center gap-2.5">
            <Image src="/logo-uny.png" alt="" width={30} height={30} className="rounded-full bg-white p-0.5" />
            <span className="font-semibold">
              Edu<span className="text-brand-200">Tax</span>
            </span>
            <span className="rounded bg-white/10 px-2 py-0.5 text-xxs">Simulasi Akademik</span>
          </div>

          {/*
            Utility bar: susunan dan urutan elemen persis referensi Coretax
            (ikon muat ulang → versi → bahasa → notifikasi → bantuan →
            identitas → login terakhir → keluar), hanya nomor versi dan isi
            notifikasinya milik EduTax sendiri, bukan tiruan data DJP.
          */}
          <div className="ml-auto flex flex-wrap items-center gap-2 text-[13px]">
            <button
              onClick={() => window.location.reload()}
              title="Muat ulang halaman"
              className="rounded p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <RefreshCw size={15} />
            </button>

            <span className="rounded border border-white/15 bg-white/5 px-2 py-1 text-xxs whitespace-nowrap">
              Versi: {APP_VERSION}
            </span>

            <select
              defaultValue="id"
              title="Pemilihan bahasa"
              className="rounded border border-white/15 bg-brand-800 px-2 py-1 text-xxs text-white"
            >
              <option value="id">id-ID</option>
              <option value="en">en-US</option>
            </select>

            <IconBadge icon={Bell} count={pendingCount} label="Notifikasi" />
            <IconBadge icon={HelpCircle} count={0} label="Bantuan" />

            <IdentitySwitcher
              personNik={session.personNik}
              personName={session.personName}
              entities={db.entities}
              activeEntityTin={session.impersonatingTin}
              onSelectMain={selectMain}
              onSelectEntity={selectEntity}
              onAddEntity={addEntity}
            />

            <span className="hidden whitespace-nowrap text-xxs text-white/70 lg:inline">
              Login terakhir: {formatLoginTimestamp(session.loggedInAt)}
            </span>

            <button onClick={resetPraktikum} className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-white/10" title="Khusus EduTax: kosongkan seluruh data praktikum">
              <RotateCcw size={15} /> <span className="hidden sm:inline">Reset data</span>
            </button>
            <button onClick={logout} className="rounded p-1.5 hover:bg-white/10" title="Keluar">
              <LogOut size={17} />
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

      <main className="mx-auto w-full min-w-0 max-w-[1600px] overflow-x-hidden p-2 sm:p-4">{children}</main>
    </div>
  );
}

function IconBadge({
  icon: Icon,
  count,
  label,
}: {
  icon: typeof Bell;
  count: number;
  label: string;
}) {
  return (
    <button title={label} className="relative rounded p-1.5 text-white/80 hover:bg-white/10 hover:text-white">
      <Icon size={16} />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[10px] font-semibold leading-none text-white">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
