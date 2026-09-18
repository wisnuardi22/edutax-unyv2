'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDb } from '@/lib/storage/useDb';
import { addAuditEvent } from '@/lib/storage/db';
import { ROLE_GROUPS, ROLE_LABELS } from '@/lib/domain/roles';
import type { RoleCode } from '@/lib/domain/roles';

/**
 * Manajemen Akses — Tahap 1 praktikum.
 *
 * Tiga hal yang dilatih di sini, mengikuti panduan Coretax:
 *  1. Mendaftarkan orang (NIK 16 digit) yang akan jadi wakil/kuasa.
 *  2. Menambahkan Tempat Kegiatan Usaha beserta PIC-nya. Pusat hanya boleh
 *     punya satu PIC, TKU boleh lebih dari satu.
 *  3. Menetapkan role. Pihak terkait pusat memakai cakupan "Seluruh TKU";
 *     PIC TKU dibatasi pada satu NITKU saja.
 */

type Tab = 'orang' | 'tku' | 'role';

export default function ManajemenAksesPage() {
  const { db, mutate } = useDb();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab: Tab = requestedTab === 'tku' || requestedTab === 'role' ? requestedTab : 'orang';
  const [tab, setTab] = useState<Tab>(initialTab);
  const entityTin = db.session?.impersonatingTin ?? null;

  if (!entityTin) {
    return (
      <p className="rounded-card bg-white p-5 text-sm shadow-card">
        Pilih badan yang Anda wakili di menu Portal Saya sebelum mengatur hak akses.
      </p>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'orang', label: 'Orang & Pihak Terkait' },
    { key: 'tku', label: 'Tempat Kegiatan Usaha' },
    { key: 'role', label: 'Wakil/Kuasa Saya' },
  ];

  return (
    <div className="space-y-4">
      <TutorialPanel entityTin={entityTin} />
      <nav className="flex flex-wrap gap-1 rounded-card bg-white p-2 shadow-card">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded px-3 py-2 text-[13px] ${
              tab === t.key ? 'bg-brand-50 font-semibold text-brand-700' : 'hover:bg-canvas'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <AuditPanel />

      {tab === 'orang' && <PersonSection />}
      {tab === 'tku' && <TkuSection entityTin={entityTin} />}
      {tab === 'role' && <RoleSection entityTin={entityTin} />}
    </div>
  );
}

function AuditPanel() {
  const { db } = useDb();
  const events = [...db.auditTrail].reverse().slice(0, 8);

  return (
    <section className="rounded-card bg-white p-4 shadow-card">
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-ink">Riwayat aktivitas praktikum</summary>
        {events.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-muted">Belum ada aktivitas tercatat.</p>
        ) : (
          <ol className="mt-3 space-y-1.5 text-[13px]">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap gap-x-2 gap-y-0.5 border-b border-line pb-1.5 last:border-0">
                <time className="font-mono text-xxs text-ink-muted">{new Date(event.at).toLocaleString('id-ID')}</time>
                <span className="font-medium text-ink">{event.action}</span>
                <span className="text-ink-muted">{event.context}</span>
              </li>
            ))}
          </ol>
        )}
      </details>
    </section>
  );
}

function TutorialPanel({ entityTin }: { entityTin: string }) {
  const { db } = useDb();
  const related = db.relatedParties.some((p) => p.entityTin === entityTin);
  const assigned = db.roleAssignments.some((a) => a.entityTin === entityTin);
  const hasTku = db.tkus.some((t) => t.entityTin === entityTin && !t.nitku.endsWith('000000'));
  const steps = [
    { label: 'Login', done: !!db.session },
    { label: 'Impersonating akun Badan', done: db.session?.impersonatingTin === entityTin },
    { label: 'Tambah Related Person / Related Taxpayer', done: related },
    { label: 'Wakil/Kuasa Saya → Tetapkan Role', done: assigned },
    { label: 'Opsional: tambah TKU dan PIC TKU', done: hasTku },
  ];
  const current = steps.findIndex((step) => !step.done);
  const progress = steps.filter((step) => step.done).length;

  return (
    <section className="rounded-card border border-brand-200 bg-brand-50 p-4 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-brand-900">Tutorial Penambahan Hak Akses</p>
          <p className="mt-0.5 text-[13px] text-brand-800">Langkah {Math.min(current < 0 ? steps.length : current + 1, steps.length)} dari {steps.length}</p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-700">{progress}/{steps.length} selesai</span>
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step, index) => (
          <li key={step.label} className={`rounded-md border px-2.5 py-2 text-xs ${step.done ? 'border-good/40 bg-good/10 text-good' : index === current ? 'border-accent bg-white font-semibold text-brand-800' : 'border-brand-100 bg-white/60 text-ink-muted'}`}>
            <span className="font-mono">{index + 1}.</span> {step.label}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ orang */

function PersonSection() {
  const { db, mutate } = useDb();
  const [nik, setNik] = useState('');
  const [nama, setNama] = useState('');
  const [alamat, setAlamat] = useState('');
  const [padan, setPadan] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function save() {
    const clean = nik.replace(/\D/g, '');
    if (clean.length !== 16) {
      setError('NIK harus 16 digit angka.');
      return;
    }
    if (db.persons.some((p) => p.nik === clean)) {
      setError('NIK tersebut sudah terdaftar.');
      return;
    }
    setError(null);
    mutate((d) => {
      d.persons.push({ nik: clean, nama: nama.trim(), alamat: alamat.trim(), negara: 'Indonesia', padan });
    });
    setNik(''); setNama(''); setAlamat(''); setPadan(true);
  }

  return (
    <>
      <section className="rounded-card bg-white p-5 shadow-card">
        <h1 className="font-semibold">Daftar orang</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Orang yang didaftarkan di sini bisa dipilih sebagai PIC TKU maupun penerima penghasilan
          pada bukti pemotongan.
        </p>

        <table className="data-table mt-4">
          <thead>
            <tr>
              <th>NIK</th>
              <th>Nama</th>
              <th>Alamat</th>
              <th>NIK padan dengan NPWP</th>
            </tr>
          </thead>
          <tbody>
            {db.persons.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-ink-muted">
                  Belum ada orang terdaftar.
                </td>
              </tr>
            )}
            {db.persons.map((p) => (
              <tr key={p.nik}>
                <td className="font-mono">{p.nik}</td>
                <td>{p.nama}</td>
                <td>{p.alamat}</td>
                <td className={p.padan ? 'text-good' : 'text-bad'}>{p.padan ? 'Padan' : 'Tidak padan'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-card bg-white p-5 shadow-card">
        <h2 className="font-semibold">Tambah orang</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <label className="field-label" htmlFor="pnik">NIK 16 digit</label>
            <input id="pnik" className="field-input font-mono" maxLength={16} value={nik}
              onChange={(e) => setNik(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="pnm">Nama</label>
            <input id="pnm" className="field-input" value={nama} onChange={(e) => setNama(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="pal">Alamat</label>
            <input id="pal" className="field-input" value={alamat} onChange={(e) => setAlamat(e.target.value)} />
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={padan} onChange={(e) => setPadan(e.target.checked)} />
          NIK sudah padan dengan NPWP
          <span className="text-ink-muted">
            — hilangkan centang untuk melatih kasus NIK tidak terbaca di Coretax
          </span>
        </label>
        {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
        <button className="btn-primary mt-4" onClick={save}>Simpan orang</button>
      </section>
    </>
  );
}

/* -------------------------------------------------------------------- tku */

export function TkuSection({ entityTin }: { entityTin: string }) {
  const { db, mutate } = useDb();
  const tkus = db.tkus.filter((t) => t.entityTin === entityTin);
  const [subunit, setSubunit] = useState('');
  const [jenis, setJenis] = useState('Kantor Cabang');
  const [nama, setNama] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [kluKode, setKluKode] = useState('');
  const [kluDeskripsi, setKluDeskripsi] = useState('');
  const [alamat, setAlamat] = useState('');
  const [picNik, setPicNik] = useState('');
  const [error, setError] = useState<string | null>(null);

  function addTku() {
    const sub = subunit.replace(/\D/g, '').padStart(6, '0');
    if (sub === '000000') {
      setError('Subunit 000000 sudah dipakai TKU pusat. Gunakan nomor lain, misal 000001.');
      return;
    }
    const nitku = `${entityTin}${sub}`;
    if (db.tkus.some((t) => t.nitku === nitku)) {
      setError('NITKU tersebut sudah terdaftar.');
      return;
    }
    if (!nama.trim() || !deskripsi.trim() || !kluKode.trim() || !kluDeskripsi.trim()) {
      setError('Jenis TKU, Nama TKU, Deskripsi TKU, KLU TKU, dan Deskripsi KLU TKU wajib diisi.');
      return;
    }
    setError(null);
    mutate((d) => {
      d.tkus.push({
        nitku, entityTin, jenis, nama: nama.trim(), deskripsi: deskripsi.trim(),
        kluKode: kluKode.trim(), kluDeskripsi: kluDeskripsi.trim(), alamat: alamat.trim(), picNiks: [],
      });
      addAuditEvent(d, 'Menambahkan TKU', `${nitku} ${nama.trim()}`);
    });
    setSubunit(''); setNama(''); setDeskripsi(''); setKluKode(''); setKluDeskripsi(''); setAlamat('');
  }

  function addPic(nitku: string) {
    const cleanNik = picNik.replace(/\D/g, '');
    if (cleanNik.length !== 16) {
      setError('NIK PIC TKU harus 16 digit angka.');
      return;
    }
    if (!db.persons.some((p) => p.nik === cleanNik)) {
      setError('NIK belum tersedia sebagai akun latihan atau Pihak Terkait.');
      return;
    }
    mutate((d) => {
      const tku = d.tkus.find((t) => t.nitku === nitku);
      if (tku && !tku.picNiks.includes(cleanNik)) tku.picNiks.push(cleanNik);
      addAuditEvent(d, 'Menambahkan PIC TKU', `${cleanNik} pada ${nitku}`);
    });
    setPicNik('');
    setError(null);
  }

  function togglePic(nitku: string, nik: string) {
    mutate((d) => {
      const t = d.tkus.find((x) => x.nitku === nitku);
      if (!t) return;
      const isPusat = nitku.endsWith('000000');
      if (t.picNiks.includes(nik)) {
        t.picNiks = t.picNiks.filter((n) => n !== nik);
      } else {
        // Pusat hanya boleh punya satu PIC; TKU boleh lebih dari satu.
        t.picNiks = isPusat ? [nik] : [...t.picNiks, nik];
      }
    });
  }

  return (
    <>
      <section className="rounded-card bg-white p-5 shadow-card">
        <h1 className="font-semibold">Tempat Kegiatan Usaha / Sub Unit</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Sejak PMK-81/2024 cabang tidak lagi punya NPWP sendiri. Identitasnya adalah NITKU:
          NPWP 16 digit ditambah 6 digit subunit, dengan pusat selalu 000000.
        </p>

        <div className="mt-4 space-y-3">
          {tkus.map((t) => (
            <article key={t.nitku} className="rounded-md border border-line p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-[13px]">{t.nitku}</span>
                <span className="font-medium">{t.nama || '(tanpa nama)'}</span>
                <span className="rounded bg-brand-50 px-2 py-0.5 text-xxs text-brand-700">{t.jenis}</span>
              </div>
              <p className="mt-1 text-[13px] text-ink-muted">{t.alamat}</p>
              <p className="mt-1 text-[13px] text-ink-muted">KLU: {t.kluKode || '—'} {t.kluDeskripsi && `— ${t.kluDeskripsi}`}</p>

              <p className="mt-3 text-[13px] font-medium">
                PIC TKU {t.nitku.endsWith('000000') && <span className="text-ink-muted">(pusat, maksimal 1 orang)</span>}
              </p>
              <div className="mt-2 flex max-w-xl gap-2">
                <input
                  className="field-input font-mono"
                  maxLength={16}
                  placeholder="NIK PIC TKU 16 digit"
                  value={picNik}
                  onChange={(e) => setPicNik(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addPic(t.nitku)}
                />
                <button className="btn-secondary shrink-0" onClick={() => addPic(t.nitku)}>Tambah PIC TKU</button>
              </div>
              {db.persons.length === 0 ? (
                <p className="mt-1 text-[13px] text-ink-muted">
                  Daftarkan orang terlebih dahulu pada tab Orang &amp; Pihak Terkait.
                </p>
              ) : (
                <div className="mt-1 flex flex-wrap gap-2">
                  {db.persons.map((p) => (
                    <label key={p.nik} className="flex items-center gap-1.5 rounded border border-line px-2 py-1 text-[13px]">
                      <input
                        type="checkbox"
                        checked={t.picNiks.includes(p.nik)}
                        onChange={() => togglePic(t.nitku, p.nik)}
                      />
                      {p.nama || p.nik}
                    </label>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-card bg-white p-5 shadow-card">
        <h2 className="font-semibold">Tambah TKU</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <label className="field-label" htmlFor="sub">Subunit 6 digit</label>
            <input id="sub" className="field-input font-mono" maxLength={6} placeholder="000001"
              value={subunit} onChange={(e) => setSubunit(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="jn">Jenis TKU</label>
            <select id="jn" className="field-input" value={jenis} onChange={(e) => setJenis(e.target.value)}>
              {['Kantor Cabang', 'Gudang', 'Unit Pemasaran', 'Unit Produksi', 'Unit Distribusi', 'Manajemen'].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="tn">Nama TKU</label>
            <input id="tn" className="field-input" value={nama} onChange={(e) => setNama(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="td">Deskripsi TKU</label>
            <input id="td" className="field-input" value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="tkklu">KLU TKU</label>
            <input id="tkklu" className="field-input font-mono" placeholder="Contoh: 85491" value={kluKode} onChange={(e) => setKluKode(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="tkklud">Deskripsi KLU TKU</label>
            <input id="tkklud" className="field-input" value={kluDeskripsi} onChange={(e) => setKluDeskripsi(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="field-label" htmlFor="ta">Alamat</label>
            <input id="ta" className="field-input" value={alamat} onChange={(e) => setAlamat(e.target.value)} />
          </div>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
        <button className="btn-primary mt-4" onClick={addTku}>Simpan TKU</button>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------- role */

export function RoleSection({ entityTin }: { entityTin: string }) {
  const { db, mutate } = useDb();
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const tkus = db.tkus.filter((t) => t.entityTin === entityTin);
  const assignments = db.roleAssignments.filter((a) => a.entityTin === entityTin);

  function revoke(id: string) {
    mutate((d) => {
      d.roleAssignments = d.roleAssignments.filter((a) => a.id !== id);
    });
  }

  const relatedPeople = db.relatedParties
    .filter((party) => party.entityTin === entityTin)
    .map((party) => ({ nik: party.personNik, name: party.personName }));
  const people = [...new Map([
    ...relatedPeople,
    ...assignments.map((assignment) => ({ nik: assignment.personNik, name: db.persons.find((person) => person.nik === assignment.personNik)?.nama ?? assignment.personNik })),
  ].map((person) => [person.nik, person])).values()];

  return (
    <section className="rounded-card bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Perwakilan Saya</h1>
          <p className="mt-1 text-[13px] text-ink-muted">Tetapkan satu atau lebih role akses untuk setiap pegawai yang telah didaftarkan.</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setSelectedPerson(null)}>+ New Representative</button>
      </div>

      <div className="mt-4 flex gap-2 border-b border-line pb-3">
        <button className="rounded-md bg-brand-50 p-2 text-brand-800" title="Muat ulang">↻</button>
        <button className="rounded-md bg-zinc-600 p-2 text-white" title="Ekspor">▣</button>
        <button className="rounded-md bg-good p-2 text-white" title="Ekspor Excel">▤</button>
        <button className="rounded-md bg-bad p-2 text-white" title="Ekspor PDF">▧</button>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="data-table min-w-[900px]">
          <thead>
            <tr>
              <th>Permintaan Terbuka</th>
              <th>NPWP</th>
              <th>Nama</th>
              <th>Jenis Perwakilan</th>
              <th>ID Penunjukan Perwakilan</th>
              <th>Nomor Dokumen Penunjukan Perwakilan</th>
              <th>Izin Perwakilan</th>
            </tr>
          </thead>
          <tbody>
            {people.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-ink-muted">
                  Belum ada pegawai yang terdaftar. Tambahkan Related Person terlebih dahulu.
                </td>
              </tr>
            )}
            {people.map((person) => {
              const personAssignments = assignments.filter((assignment) => assignment.personNik === person.nik);
              return (
              <tr key={person.nik}>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {personAssignments.map((assignment) => (
                      <button key={assignment.id} className="text-[11px] text-bad hover:underline" onClick={() => revoke(assignment.id)}>
                        Revoke
                      </button>
                    ))}
                    <button className="rounded bg-brand-800 px-2 py-1 text-[11px] text-white" onClick={() => setSelectedPerson(person.nik)}>
                      Tetapkan Role
                    </button>
                  </div>
                </td>
                <td className="font-mono">{person.nik}</td>
                <td>{person.name}</td>
                <td>{personAssignments.length ? 'Wakil/Pegawai' : 'Belum ditetapkan'}</td>
                <td className="font-mono text-xs">{personAssignments.length ? `DA${person.nik.slice(-8)}` : '—'}</td>
                <td>—</td>
                <td>{personAssignments.length ? 'License' : '—'}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedPerson !== null && (
        <RoleAssignmentDialog
          entityTin={entityTin}
          personNik={selectedPerson}
          tkus={tkus}
          assignments={assignments}
          onCancel={() => setSelectedPerson(null)}
          onSave={(picked, scope) => {
            mutate((d) => {
              const scopeNitku = scope === 'PUSAT' ? null : scope;
              d.roleAssignments = d.roleAssignments.filter((assignment) => !(assignment.entityTin === entityTin && assignment.personNik === selectedPerson && assignment.scopeNitku === scopeNitku));
              picked.forEach((role) => {
                d.roleAssignments.push({ id: crypto.randomUUID(), personNik: selectedPerson, entityTin, role, scopeNitku });
                addAuditEvent(d, 'Menetapkan Role', `${selectedPerson} - ${role} - ${scopeNitku ?? 'CENTRAL'}`);
              });
            });
            setSelectedPerson(null);
          }}
        />
      )}
    </section>
  );
}

function RoleAssignmentDialog({
  entityTin,
  personNik,
  tkus,
  assignments,
  onCancel,
  onSave,
}: {
  entityTin: string;
  personNik: string;
  tkus: { nitku: string; nama: string }[];
  assignments: { personNik: string; role: RoleCode; scopeNitku: string | null }[];
  onCancel: () => void;
  onSave: (roles: RoleCode[], scope: string) => void;
}) {
  const existing = assignments.filter((assignment) => assignment.personNik === personNik);
  const [scope, setScope] = useState(existing[0]?.scopeNitku ?? 'PUSAT');
  const [picked, setPicked] = useState<RoleCode[]>(existing.filter((assignment) => (assignment.scopeNitku ?? 'PUSAT') === scope).map((assignment) => assignment.role));
  const name = useDb().db.persons.find((person) => person.nik === personNik)?.nama ?? personNik;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/50 p-4">
      <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-card bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-900">Tetapkan Role</h2>
          <button className="text-xl text-ink-muted" onClick={onCancel} aria-label="Tutup">×</button>
        </div>
        <p className="mt-1 text-[13px] text-ink-muted">{name} ({personNik})</p>
        <div className="mt-4 max-w-sm">
          <label className="field-label" htmlFor="role-scope">Cakupan Role</label>
          <select id="role-scope" className="field-input" value={scope} onChange={(event) => {
            const nextScope = event.target.value;
            setScope(nextScope);
            setPicked(existing.filter((assignment) => (assignment.scopeNitku ?? 'PUSAT') === nextScope).map((assignment) => assignment.role));
          }}>
            <option value="PUSAT">Pihak terkait pusat — seluruh TKU</option>
            {tkus.filter((tku) => !tku.nitku.endsWith('000000')).map((tku) => <option key={tku.nitku} value={tku.nitku}>PIC TKU {tku.nitku} — {tku.nama}</option>)}
          </select>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {ROLE_GROUPS.map((group) => (
            <fieldset key={group.key} className="rounded-md border border-line p-3">
              <legend className="px-1 text-[13px] font-semibold text-brand-800">{group.label}</legend>
              <div className="space-y-2">
                {group.roles.map((role) => (
                  <label key={role} className="flex items-start gap-2 text-[13px]">
                    <input type="checkbox" className="mt-0.5" checked={picked.includes(role)} onChange={(event) => setPicked((current) => event.target.checked ? [...current, role] : current.filter((item) => item !== role))} />
                    <span>{ROLE_LABELS[role]}<span className="block break-all font-mono text-xxs text-ink-muted">{role}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="mt-5 flex justify-start gap-2">
          <button className="btn-primary" onClick={() => onSave(picked, scope)}>Simpan</button>
          <button className="btn-secondary" onClick={onCancel}>Batal</button>
        </div>
      </div>
    </div>
  );
}
