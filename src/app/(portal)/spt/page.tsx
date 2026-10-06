'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDb } from '@/lib/storage/useDb';
import { emptyManualRows, type SptKind, type SptStatus } from '@/lib/domain/types';
import { canDraftSpt, canSignSpt, explainDeniedSpt, filterVisibleSpts } from '@/lib/auth/access';
import { buildArticleSummary, buildUnifikasiSummary, totalNetPayable } from '@/lib/domain/sptCalc';
import { printAsPdf } from '@/lib/storage/csv';
import { Download, Eye, FileCheck2, Pencil, Trash2 } from 'lucide-react';

/**
 * Daftar SPT Masa. Sidebar dan alur ini mengikuti slide 115-119 apa adanya:
 * lima status (Konsep, Menunggu Pembayaran, Dilaporkan, Ditolak, Dibatalkan)
 * dan wizard tiga langkah untuk membentuk konsep baru. Daftar dan tombol
 * "Buat Konsep SPT" mengikuti role SPT_21_DRAFTER/SIGNER lewat lib/auth/access —
 * berbeda dari bukti potong, SPT hanya untuk pihak terkait PUSAT (lihat catatan
 * di canDraftSpt/canSignSpt).
 */

const SIDEBAR: { key: SptStatus; label: string }[] = [
  { key: 'KONSEP', label: 'Konsep SPT' },
  { key: 'MENUNGGU_PEMBAYARAN', label: 'SPT Menunggu Pembayaran' },
  { key: 'DILAPORKAN', label: 'SPT Dilaporkan' },
  { key: 'DITOLAK', label: 'SPT Ditolak' },
  { key: 'DIBATALKAN', label: 'SPT Dibatalkan' },
];

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function SptListPage() {
  const router = useRouter();
  const { db, mutate } = useDb();
  const [status, setStatus] = useState<SptStatus>('KONSEP');
  const [wizardOpen, setWizardOpen] = useState(false);

  const entityTin = db.session?.impersonatingTin ?? null;
  const rows = useMemo(() => {
    if (!db.session) return [];
    return filterVisibleSpts(db.spts, db.roleAssignments, db.session, db.relatedParties)
      .filter((s) => s.status === status);
  }, [db.spts, db.roleAssignments, db.relatedParties, db.session, status]);

  if (!entityTin) {
    return (
      <p className="rounded-card bg-white p-5 text-sm shadow-card">
        Pilih badan yang Anda wakili di menu Portal Saya sebelum membuat SPT.
      </p>
    );
  }

  const canDraft21 = canDraftSpt(db.roleAssignments, db.session!, 'PPH_21_26', db.relatedParties);
  const canSign21 = canSignSpt(db.roleAssignments, db.session!, 'PPH_21_26', db.relatedParties);
  const canDraftUnif = canDraftSpt(db.roleAssignments, db.session!, 'PPH_UNIFIKASI', db.relatedParties);
  const canSignUnif = canSignSpt(db.roleAssignments, db.session!, 'PPH_UNIFIKASI', db.relatedParties);
  const canDraftSptRole = canDraft21 || canDraftUnif;
  const canSignSptRole = canSign21 || canSignUnif;

  if (!canDraftSptRole && !canSignSptRole) {
    return (
      <p className="rounded-card bg-white p-5 text-sm shadow-card">
        {explainDeniedSpt('draft', 'PPH_21_26')}
      </p>
    );
  }

  function removeDraft(id: string) {
    if (!canDraftSptRole) return;
    mutate((d) => {
      d.spts = d.spts.filter((s) => s.id !== id);
    });
  }

  /** Klik icon unduh (Download) — "mengunduh formulir induk SPT Masa PPh Pasal 21" (atau Unifikasi). */
  function downloadInduk(sptId: string) {
    const s = db.spts.find((x) => x.id === sptId);
    if (!s) return;
    const entity = db.entities.find((e) => e.tin === s.entityTin);
    const jenis = s.kind === 'PPH_UNIFIKASI' ? 'PPh Unifikasi' : 'PPh Pasal 21/26';

    if (s.kind === 'PPH_UNIFIKASI') {
      const sum = buildUnifikasiSummary(s, db.bupots);
      const rows: (string | number)[][] = [
        ['', 'NPWP', '', s.entityTin],
        ['', 'Nama Wajib Pajak', '', entity?.name ?? '-'],
        ...sum.groups.flatMap((g) => g.rows.map((r) => [g.article, r.kapKjs, r.selfPayment, r.withholding])),
        ['', 'TOTAL', sum.totalSelfPayment, sum.totalWithholding],
      ];
      printAsPdf(
        `Induk SPT Masa ${jenis} — ${MONTHS[s.taxPeriodMonth - 1]} ${s.taxPeriodYear}`,
        ['Article', 'KAP-KJS', 'Self Payment (Rp)', 'Withholding (Rp)'],
        rows,
      );
      return;
    }

    const a21 = buildArticleSummary(s, db.bupots, '21');
    const a26 = buildArticleSummary(s, db.bupots, '26');
    const rows: (string | number)[][] = [
      ['', 'NPWP', '', s.entityTin],
      ['', 'Nama Wajib Pajak', '', entity?.name ?? '-'],
      ...a21.withheld.map((r) => [`B.${r.no}`, r.uraian, r.kapKjs, r.jumlah]),
      ...a21.borneByGovernment.map((r) => [`B.II.${r.no}`, r.uraian, r.kapKjs, r.jumlah]),
      ...a26.withheld.map((r) => [`C.${r.no}`, r.uraian, r.kapKjs, r.jumlah]),
      ...a26.borneByGovernment.map((r) => [`C.II.${r.no}`, r.uraian, r.kapKjs, r.jumlah]),
      ['', 'Total PPh Kurang (Lebih) Bayar', '', totalNetPayable(s, db.bupots)],
    ];
    printAsPdf(
      `Induk SPT Masa ${jenis} — ${MONTHS[s.taxPeriodMonth - 1]} ${s.taxPeriodYear}`,
      ['No', 'Uraian', 'KAP-KJS', 'Jumlah (Rp)'],
      rows,
    );
  }

  /** Klik icon dokumen — "mengunduh Bukti Penerimaan Elektronik SPT Masa". */
  function downloadBpe(sptId: string) {
    const s = db.spts.find((x) => x.id === sptId);
    if (!s) return;
    const entity = db.entities.find((e) => e.tin === s.entityTin);
    printAsPdf(
      'Bukti Penerimaan Elektronik (BPE)',
      ['Keterangan', 'Nilai'],
      [
        ['NPWP', s.entityTin],
        ['Nama Wajib Pajak', entity?.name ?? '-'],
        ['Jenis SPT', s.kind === 'PPH_UNIFIKASI' ? 'SPT Masa PPh Unifikasi' : 'SPT Masa PPh Pasal 21/26'],
        ['Masa Pajak', `${MONTHS[s.taxPeriodMonth - 1]} ${s.taxPeriodYear}`],
        ['Model', s.model === 'NORMAL' ? 'Normal' : `Pembetulan ke-${s.pembetulanKe}`],
        ['NTPA/Nomor Tanda Terima', s.id.slice(0, 16).toUpperCase()],
        ['Tanggal Lapor', s.submittedAt ? new Date(s.submittedAt).toLocaleString('id-ID') : '-'],
        ['Status', 'DILAPORKAN'],
      ],
    );
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(220px,20%)_minmax(0,1fr)]">
      <aside className="rounded-card bg-white p-3 shadow-card">
        <p className="px-2 pb-2 text-[13px] font-semibold text-brand-800">Surat Pemberitahuan (SPT)</p>
        {SIDEBAR.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatus(s.key)}
            className={`block w-full rounded px-2 py-2 text-left text-[13px] ${
              status === s.key ? 'bg-brand-50 font-semibold text-brand-700' : 'hover:bg-canvas'
            }`}
          >
            {s.label}
          </button>
        ))}
      </aside>

      <section className="min-w-0 rounded-card bg-white p-4 shadow-card">
        <div className="flex items-center gap-2">
          <h1 className="font-semibold">{SIDEBAR.find((s) => s.key === status)!.label}</h1>
          {status === 'KONSEP' && (
            <button
              className="btn-primary ml-auto"
              onClick={() => setWizardOpen(true)}
              disabled={!canDraftSptRole}
              title={!canDraftSptRole ? explainDeniedSpt('draft', 'PPH_21_26') : undefined}
            >
              + Buat Konsep SPT
            </button>
          )}
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Jenis Pajak</th>
                <th>Jenis Surat Pemberitahuan</th>
                <th>Periode Pajak</th>
                <th>Model</th>
                <th className="w-28">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-ink-muted">
                    Tidak ada data yang ditemukan.
                  </td>
                </tr>
              )}
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>{s.kind === 'PPH_UNIFIKASI' ? 'PPh Unifikasi' : 'PPh Pasal 21/26'}</td>
                  <td>{s.kind === 'PPH_UNIFIKASI' ? 'SPT Masa PPh Unifikasi' : 'SPT Masa PPh Pasal 21/26'}</td>
                  <td>{MONTHS[s.taxPeriodMonth - 1]} {s.taxPeriodYear}</td>
                  <td>{s.model === 'NORMAL' ? 'Normal' : `Pembetulan ke-${s.pembetulanKe}`}</td>
                  <td className="flex gap-2">
                    <button
                      className="text-brand-600 hover:text-brand-800"
                      title={status === 'KONSEP' ? 'Lihat/lengkapi' : 'Detail'}
                      onClick={() => router.push(`/spt/${s.id}`)}
                    >
                      {status === 'KONSEP' ? <Pencil size={15} /> : <Eye size={15} />}
                    </button>
                    {status === 'KONSEP' && canDraftSptRole && (
                      <button className="text-bad hover:text-red-800" title="Hapus" onClick={() => removeDraft(s.id)}>
                        <Trash2 size={15} />
                      </button>
                    )}
                    {status === 'DILAPORKAN' && (
                      <>
                        <button className="text-brand-600 hover:text-brand-800" title="Unduh formulir induk" onClick={() => downloadInduk(s.id)}>
                          <Download size={15} />
                        </button>
                        <button className="text-good hover:text-green-800" title="Unduh Bukti Penerimaan Elektronik (BPE)" onClick={() => downloadBpe(s.id)}>
                          <FileCheck2 size={15} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {wizardOpen && (
        <CreateWizard
          entityTin={entityTin}
          canDraft21={canDraft21}
          canDraftUnif={canDraftUnif}
          onClose={() => setWizardOpen(false)}
          onCreated={(id) => { setWizardOpen(false); router.push(`/spt/${id}`); }}
        />
      )}
    </div>
  );
}

function CreateWizard({
  entityTin,
  canDraft21,
  canDraftUnif,
  onClose,
  onCreated,
}: {
  entityTin: string;
  canDraft21: boolean;
  canDraftUnif: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { db, mutate } = useDb();
  const [step, setStep] = useState(1);
  const [jenisPajak, setJenisPajak] = useState<SptKind | ''>('');
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [model, setModel] = useState<'NORMAL' | 'PEMBETULAN'>('NORMAL');

  const existingForPeriod = db.spts.filter(
    (s) => s.entityTin === entityTin && s.taxPeriodMonth === month && s.taxPeriodYear === year
      && s.status !== 'DIBATALKAN',
  );
  const pembetulanKe = existingForPeriod.filter((s) => s.model === 'PEMBETULAN').length + 1;

  function create() {
    const id = crypto.randomUUID();
    mutate((d) => {
      d.spts.push({
        id,
        kind: (jenisPajak || 'PPH_21_26') as SptKind,
        model,
        pembetulanKe: model === 'PEMBETULAN' ? pembetulanKe : 0,
        entityTin,
        taxPeriodMonth: month,
        taxPeriodYear: year,
        status: 'KONSEP',
        manualArticle21: emptyManualRows(),
        manualArticle26: emptyManualRows(),
        daftarIISendiri: [],
        daftarIIKumulatif: [],
        declaration: { agreed: false, signedAs: 'TAXPAYER', signerName: '' },
        signature: null,
        billing: null,
        createdAt: new Date().toISOString(),
        submittedAt: null,
        rejectedReason: null,
        cancelledAt: null,
      });
    });
    onCreated(id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-900/40 p-4">
      <div className="w-full max-w-2xl rounded-card bg-white p-5 shadow-card">
        <h2 className="font-semibold">Buat Konsep SPT</h2>

        <ol className="mt-4 flex items-center gap-2 text-[12px] text-ink-muted">
          {['Pilih Jenis Pajak', 'Pilih periode pelaporan SPT', 'Pilih Jenis SPT'].map((label, i) => (
            <li key={label} className={`flex items-center gap-1.5 ${step === i + 1 ? 'font-semibold text-brand-700' : ''}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-white ${
                step === i + 1 ? 'bg-brand-500' : 'bg-line text-ink-muted'
              }`}>
                {i + 1}
              </span>
              {label}
              {i < 2 && <span className="mx-1 text-line">—</span>}
            </li>
          ))}
        </ol>

        {step === 1 && (
          <div className="mt-5">
            <p className="text-[13px] font-medium">Langkah 1. Pilih jenis SPT yang akan dilaporkan</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => canDraft21 && setJenisPajak('PPH_21_26')}
                disabled={!canDraft21}
                title={!canDraft21 ? explainDeniedSpt('draft', 'PPH_21_26') : undefined}
                className={`rounded-md border p-3 text-left text-[13px] disabled:cursor-not-allowed disabled:opacity-40 ${
                  jenisPajak === 'PPH_21_26' ? 'border-brand-500 bg-brand-50' : 'border-line'
                }`}
              >
                PPh Pasal 21/26
              </button>
              <button
                onClick={() => canDraftUnif && setJenisPajak('PPH_UNIFIKASI')}
                disabled={!canDraftUnif}
                title={!canDraftUnif ? explainDeniedSpt('draft', 'PPH_UNIFIKASI') : undefined}
                className={`rounded-md border p-3 text-left text-[13px] disabled:cursor-not-allowed disabled:opacity-40 ${
                  jenisPajak === 'PPH_UNIFIKASI' ? 'border-brand-500 bg-brand-50' : 'border-line'
                }`}
              >
                PPh Unifikasi
              </button>
              {['PPN Bagi Pemungut PPN dan Pihak Lain', 'PPh Final Pengungkapan Harta Bersih'].map((label) => (
                <button
                  key={label}
                  disabled
                  title="Modul ini disiapkan pada tahap pengembangan berikutnya"
                  className="cursor-not-allowed rounded-md border border-line p-3 text-left text-[13px] text-ink-muted opacity-60"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={onClose}>Tutup</button>
              <button className="btn-primary" onClick={() => setStep(2)} disabled={!jenisPajak}>Lanjut</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-5">
            <p className="text-[13px] font-medium">Langkah 2. Pilih periode pelaporan SPT</p>
            <p className="mt-1 text-[13px] text-ink-muted">
              Jenis Surat Pemberitahuan Pajak: {jenisPajak === 'PPH_UNIFIKASI' ? 'SPT Masa PPh Unifikasi' : 'SPT Masa PPh Pasal 21/26'}
            </p>
            <div className="mt-3 grid max-w-sm grid-cols-2 gap-3">
              <select className="field-input" value={month} onChange={(e) => setMonth(+e.target.value)}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <input type="number" className="field-input" value={year} onChange={(e) => setYear(+e.target.value)} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setStep(1)}>Kembali</button>
              <button className="btn-primary" onClick={() => setStep(3)}>Lanjut</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-5">
            <p className="text-[13px] font-medium">Langkah 3. Pilih Jenis SPT</p>
            <p className="mt-1 text-[13px] text-ink-muted">
              Jenis Surat Pemberitahuan Pajak: {jenisPajak === 'PPH_UNIFIKASI' ? 'SPT Masa PPh Unifikasi' : 'SPT Masa PPh Pasal 21/26'}<br />
              Periode dan Tahun Pajak: {MONTHS[month - 1]} {year}
            </p>
            <div className="mt-3 max-w-sm">
              <label className="field-label" htmlFor="model">Model SPT</label>
              <select id="model" className="field-input" value={model} onChange={(e) => setModel(e.target.value as typeof model)}>
                <option value="NORMAL">Normal</option>
                <option value="PEMBETULAN">Pembetulan{existingForPeriod.length ? ` (ke-${pembetulanKe})` : ''}</option>
              </select>
              {model === 'PEMBETULAN' && existingForPeriod.length === 0 && (
                <p className="mt-2 text-[13px] text-warn">
                  Belum ada SPT Normal pada periode ini untuk dibetulkan.
                </p>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setStep(2)}>Kembali</button>
              <button
                className="btn-primary"
                onClick={create}
                disabled={model === 'PEMBETULAN' && existingForPeriod.length === 0}
              >
                Buat Konsep SPT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
