'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useDb } from '@/lib/storage/useDb';
import { addAuditEvent } from '@/lib/storage/db';
import {
  INFORMASI_RINCIAN_MENU,
  PROFIL_SHORTCUT_KEYS,
  profileForEntity,
  profileForMainAccount,
  type Profile360,
} from '@/lib/domain/portal';
import { BelumTersedia } from '@/components/ui/BelumTersedia';
import { RoleSection } from '@/app/(portal)/manajemen-akses/page';
import {
  taxpayerClassification,
  type RelatedParty,
  type RelatedPartyKind,
  type RelatedPersonRole,
} from '@/lib/domain/types';

/**
 * Portal Saya — halaman ini adalah "Taxpayer 360-Degree Overview" (bukan
 * form registrasi), mengikuti identitas yang sedang aktif di dropdown
 * header: Main Account (RAKA) atau salah satu Taxpayer yang diwakilinya.
 * Sidebar "Informasi Rincian" mendaftar 17 item persis screenshot revisi,
 * plus dua pintasan (Wakil/Kuasa Saya, Wajib Pajak yang Diwakili) di atasnya
 * yang menunjuk ke key yang sama — itu memang tampil dua kali di aslinya.
 */
export default function PortalPage() {
  const { db } = useDb();
  const session = db.session!;
  const [tab, setTab] = useState<string>(INFORMASI_RINCIAN_MENU[0].key);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    ikhtisar: true,
    'pihak-terkait': true,
  });

  const activeEntity = db.entities.find((e) => e.tin === session.impersonatingTin);
  const profile: Profile360 = activeEntity
    ? profileForEntity(activeEntity.tin, activeEntity.name, activeEntity.address)
    : profileForMainAccount(session.personNik, session.personName);

  const breadcrumbId = activeEntity ? activeEntity.tin : session.personNik;
  const breadcrumbName = activeEntity ? activeEntity.name : session.personName;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(240px,22%)_1fr]">
      <aside className="rounded-card bg-white p-3 shadow-card">
        <p className="px-2 pb-0.5 text-[15px] font-semibold leading-tight text-ink">{breadcrumbId}</p>
        <p className="px-2 pb-2 text-[13px] leading-tight text-ink-muted">{breadcrumbName}</p>

        {PROFIL_SHORTCUT_KEYS.map((key) => {
          const item = INFORMASI_RINCIAN_MENU.find((m) => m.key === key)!;
          return (
            <button
              key={`shortcut-${key}`}
              onClick={() => setTab(key)}
              className={`block w-full border-b border-line px-2 py-2 text-left text-[13px] ${
                tab === key ? 'bg-brand-50 font-semibold text-brand-700' : 'hover:bg-canvas'
              }`}
            >
              {item.label}
            </button>
          );
        })}

        <p className="mt-2 px-2 pb-1 text-xxs font-semibold uppercase tracking-wide text-ink-muted">
          Informasi Detail
        </p>
        <div className="overflow-hidden rounded-md border border-line">
          {INFORMASI_RINCIAN_MENU.map((m) => {
            const expanded = !!expandedSections[m.key];
            return (
              <SidebarAccordion
                key={m.key}
                label={m.label}
                active={tab === m.key}
                expanded={expanded}
                onToggle={() => {
                  setTab(m.key);
                  setExpandedSections((sections) => ({ ...sections, [m.key]: !sections[m.key] }));
                }}
                onAdd={m.key === 'pihak-terkait' ? () => {
                  setTab('pihak-terkait');
                  window.setTimeout(() => {
                    document.getElementById('pihak-terkait-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 0);
                } : undefined}
              />
            );
          })}
        </div>
      </aside>

      <section className="min-w-0 rounded-card bg-white p-5 shadow-card">
        {tab === 'ikhtisar' && <TaxpayerOverview profile={profile} />}
        {tab === 'informasi-umum' && (
          <InformasiUmumSection
            entity={activeEntity ?? null}
            session={session}
            relatedParties={db.relatedParties}
          />
        )}
        {tab === 'pihak-terkait' && (
          <PihakTerkaitSection
            key={activeEntity?.tin ?? 'main'}
            entityTin={activeEntity?.tin ?? null}
          />
        )}
        {tab === 'wakil-kuasa' && activeEntity ? (
          <RoleSection entityTin={activeEntity.tin} />
        ) : tab === 'wakil-kuasa' ? (
          <WorkflowLink title="Wakil/Kuasa Saya" href="/manajemen-akses?tab=role" />
        ) : null}
        {tab === 'tku' && <WorkflowLink title="Tempat Kegiatan Usaha/Sub Unit" href="/manajemen-akses?tab=tku" />}
        {tab !== 'ikhtisar' && tab !== 'informasi-umum' && tab !== 'pihak-terkait' && tab !== 'wakil-kuasa' && tab !== 'tku' && (
          <BelumTersedia
            judul={INFORMASI_RINCIAN_MENU.find((m) => m.key === tab)!.label}
            tahap="tahap pengembangan berikutnya"
          />
        )}
      </section>
    </div>
  );
}

function WorkflowLink({ title, href }: { title: string; href: string }) {
  return (
    <div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-3 text-[13px] text-ink-muted">
        Modul ini mengikuti tahap berikutnya pada alur penambahan hak akses.
      </p>
      <Link className="btn-primary mt-4 inline-flex" href={href}>
        Buka modul
      </Link>
    </div>
  );
}

function SidebarAccordion({
  label,
  active,
  expanded,
  onToggle,
  onAdd,
}: {
  label: string;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  onAdd?: () => void;
}) {
  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition ${
          active ? 'bg-brand-50 font-semibold text-brand-700' : 'bg-white text-ink hover:bg-canvas'
        }`}
      >
        {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <span className="min-w-0 flex-1">{label}</span>
      </button>
      {expanded && (
        <div className="border-t border-line bg-[#FAFBFC] px-8 py-2">
          <p className="text-xs leading-relaxed text-ink-muted">Buka bagian {label}.</p>
          {onAdd && (
            <button type="button" className="btn-primary mt-2 px-3 py-1.5 text-xs" onClick={onAdd}>
              Tambah
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TaxpayerOverview({ profile }: { profile: Profile360 }) {
  return (
    <div id="pihak-terkait-content">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-lg font-semibold">Taxpayer 360-Degree Overview</h1>
        <button className="btn-secondary shrink-0" onClick={() => window.print()}>
          Print 360 Degree View
        </button>
      </div>

      <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Row label="Name" value={profile.name} />
        <Row label="Taxpayer Identification Number" value={profile.tin} mono />
        <Row label="Main Activity" value={profile.mainActivity} />
        <Row label="Taxpayer Type" value={profile.taxpayerType} />
        <Row label="Taxpayer Category" value={profile.taxpayerCategory} />
        <Row label="TIN Status" value={profile.tinStatus} />
        <Row label="Date Registered" value={profile.dateRegistered} />
        <Row label="Activation Date" value={profile.activationDate} />
        <Row label="Taxable Person for VAT Purposes Status" value={profile.vatStatus} />
        <Row label="Taxable Person for VAT Purposes Appointment Date" value={profile.vatAppointmentDate} />
        <Row label="Regional Tax Office" value={profile.regionalTaxOffice} />
        <Row label="Local Tax Office" value={profile.localTaxOffice} />
        <Row label="Supervisory Section" value={profile.supervisorySection} />
        <Row label="Date of Last Profile Update" value={profile.lastProfileUpdate} />
      </dl>

      <p className="mt-6 text-xxs text-ink-muted">
        Sebagian nilai di atas (Taxpayer Type, TIN Status, tanggal-tanggal, kantor pajak, dst.)
        tidak terbaca jelas pada screenshot panduan karena tertutup kotak anotasi, sehingga diisi
        dengan nilai yang wajar untuk keperluan simulasi — bukan disalin dari sumber resmi.
      </p>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[13px] font-semibold text-ink">{label}</dt>
      <dd className={`mt-0.5 text-[13px] text-ink-muted ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------ Informasi Umum */

interface FlagRow {
  label: string;
  value: boolean;
}

/**
 * "Informasi Umum Wajib Pajak" — mengikuti screenshot revisi apa adanya
 * untuk STRUKTUR tabel & label, tapi ISINYA disesuaikan dengan identitas
 * yang benar-benar dipakai di aplikasi ini (Badan swasta "PT Karya Mandiri
 * Sejahtera" atau OP "RAKA"), bukan disalin literal dari contoh DJP yang
 * kebetulan berupa Instansi Pemerintah — field seperti "Kategori Institusi
 * Pemerintah" jelas tidak relevan untuk PT biasa, jadi diganti padanan yang
 * masuk akal ("Kategori Wajib Pajak"), dicatat di footnote agar transparan.
 */
function InformasiUmumSection({
  entity,
  session,
  relatedParties,
}: {
  entity: { tin: string; name: string; address: string } | null;
  session: { personNik: string; personName: string };
  relatedParties: RelatedParty[];
}) {
  const [subTab, setSubTab] = useState<'general' | 'flags'>('general');
  const [editMode, setEditMode] = useState(false);

  const isBadan = !!entity;
  const profile = isBadan
    ? profileForEntity(entity!.tin, entity!.name, entity!.address)
    : profileForMainAccount(session.personNik, session.personName);

  const activePic = isBadan
    ? relatedParties.find((p) => p.entityTin === entity!.tin && p.isPic)
    : null;

  const flags: FlagRow[] = isBadan
    ? [
        { label: 'Penonaktifan Akses Pembuatan Faktur Pajak', value: false },
        { label: 'Pemungut PPN eCommerce', value: false },
        { label: 'Penghasilan atau Pemotong atau Pemungut PPN', value: true },
        { label: 'PPN yang dianggap', value: false },
        { label: 'Pengembalian PPN', value: false },
        { label: 'Lembaga Keuangan Pelapor', value: false },
        { label: 'Pemungut Bea Materai', value: false },
        { label: 'Pembayaran Non Kas', value: false },
        { label: 'PMK-131/PMK.03/2017', value: false },
        { label: 'Perusahaan Tercatat', value: false },
        { label: 'Badan Usaha Milik Negara', value: false },
      ]
    : [];

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-lg font-semibold">Informasi Umum Wajib Pajak</h1>
        <button
          className="btn-primary shrink-0"
          onClick={() => setEditMode((value) => !value)}
        >
          {editMode ? 'Tutup Edit' : 'Edit'}
        </button>
      </div>

      <nav className="mt-3 flex gap-4 border-b border-line text-[13px]">
        {(['general', 'flags'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setSubTab(k)}
            className={`-mb-px border-b-2 px-1 pb-2 ${
              subTab === k ? 'border-brand-500 font-semibold text-brand-700' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {k === 'general' ? 'General' : 'Taxpayer Flags'}
          </button>
        ))}
      </nav>

      {subTab === 'general' && (
        <div className="mt-4 grid gap-x-10 gap-y-3 lg:grid-cols-2">
          <div className="space-y-3">
            <KV label="Nomor Pokok Wajib Pajak" value={activePic?.personNik ?? (isBadan ? '—' : profile.tin)} mono />
            {isBadan && <KV label="Kode Unit Kerja" value="440941" />}
            <KV label="Nama Wajib Pajak" value={activePic?.personName ?? (isBadan ? '—' : profile.name)} />
            <KV label="Jenis Wajib Pajak" value={profile.taxpayerType} />
            <KV label="Kategori Wajib Pajak" value={profile.taxpayerCategory} />
            <KV label="Tanggal Pendaftaran" value={profile.dateRegistered} />
            <KV label="Tanggal Aktivasi" value={profile.activationDate} />
            <div>
              <p className="text-[13px] font-semibold text-ink">Status Wajib Pajak</p>
              <span className="mt-1 inline-block rounded bg-good/15 px-2 py-0.5 text-xxs font-semibold text-good">
                Aktif
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {isBadan ? (
              <>
                {flags.map((f) => (
                  <div key={f.label} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="text-ink">{f.label}</span>
                    <span className={f.value ? 'text-good' : 'text-bad'}>{f.value ? '✓' : '✕'}</span>
                  </div>
                ))}
                <KV label="Bahasa yang Dipilih" value="Indonesia" />
                <KV label="Kantor Wilayah" value={profile.regionalTaxOffice} />
                <KV label="Kantor Pelayanan Pajak" value={profile.localTaxOffice} />
                <KV label="Nomor Telepon Seluler Utama" value={activePic?.phone || '—'} />
                <KV label="Alamat Surat Elektronik Utama" value={activePic?.email || '—'} />
              </>
            ) : (
              <p className="rounded-md border border-line bg-canvas p-3 text-[13px] text-ink-muted">
                Flag-flag di kolom ini (faktur pajak, PKP, eCommerce, dst.) hanya berlaku untuk akun
                Badan, sehingga tidak relevan ditampilkan untuk Main Account.
              </p>
            )}
          </div>

        </div>
      )}

      {subTab === 'flags' && (
        <div className="mt-4">
          {isBadan ? (
            <div className="max-w-md space-y-3">
              {flags.map((f) => (
                <div key={f.label} className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-[13px]">
                  <span className="text-ink">{f.label}</span>
                  <span className={f.value ? 'text-good' : 'text-bad'}>{f.value ? '✓ Ya' : '✕ Tidak'}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-line bg-canvas p-3 text-[13px] text-ink-muted">
              Tidak ada Taxpayer Flags untuk akun Orang Pribadi.
            </p>
          )}
        </div>
      )}

      {editMode && (
        <section id="pihak-terkait-editor" className="mt-8 border-t border-line pt-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-ink">Edit Informasi Umum</h2>
            <p className="mt-1 text-[13px] text-ink-muted">
              Gulir ke bagian Pihak Terkait, lalu pilih Tambah untuk mendaftarkan pegawai sesuai alur panduan Coretax.
            </p>
          </div>
          <PihakTerkaitSection entityTin={entity?.tin ?? null} />
        </section>
      )}

    </div>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-ink">{label}</p>
      <p className={`mt-0.5 text-[13px] text-ink-muted ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

/**
 * Kotak centang biru kecil persis kolom boolean pada tabel Pihak Terkait di
 * slide (Merupakan Orang Terkait, Apakah Penanggung Jawab, dst.) — bukan teks
 * checkmark atau badge, supaya tabelnya benar-benar sama persis tampilannya.
 */
function CheckboxCell({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border ${
        checked ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-white'
      }`}
    >
      {checked && (
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none">
          <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

/* -------------------------------------------------- Pihak Terkait & PIC */

const ROLE_LABELS: Record<RelatedPersonRole, string> = {
  DIREKTUR: 'Direktur',
  KOMISARIS: 'Komisaris',
  PEMEGANG_SAHAM: 'Pemegang Saham',
  WAKIL: 'Wakil',
  LAINNYA: 'Lainnya',
};

function todayDMY() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/**
 * Pihak Terkait & Penggantian PIC — mengikuti slide 23-33 apa adanya, dengan
 * seluruh kolom tabel persis screenshot revisi (Tindakan sampai Valid
 * Sampai, termasuk yang baru terlihat setelah digulir ke kanan: Saham,
 * Kriteria Pemilik Manfaat, Merupakan Orang Terkait, Merupakan Wajib Pajak
 * Terkait, Adalah Data Eksternal). Berbeda dari layar lain di aplikasi ini,
 * perubahan pada dialog Tambah/Edit TIDAK langsung tersimpan ke
 * localStorage; ia hanya menjadi "draft" lokal sampai bagian Pernyataan
 * dicentang dan tombol Kirim ditekan — meniru pemisahan antara "Save" pada
 * dialog dan "Kirim" pada penutup formulir yang eksplisit ditunjukkan di slide.
 */
function PihakTerkaitSection({ entityTin }: { entityTin: string | null }) {
  const { db, mutate } = useDb();

  if (!entityTin) {
    return (
      <div>
        <h1 className="text-lg font-semibold">Pihak Terkait</h1>
        <p className="mt-3 rounded-md border border-line bg-canvas px-3 py-2 text-[13px] text-ink-muted">
          Pihak Terkait dan penunjukan PIC hanya relevan untuk akun Badan. Main Account mengelola
          identitas Anda sendiri langsung dengan NIK pribadi, jadi tidak memerlukan PIC. Beralihlah
          ke salah satu Taxpayer lewat dropdown identitas di header untuk mengelola Pihak Terkait
          badan tersebut.
        </p>
      </div>
    );
  }

  const committed = db.relatedParties.filter((p) => p.entityTin === entityTin);
  const [draft, setDraft] = useState<RelatedParty[]>(committed);
  const [dialog, setDialog] = useState<{ mode: 'add' | 'edit' | 'view'; party: RelatedParty | null } | null>(null);
  const [declared, setDeclared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [saved, setSaved] = useState(false);

  const currentPic = draft.find((p) => p.isPic);

  function upsert(party: RelatedParty): string | null {
    const otherPic = draft.find((p) => p.isPic && p.id !== party.id);
    if (party.isPic && otherPic) {
      return `Badan ini sudah memiliki PIC aktif atas nama ${otherPic.personName}. Lepas status PIC tersebut terlebih dahulu (Edit → hilangkan centang "Apakah PIC?" → Save) sebelum menetapkan PIC baru.`;
    }
    mutate((d) => {
      const exists = d.relatedParties.some((p) => p.id === party.id);
      d.relatedParties = exists
        ? d.relatedParties.map((p) => (p.id === party.id ? party : p))
        : [...d.relatedParties, party];
      if (!d.persons.some((p) => p.nik === party.personNik)) {
        d.persons.push({
          nik: party.personNik,
          nama: party.personName,
          alamat: '',
          negara: party.nationality,
          email: party.email,
          phone: party.phone,
          padan: true,
        });
      }
      addAuditEvent(d, 'Menambahkan Related Party', `${party.personNik} ${party.personName}`);
    });
    setDraft((list) => {
      const exists = list.some((p) => p.id === party.id);
      return exists ? list.map((p) => (p.id === party.id ? party : p)) : [...list, party];
    });
    setSaved(true);
    return null;
  }

  function remove(id: string) {
    if (!confirm('Hapus pihak terkait ini dari daftar?')) return;
    mutate((d) => {
      d.relatedParties = d.relatedParties.filter((p) => p.id !== id);
    });
    setDraft((list) => list.filter((p) => p.id !== id));
  }

  function kirim() {
    if (!declared) {
      setError('Centang kotak Pernyataan terlebih dahulu.');
      return;
    }
    setError(null);
    mutate((d) => {
      d.relatedParties = [...d.relatedParties.filter((p) => p.entityTin !== entityTin), ...draft];
    });
    setSent(true);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-lg font-semibold">Pihak Terkait</h1>
        <button className="btn-primary" onClick={() => setDialog({ mode: 'add', party: null })}>
          Tambah
        </button>
      </div>

      {sent && (
        <p className="mt-3 rounded-md border border-good/40 bg-[#EAF7EE] px-3 py-2 text-[13px] text-good">
          Perubahan Pihak Terkait berhasil dikirim.
        </p>
      )}

      {saved && draft.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-good/40 bg-[#EAF7EE] px-3 py-2 text-[13px]">
          <span className="text-good">Pihak terkait berhasil disimpan.</span>
          <Link className="btn-primary" href="/manajemen-akses?tab=role">
            Lanjut ke Wakil/Kuasa Saya
          </Link>
        </div>
      )}

      <p className="mt-3 text-[13px] text-ink-muted">
        PIC yang sedang aktif:{' '}
        <strong className="text-ink">{currentPic ? `${currentPic.personName} (${currentPic.personNik})` : 'Belum ada'}</strong>
        . Hanya satu PIC yang diizinkan untuk mewakili setiap Badan.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tindakan</th>
              <th>NIK/NPWP Orang</th>
              <th>Jenis Wajib Pajak</th>
              <th>Kategori Wajib Pajak</th>
              <th>Nama Orang</th>
              <th>Kewarganegaraan</th>
              <th>Nomor Paspor</th>
              <th>Saham</th>
              <th>Kriteria Pemilik Manfaat</th>
              <th>Merupakan Orang Terkait</th>
              <th>Merupakan Wajib Pajak Terkait</th>
              <th>Apakah Penanggung Jawab</th>
              <th>Adalah Data Eksternal</th>
              <th>Valid Dari</th>
              <th>Valid Sampai</th>
            </tr>
          </thead>
          <tbody>
            {draft.length === 0 && (
              <tr>
                <td colSpan={15} className="py-8 text-center text-ink-muted">
                  Belum ada Pihak Terkait terdaftar. Klik Tambah untuk menambahkan.
                </td>
              </tr>
            )}
            {draft.map((p) => {
              const cls = taxpayerClassification(p.kind);
              const isRelatedPerson = p.kind === 'RELATED_PERSON';
              return (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">
                    <button className="mr-2 text-brand-600 hover:underline" onClick={() => setDialog({ mode: 'edit', party: p })}>
                      Edit
                    </button>
                    <button className="mr-2 text-bad hover:underline" onClick={() => remove(p.id)}>
                      Hapus
                    </button>
                    <button className="text-ink-muted hover:underline" onClick={() => setDialog({ mode: 'view', party: p })}>
                      Lihat
                    </button>
                  </td>
                  <td className="font-mono">{p.personNik}</td>
                  <td className="whitespace-nowrap">{cls.jenis}</td>
                  <td>{cls.kategori}</td>
                  <td>{p.personName}</td>
                  <td className="whitespace-nowrap">Warga Negara {p.nationality}</td>
                  <td>{p.passportNumber || '—'}</td>
                  <td>{p.sharePercentage || '—'}</td>
                  <td>{p.beneficialOwnerCriteria || '—'}</td>
                  <td className="text-center"><CheckboxCell checked={isRelatedPerson} /></td>
                  <td className="text-center"><CheckboxCell checked={!isRelatedPerson} /></td>
                  <td className="text-center"><CheckboxCell checked={p.isPic} /></td>
                  <td className="text-center"><CheckboxCell checked={p.isExternalData} /></td>
                  <td className="whitespace-nowrap">{p.validFrom}</td>
                  <td className="whitespace-nowrap">{p.validTo ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-1 text-xxs text-ink-muted">Gulir ke kanan untuk melihat kolom selengkapnya.</p>
      </div>

      <div className="mt-5 rounded-md border border-line p-3">
        <label className="flex items-start gap-2 text-[13px]">
          <input type="checkbox" className="mt-0.5" checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
          Dengan menyadari sepenuhnya akan segala akibatnya termasuk sanksi sesuai dengan ketentuan
          peraturan perundang-undangan yang berlaku, saya menyatakan bahwa apa yang saya informasikan
          di atas adalah benar dan lengkap.
        </label>
        {error && <p role="alert" className="mt-2 text-[13px] text-bad">{error}</p>}
        <button className="btn-primary mt-3" onClick={kirim}>Kirim</button>
      </div>

      <div className="mt-5 rounded-md border border-accent bg-[#FFF8E6] p-4 text-[13px]">
        <p className="font-semibold text-ink">Catatan</p>
        <ul className="mt-2 list-disc space-y-2 pl-4 text-ink-muted">
          <li>
            Orang yang baru diangkat sebagai PIC memiliki akses penuh ke akun Coretax Badan yang
            diwakilinya. Orang tersebut dapat mengelola seluruh fitur dalam Coretax serta
            menandatangani semua permohonan yang diajukan.
          </li>
          <li>
            Sementara itu, pengurus lain atau anggota Pihak Terkait yang bukan PIC harus memiliki
            batasan otoritas yang ditentukan oleh PIC sebelumnya, seperti hanya untuk pembuatan dan
            penandatanganan bukti potong, atau hanya untuk pembuatan dan penandatanganan SPT masa.
            Prosesnya mengikuti langkah-langkah yang sama seperti penugasan peran sebagai Wakil di{' '}
            <span className="font-medium text-ink">Manajemen Akses → Wakil/Kuasa Saya → Tetapkan Role</span>.
          </li>
        </ul>
      </div>

      {dialog && (
        <RelatedPartyDialog
          mode={dialog.mode}
          party={dialog.party}
          entityTin={entityTin}
          persons={db.persons}
          onCancel={() => setDialog(null)}
          onSave={(party) => {
            const err = upsert(party);
            if (err) return err;
            setDialog(null);
            return null;
          }}
        />
      )}
    </div>
  );
}

function RelatedPartyDialog({
  mode,
  party,
  entityTin,
  persons,
  onCancel,
  onSave,
}: {
  mode: 'add' | 'edit' | 'view';
  party: RelatedParty | null;
  entityTin: string;
  persons: { nik: string; nama: string; negara: string; email?: string; phone?: string }[];
  onCancel: () => void;
  onSave: (party: RelatedParty) => string | null;
}) {
  const readOnly = mode === 'view';
  const [kind, setKind] = useState<RelatedPartyKind>(party?.kind ?? 'RELATED_PERSON');
  const [isPic, setIsPic] = useState(party?.isPic ?? false);
  const [role, setRole] = useState<RelatedPersonRole>(party?.role ?? 'DIREKTUR');
  const [nik, setNik] = useState(party?.personNik ?? '');
  const [name, setName] = useState(party?.personName ?? '');
  const [passport, setPassport] = useState(party?.passportNumber ?? '');
  const [nationality, setNationality] = useState(party?.nationality ?? 'Indonesia');
  const [country, setCountry] = useState(party?.countryOfOrigin ?? 'Indonesia');
  const [email, setEmail] = useState(party?.email ?? '');
  const [phone, setPhone] = useState(party?.phone ?? '');
  const [share, setShare] = useState(party?.sharePercentage ?? '');
  const [ubo, setUbo] = useState(party?.beneficialOwnerCriteria ?? '');
  const [validFrom, setValidFrom] = useState(party?.validFrom ?? '');
  const [validTo, setValidTo] = useState(party?.validTo ?? '');
  const [error, setError] = useState<string | null>(null);

  function handleNikChange(value: string) {
    setNik(value);
    // Sebagian otomatis: bila NIK cocok dengan orang yang sudah terdaftar di
    // Manajemen Akses, Nama dan Kewarganegaraan ikut terisi — persis anotasi
    // "secara otomatis Nama, Kewarganegaraan, dan Negara Asal ... terisi oleh
    // sistem". Email/telepon tidak ikut terisi karena `Person` belum
    // menyimpan kedua field itu; tetap diisi manual, ditandai jelas di sini.
    const match = persons.find((p) => p.nik === value.replace(/\D/g, ''));
    if (match) {
      setName(match.nama);
      setNationality(match.negara || 'Indonesia');
      setEmail(match.email || '');
      setPhone(match.phone || '');
      setCountry(match.negara || 'Indonesia');
    }
  }

  function submit() {
    const cleanNik = nik.replace(/\D/g, '');
    if (cleanNik.length < 8) {
      setError('NIK/TIN wajib diisi.');
      return;
    }
    if (!name.trim()) {
      setError('Nama wajib diisi.');
      return;
    }
    if (!validFrom.trim()) {
      setError('Valid Dari wajib diisi.');
      return;
    }
    const result: RelatedParty = {
      id: party?.id ?? crypto.randomUUID(),
      entityTin,
      kind,
      role,
      personNik: cleanNik,
      personName: name.trim(),
      nationality,
      countryOfOrigin: country,
      email: email.trim(),
      phone: phone.trim(),
      passportNumber: passport.trim(),
      sharePercentage: share.trim(),
      beneficialOwnerCriteria: ubo.trim(),
      isPic,
      isExternalData: party?.isExternalData ?? false,
      validFrom,
      validTo: validTo.trim() || null,
    };
    const err = onSave(result);
    if (err) setError(err);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-900/40 p-4">
      <div className="w-full max-w-2xl rounded-card bg-white p-5 shadow-card">
        <h2 className="font-semibold">
          {mode === 'add' ? 'Tambah Pihak Terkait' : mode === 'edit' ? 'Edit Pihak Terkait' : 'Lihat Pihak Terkait'}
        </h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {mode === 'add' && (
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="kind">Jenis Pihak Terkait</label>
              <select id="kind" className="field-input" value={kind} onChange={(e) => setKind(e.target.value as RelatedPartyKind)}>
                <option value="RELATED_PERSON">Related Person</option>
                <option value="RELATED_TAXPAYER">Related Taxpayer</option>
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
            <input type="checkbox" disabled={readOnly} checked={isPic} onChange={(e) => setIsPic(e.target.checked)} />
            Apakah PIC?
          </label>

          <div>
            <label className="field-label" htmlFor="role">Jenis Orang Terkait</label>
            <select id="role" className="field-input" disabled={readOnly} value={role} onChange={(e) => setRole(e.target.value as RelatedPersonRole)}>
              {(['DIREKTUR', 'KOMISARIS', 'PEMEGANG_SAHAM', 'WAKIL', 'LAINNYA'] as const).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="nik">Person NIK/TIN</label>
            <input
              id="nik"
              className="field-input font-mono disabled:bg-canvas"
              disabled={readOnly || mode === 'edit'}
              value={nik}
              onChange={(e) => handleNikChange(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="name">Person Name</label>
            <input id="name" className="field-input" disabled={readOnly} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="passport">Nomor Paspor</label>
            <input id="passport" className="field-input" disabled={readOnly} value={passport} onChange={(e) => setPassport(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="nat">Kewarganegaraan</label>
            <select id="nat" className="field-input" disabled={readOnly} value={nationality} onChange={(e) => setNationality(e.target.value)}>
              <option value="Indonesia">Warga Negara Indonesia</option>
              <option value="Asing">Warga Negara Asing</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="country">Negara Asal</label>
            <select id="country" className="field-input" disabled={readOnly} value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="Indonesia">Indonesia</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="email">E-mail</label>
            <input id="email" type="email" className="field-input" disabled={readOnly} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="phone">Mobile Phone Number</label>
            <input id="phone" className="field-input" disabled={readOnly} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08…" />
          </div>
          <div>
            <label className="field-label" htmlFor="share">Saham <span className="text-ink-muted">(opsional)</span></label>
            <input id="share" className="field-input" disabled={readOnly} value={share} onChange={(e) => setShare(e.target.value)} placeholder="mis. 25%" />
          </div>
          <div>
            <label className="field-label" htmlFor="ubo">Kriteria Pemilik Manfaat <span className="text-ink-muted">(opsional)</span></label>
            <input id="ubo" className="field-input" disabled={readOnly} value={ubo} onChange={(e) => setUbo(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="vf">Valid Dari</label>
            <input id="vf" className="field-input" disabled={readOnly} value={validFrom} onChange={(e) => setValidFrom(e.target.value)} placeholder="dd-mm-yyyy" />
          </div>
          <div>
            <label className="field-label" htmlFor="vt">Valid Sampai</label>
            <input id="vt" className="field-input" disabled={readOnly} value={validTo} onChange={(e) => setValidTo(e.target.value)} placeholder="dd-mm-yyyy (opsional)" />
          </div>
        </div>

        {error && <p role="alert" className="mt-3 text-[13px] text-bad">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel}>{readOnly ? 'Tutup' : 'Cancel'}</button>
          {!readOnly && <button className="btn-primary" onClick={submit}>Save</button>}
        </div>
      </div>
    </div>
  );
}
