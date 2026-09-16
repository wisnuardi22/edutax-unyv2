'use client';

import { useState } from 'react';
import { useDb } from '@/lib/storage/useDb';
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
  const [tab, setTab] = useState<Tab>('orang');
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

      {tab === 'orang' && <PersonSection />}
      {tab === 'tku' && <TkuSection entityTin={entityTin} />}
      {tab === 'role' && <RoleSection entityTin={entityTin} />}
    </div>
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

function TkuSection({ entityTin }: { entityTin: string }) {
  const { db, mutate } = useDb();
  const tkus = db.tkus.filter((t) => t.entityTin === entityTin);
  const [subunit, setSubunit] = useState('');
  const [jenis, setJenis] = useState('Kantor Cabang');
  const [nama, setNama] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [alamat, setAlamat] = useState('');
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
    setError(null);
    mutate((d) => {
      d.tkus.push({
        nitku, entityTin, jenis, nama: nama.trim(), deskripsi: deskripsi.trim(),
        kluKode: '', kluDeskripsi: '', alamat: alamat.trim(), picNiks: [],
      });
    });
    setSubunit(''); setNama(''); setDeskripsi(''); setAlamat('');
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

              <p className="mt-3 text-[13px] font-medium">
                PIC TKU {t.nitku.endsWith('000000') && <span className="text-ink-muted">(pusat, maksimal 1 orang)</span>}
              </p>
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

function RoleSection({ entityTin }: { entityTin: string }) {
  const { db, mutate } = useDb();
  const [nik, setNik] = useState('');
  const [scope, setScope] = useState<string>('PUSAT');
  const [picked, setPicked] = useState<RoleCode[]>([]);
  const tkus = db.tkus.filter((t) => t.entityTin === entityTin);
  const assignments = db.roleAssignments.filter((a) => a.entityTin === entityTin);

  function assign() {
    if (!nik || picked.length === 0) return;
    mutate((d) => {
      for (const role of picked) {
        const scopeNitku = scope === 'PUSAT' ? null : scope;
        const exists = d.roleAssignments.some(
          (a) => a.personNik === nik && a.entityTin === entityTin && a.role === role && a.scopeNitku === scopeNitku,
        );
        if (exists) continue;
        d.roleAssignments.push({
          id: crypto.randomUUID(), personNik: nik, entityTin, role, scopeNitku,
        });
      }
    });
    setPicked([]);
  }

  function revoke(id: string) {
    mutate((d) => {
      d.roleAssignments = d.roleAssignments.filter((a) => a.id !== id);
    });
  }

  const nameOf = (n: string) => db.persons.find((p) => p.nik === n)?.nama ?? n;

  return (
    <>
      <section className="rounded-card bg-white p-5 shadow-card">
        <h1 className="font-semibold">Wakil/Kuasa Saya</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Cakupan pusat melihat dokumen seluruh TKU untuk jenis pajak yang sama. Cakupan satu TKU
          hanya melihat dokumen TKU tersebut.
        </p>

        <table className="data-table mt-4">
          <thead>
            <tr>
              <th>Orang</th>
              <th>Role</th>
              <th>Cakupan</th>
              <th className="w-24">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-ink-muted">
                  Belum ada role yang ditetapkan.
                </td>
              </tr>
            )}
            {assignments.map((a) => (
              <tr key={a.id}>
                <td>{nameOf(a.personNik)}</td>
                <td>
                  <span className="block font-mono text-xxs text-ink-muted">{a.role}</span>
                  {ROLE_LABELS[a.role]}
                </td>
                <td className="font-mono text-[13px]">{a.scopeNitku ?? 'Pusat — seluruh TKU'}</td>
                <td>
                  <button className="text-[13px] text-bad hover:underline" onClick={() => revoke(a.id)}>
                    Cabut
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-card bg-white p-5 shadow-card">
        <h2 className="font-semibold">Tetapkan role</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="rp">Orang</label>
            <select id="rp" className="field-input" value={nik} onChange={(e) => setNik(e.target.value)}>
              <option value="">Pilih orang…</option>
              {db.persons.map((p) => (
                <option key={p.nik} value={p.nik}>{p.nama || p.nik}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="rs">Cakupan</label>
            <select id="rs" className="field-input" value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="PUSAT">Pihak terkait pusat — seluruh TKU</option>
              {tkus.filter((t) => !t.nitku.endsWith('000000')).map((t) => (
                <option key={t.nitku} value={t.nitku}>PIC TKU {t.nitku} — {t.nama}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {ROLE_GROUPS.map((g) => (
            <fieldset key={g.key} className="rounded-md border border-line p-3">
              <legend className="px-1 text-[13px] font-semibold text-brand-800">{g.label}</legend>
              <div className="grid gap-1.5 md:grid-cols-2">
                {g.roles.map((r) => (
                  <label key={r} className="flex items-start gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={picked.includes(r)}
                      onChange={(e) =>
                        setPicked((s) => (e.target.checked ? [...s, r] : s.filter((x) => x !== r)))
                      }
                    />
                    <span>
                      {ROLE_LABELS[r]}
                      <span className="block font-mono text-xxs text-ink-muted">{r}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        <button className="btn-primary mt-4" onClick={assign} disabled={!nik || picked.length === 0}>
          Tetapkan role
        </button>
      </section>
    </>
  );
}
