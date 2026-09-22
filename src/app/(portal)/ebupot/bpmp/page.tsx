'use client';

import { useMemo, useState } from 'react';
import { useDb } from '@/lib/storage/useDb';
import { nextWithholdingNumber } from '@/lib/storage/db';
import { PTKP_OPTIONS, withheldByTer } from '@/lib/domain/ter';
import { tabOf, type DocTab } from '@/lib/domain/types';
import { SignDialog } from '@/components/ui/SignDialog';
import { canDraft, canSign, explainDenied, filterVisibleBupots } from '@/lib/auth/access';
import { ModuleSwitcher } from '@/components/layout/ModuleSwitcher';

/**
 * Bukti Pemotongan Bulanan Pegawai Tetap (EBUPOT MP).
 * Layar ini jadi acuan bentuk untuk seluruh modul eBupot lainnya:
 * tiga tab status, tombol buat, terbitkan dengan tanda tangan, dan batal.
 * Sejak modul Role Akses disambungkan ke sini, daftar dan tombol aksi
 * mengikuti canDraft()/canSign()/filterVisibleBupots() dari lib/auth/access.
 */

const TABS: { key: DocTab; label: string }[] = [
  { key: 'BELUM_TERBIT', label: 'Belum Terbit' },
  { key: 'TELAH_TERBIT', label: 'Telah Terbit' },
  { key: 'TIDAK_VALID', label: 'Tidak Valid' },
];

const NIK_TIDAK_PADAN = '9990000000999000';
const rupiah = (n: number) => n.toLocaleString('id-ID');

export default function BpmpPage() {
  const { db, mutate } = useDb();
  const [tab, setTab] = useState<DocTab>('BELUM_TERBIT');
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [signing, setSigning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const entityTin = db.session?.impersonatingTin ?? null;
  const rows = useMemo(() => {
    if (!db.session) return [];
    const visible = filterVisibleBupots(
      db.bupots.filter((b) => b.kind === 'BPMP'),
      db.roleAssignments,
      db.session,
      db.relatedParties,
    );
    return visible.filter((b) => tabOf(b.status) === tab);
  }, [db.bupots, db.roleAssignments, db.relatedParties, db.session, tab]);

  // Formulir
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [nik, setNik] = useState('');
  const [nama, setNama] = useState('');
  const [ptkp, setPtkp] = useState('K/0');
  const [jabatan, setJabatan] = useState('');
  const [gross, setGross] = useState(0);

  const preview = withheldByTer(ptkp, gross);

  if (!entityTin) {
    return (
      <p className="rounded-card bg-white p-5 text-sm shadow-card">
        Pilih badan yang Anda wakili di menu Portal Saya sebelum membuat bukti pemotongan.
      </p>
    );
  }

  const canDraftBpmp = canDraft(db.roleAssignments, db.session!, 'BPMP', db.relatedParties);
  const canSignBpmp = canSign(db.roleAssignments, db.session!, 'BPMP', db.relatedParties);

  if (!canDraftBpmp && !canSignBpmp) {
    return (
      <p className="rounded-card bg-white p-5 text-sm shadow-card">
        {explainDenied('draft', 'BPMP')}
      </p>
    );
  }

  function saveDraft(submit: boolean) {
    if (!canDraftBpmp) { setNotice(explainDenied('draft', 'BPMP')); return; }
    const cleanNik = nik.replace(/\D/g, '');
    const person = db.persons.find((p) => p.nik === cleanNik);
    // Meniru perilaku Coretax: NIK yang tidak dikenali diganti nilai sentinel.
    const resolvedTin = person?.padan ? cleanNik : NIK_TIDAK_PADAN;

    mutate((d) => {
      d.bupots.push({
        id: crypto.randomUUID(),
        kind: 'BPMP',
        entityTin: entityTin!,
        status: submit ? 'SUBMITTED' : 'DRAFT',
        withholdingNumber: null,
        taxPeriodMonth: month,
        taxPeriodYear: year,
        counterpartTin: resolvedTin,
        counterpartName: person?.nama ?? nama,
        taxObjectCode: '21-100-01',
        gross,
        rate: preview.rate,
        withheld: preview.withheld,
        idPlaceOfBusinessActivity: db.session?.activeNitku ?? `${entityTin}000000`,
        createdByNik: d.session!.personNik,
        createdAt: new Date().toISOString(),
        signature: null,
        cancelledAt: null,
        fields: { ptkp, jabatan, foreignEmployee: false },
      });
    });

    setNotice(
      resolvedTin === NIK_TIDAK_PADAN
        ? `Data tersimpan, tetapi NIK ${cleanNik} tidak dikenali dan dicatat sebagai ${NIK_TIDAK_PADAN}. Bukti potong ini tidak dapat dikreditkan. Padankan NIK pegawai terlebih dahulu.`
        : 'Data bukti pemotongan tersimpan pada daftar Belum Terbit.',
    );
    setFormOpen(false);
    setNik(''); setNama(''); setJabatan(''); setGross(0);
  }

  function issue(password: string, provider: 'KODE_OTORISASI_DJP' | 'SERTIFIKAT_ELEKTRONIK') {
    if (!password || !canSignBpmp) return;
    mutate((d) => {
      for (const id of selected) {
        const doc = d.bupots.find((b) => b.id === id);
        if (!doc || doc.status === 'ISSUED' || doc.status === 'CANCELLED') continue;
        doc.status = 'ISSUED';
        doc.withholdingNumber = nextWithholdingNumber(d, doc.entityTin, doc.taxPeriodYear);
        doc.signature = {
          provider,
          signerNik: d.session!.personNik,
          signedAt: new Date().toISOString(),
        };
      }
    });
    setSigning(false);
    setSelected([]);
    setNotice('Bukti pemotongan diterbitkan dan masuk ke draft SPT Masa PPh Pasal 21.');
    setTab('TELAH_TERBIT');
  }

  function cancel() {
    if (!canSignBpmp) return;
    mutate((d) => {
      for (const id of selected) {
        const doc = d.bupots.find((b) => b.id === id);
        if (doc?.status === 'ISSUED') {
          doc.status = 'CANCELLED';
          doc.cancelledAt = new Date().toISOString();
        }
      }
    });
    setSelected([]);
    setNotice('Bukti pemotongan dibatalkan dan berpindah ke daftar Tidak Valid.');
  }

  function remove() {
    if (!canDraftBpmp) return;
    mutate((d) => {
      d.bupots = d.bupots.filter((b) => !(selected.includes(b.id) && b.status !== 'ISSUED'));
    });
    setSelected([]);
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(220px,20%)_minmax(0,1fr)]">
      <aside className="rounded-card bg-white p-3 shadow-card">
        <ModuleSwitcher active="BPMP" />
        <p className="px-2 pb-2 pt-3 text-[13px] font-semibold text-brand-800">
          Bukti Pemotongan Bulanan Pegawai Tetap
        </p>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelected([]); }}
            className={`block w-full rounded px-2 py-2 text-left text-[13px] ${
              tab === t.key ? 'bg-brand-50 font-semibold text-brand-700' : 'hover:bg-canvas'
            }`}
          >
            {t.label}
          </button>
        ))}
      </aside>

      <section className="min-w-0 rounded-card bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-semibold">EBUPOT MP — {TABS.find((t) => t.key === tab)!.label}</h1>
          <div className="ml-auto flex gap-2">
            {tab === 'BELUM_TERBIT' && (
              <>
                <button
                  className="btn-secondary"
                  onClick={() => setFormOpen(true)}
                  disabled={!canDraftBpmp}
                  title={!canDraftBpmp ? explainDenied('draft', 'BPMP') : undefined}
                >
                  + Buat eBupot MP
                </button>
                <button
                  className="btn-secondary"
                  onClick={remove}
                  disabled={!selected.length || !canDraftBpmp}
                  title={!canDraftBpmp ? explainDenied('draft', 'BPMP') : undefined}
                >
                  Hapus
                </button>
                <button
                  className="btn-primary"
                  onClick={() => setSigning(true)}
                  disabled={!selected.length || !canSignBpmp}
                  title={!canSignBpmp ? explainDenied('sign', 'BPMP') : undefined}
                >
                  Terbitkan
                </button>
              </>
            )}
            {tab === 'TELAH_TERBIT' && (
              <button
                className="btn-secondary"
                onClick={cancel}
                disabled={!selected.length || !canSignBpmp}
                title={!canSignBpmp ? explainDenied('sign', 'BPMP') : undefined}
              >
                Batal
              </button>
            )}
          </div>
        </div>

        {notice && (
          <p className="mt-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-[13px] text-brand-800">
            {notice}
          </p>
        )}

        <div className="mt-3 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10" />
                <th>Masa Pajak</th>
                <th>Nomor Bupot</th>
                <th>NIK/NPWP</th>
                <th>Nama</th>
                <th className="text-right">Bruto</th>
                <th className="text-right">Tarif</th>
                <th className="text-right">PPh Dipotong</th>
                <th>ID TKU</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-ink-muted">
                    Belum ada bukti pemotongan pada daftar ini.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Pilih bupot ${r.counterpartName}`}
                      checked={selected.includes(r.id)}
                      onChange={(e) =>
                        setSelected((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))
                      }
                    />
                  </td>
                  <td>{String(r.taxPeriodMonth).padStart(2, '0')}/{r.taxPeriodYear}</td>
                  <td className="font-mono">{r.withholdingNumber ?? '—'}</td>
                  <td className={`font-mono ${r.counterpartTin === NIK_TIDAK_PADAN ? 'text-bad' : ''}`}>
                    {r.counterpartTin}
                  </td>
                  <td>{r.counterpartName}</td>
                  <td className="text-right">{rupiah(r.gross)}</td>
                  <td className="text-right">{r.rate}%</td>
                  <td className="text-right">{rupiah(r.withheld)}</td>
                  <td className="font-mono text-xxs">{r.idPlaceOfBusinessActivity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-900/40 p-4">
          <div className="w-full max-w-3xl rounded-card bg-white p-5 shadow-card">
            <h2 className="font-semibold">Formulir EBUPOT MP</h2>
            <p className="mt-1 text-[13px] text-ink-muted">Informasi Umum</p>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div>
                <label className="field-label" htmlFor="m">Masa Pajak</label>
                <select id="m" className="field-input" value={month} onChange={(e) => setMonth(+e.target.value)}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{String(i + 1).padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="y">Tahun Pajak</label>
                <input id="y" type="number" className="field-input" value={year} onChange={(e) => setYear(+e.target.value)} />
              </div>
              <div>
                <label className="field-label" htmlFor="p">Status PTKP</label>
                <select id="p" className="field-input" value={ptkp} onChange={(e) => setPtkp(e.target.value)}>
                  {PTKP_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="n">NPWP 16 digit / NIK pegawai</label>
                <input id="n" className="field-input font-mono" maxLength={16} value={nik}
                  onChange={(e) => setNik(e.target.value)} />
              </div>
              <div>
                <label className="field-label" htmlFor="nm2">Nama pegawai</label>
                <input id="nm2" className="field-input" value={nama} onChange={(e) => setNama(e.target.value)} />
              </div>
              <div>
                <label className="field-label" htmlFor="j">Jabatan</label>
                <input id="j" className="field-input" value={jabatan} onChange={(e) => setJabatan(e.target.value)} />
              </div>
              <div>
                <label className="field-label" htmlFor="g">Penghasilan Bruto (Rp)</label>
                <input id="g" type="number" className="field-input" value={gross}
                  onChange={(e) => setGross(+e.target.value)} />
              </div>
              <div>
                <label className="field-label">Tarif TER</label>
                <output className="field-input block bg-canvas">{preview.rate}%</output>
              </div>
              <div>
                <label className="field-label">PPh Pasal 21 dipotong</label>
                <output className="field-input block bg-canvas">{rupiah(preview.withheld)}</output>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setFormOpen(false)}>Tutup</button>
              <button className="btn-secondary" onClick={() => saveDraft(false)}>Simpan draft</button>
              <button className="btn-primary" onClick={() => saveDraft(true)}>Kirim</button>
            </div>
          </div>
        </div>
      )}

      {signing && (
        <SignDialog
          signerNik={db.session!.personNik}
          onCancel={() => setSigning(false)}
          onConfirm={issue}
        />
      )}
    </div>
  );
}
