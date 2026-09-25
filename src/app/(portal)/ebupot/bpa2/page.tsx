'use client';

import { useMemo, useState } from 'react';
import { useDb } from '@/lib/storage/useDb';
import { nextWithholdingNumber } from '@/lib/storage/db';
import {
  BPA2_TAX_OBJECT, GENDER_OPTIONS, PTKP_AMOUNTS, STATUS_WITHHOLDING_OPTIONS,
  calculateBpa2, monthsBetween, type GrossIncomeInput,
} from '@/lib/domain/bpa2';
import { tabOf, type BupotDoc, type DocTab } from '@/lib/domain/types';
import { SignDialog } from '@/components/ui/SignDialog';
import { canDraft, canSign, explainDenied, filterVisibleBupots } from '@/lib/auth/access';
import { ExportIconRow } from '@/components/ui/ExportIconRow';
import { downloadCsv, downloadXls, printAsPdf } from '@/lib/storage/csv';
import { Pencil } from 'lucide-react';

/**
 * Bukti Pemotongan Tahunan PPh 1721-A2 (BPA2) — slide "Pembuatan Bukti
 * Pemotongan Tahunan PPh". BEDA dari BPMP: bukan bulanan/TER, tapi rekap
 * SETAHUN dengan tarif progresif Pasal 17 (lihat `lib/domain/bpa2.ts`), dan
 * SEPERTI BP21 (bukan seperti BPMP): pakai Sign Document saat Terbitkan —
 * terlihat jelas dari slide "Sign Document" yang muncul setelah klik
 * Terbitkan pada alur BPA2.
 *
 * Belum ada di sini (di luar cakupan slide yang tersedia): fitur "Get data"
 * sungguhan untuk menarik nomor 1721-A1/A2 dari pemberi kerja sebelumnya
 * (baru field manual), dan Impor Data (kolom Gross Income terlalu banyak
 * sub-field untuk template sederhana — bisa menyusul).
 */

const TABS: { key: DocTab; label: string }[] = [
  { key: 'BELUM_TERBIT', label: 'Belum Terbit' },
  { key: 'TELAH_TERBIT', label: 'Telah Terbit' },
  { key: 'TIDAK_VALID', label: 'Tidak Valid' },
];

const NIK_TIDAK_PADAN = '9990000000999000';
const rupiah = (n: number) => n.toLocaleString('id-ID');
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const monthLabel = (m: number) => String(m).padStart(2, '0');

const emptyGross: GrossIncomeInput = {
  salaryPensionThtJht: 0, wifeIncomeBenefit: 0, childrenIncomeBenefit: 0,
  incomeImprovementBenefit: 0, structuralFunctionalBenefit: 0, riceIncomeBenefit: 0,
  otherIncomeBenefit: 0, otherFixedRegularIncome: 0,
};

export default function Bpa2Page() {
  const { db, mutate } = useDb();
  const [tab, setTab] = useState<DocTab>('BELUM_TERBIT');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [signing, setSigning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const entityTin = db.session?.impersonatingTin ?? null;
  const tkus = useMemo(() => db.tkus.filter((t) => t.entityTin === entityTin), [db.tkus, entityTin]);
  const rows = useMemo(() => {
    if (!db.session) return [];
    const visible = filterVisibleBupots(
      db.bupots.filter((b) => b.kind === 'BPA2'),
      db.roleAssignments,
      db.session,
      db.relatedParties,
    );
    return visible.filter((b) => tabOf(b.status) === tab);
  }, [db.bupots, db.roleAssignments, db.relatedParties, db.session, tab]);

  // Formulir — General Information
  const [workingForSecondEmployer, setWorkingForSecondEmployer] = useState(false);
  const [startMonth, setStartMonth] = useState(1);
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [endMonth, setEndMonth] = useState(new Date().getMonth() + 1);
  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [tin, setTin] = useState('');
  const [nama, setNama] = useState('');
  const [nip, setNip] = useState('');
  const [gender, setGender] = useState<string>(GENDER_OPTIONS[0]);
  const [golongan, setGolongan] = useState('');
  const [ptkp, setPtkp] = useState('TK/0');
  const [jabatan, setJabatan] = useState('');
  const [statusWithholding, setStatusWithholding] = useState<string>(STATUS_WITHHOLDING_OPTIONS[0]);
  const [nitku, setNitku] = useState('');

  // Formulir — Gross Income
  const [gross, setGross] = useState<GrossIncomeInput>(emptyGross);

  // Formulir — Perhitungan PPh Tahunan
  const [previousSlipNumber, setPreviousSlipNumber] = useState('');
  const [netIncomeFromPrevious, setNetIncomeFromPrevious] = useState(0);
  const [withheldFromPrevious, setWithheldFromPrevious] = useState(0);
  const [taxWithheld, setTaxWithheld] = useState(0);

  const cleanTin = tin.replace(/\D/g, '');
  const matchedPerson = db.persons.find((p) => p.nik === cleanTin || p.npwp16 === cleanTin);
  const tinNotFound = cleanTin.length === 16 && !matchedPerson;
  const months = monthsBetween(startMonth, startYear, endMonth, endYear);
  const calc = calculateBpa2({
    gross, months, ptkp,
    netIncomeFromPrevious,
    article21TaxWithheldFromPrevious: withheldFromPrevious,
    article21TaxWithheld: taxWithheld,
  });

  function handleTinChange(value: string) {
    setTin(value);
    const clean = value.replace(/\D/g, '');
    const person = db.persons.find((p) => p.nik === clean || p.npwp16 === clean);
    if (person) {
      setNama(person.nama);
      setNip(person.nip ?? '');
      setGender(person.gender ?? GENDER_OPTIONS[0]);
      setGolongan(person.golongan ?? '');
      setPtkp(person.ptkp ?? 'TK/0');
      setJabatan(person.jabatan ?? '');
    } else if (clean.length === 16) {
      setNama(''); setNip(''); setGolongan(''); setJabatan('');
    }
  }

  /** Jumlahkan PPh yang sudah dipotong lewat BPMP untuk pegawai + periode yang sama. */
  function sumFromBpmp() {
    const clean = tin.replace(/\D/g, '');
    if (!clean) return;
    const sum = db.bupots
      .filter((b) =>
        b.kind === 'BPMP' && b.entityTin === entityTin && b.status === 'ISSUED'
        && b.counterpartTin === clean
        && (b.taxPeriodYear > startYear || (b.taxPeriodYear === startYear && b.taxPeriodMonth >= startMonth))
        && (b.taxPeriodYear < endYear || (b.taxPeriodYear === endYear && b.taxPeriodMonth <= endMonth)),
      )
      .reduce((sum2, b) => sum2 + b.withheld, 0);
    setTaxWithheld(sum);
    setNotice(sum > 0 ? `PPh dari ${sum > 0 ? 'BPMP yang sudah terbit' : ''} berhasil dijumlahkan: ${rupiah(sum)}.` : 'Tidak ada BPMP terbit yang cocok untuk NIK dan periode ini.');
  }

  if (!entityTin) {
    return (
      <p className="rounded-card bg-white p-5 text-sm shadow-card">
        Pilih badan yang Anda wakili di menu Portal Saya sebelum membuat bukti pemotongan.
      </p>
    );
  }

  const canDraftBpa2 = canDraft(db.roleAssignments, db.session!, 'BPA2', db.relatedParties);
  const canSignBpa2 = canSign(db.roleAssignments, db.session!, 'BPA2', db.relatedParties);

  if (!canDraftBpa2 && !canSignBpa2) {
    return (
      <p className="rounded-card bg-white p-5 text-sm shadow-card">
        {explainDenied('draft', 'BPA2')}
      </p>
    );
  }

  function resetForm() {
    setEditingId(null);
    setWorkingForSecondEmployer(false);
    setStartMonth(1); setStartYear(new Date().getFullYear());
    setEndMonth(new Date().getMonth() + 1); setEndYear(new Date().getFullYear());
    setTin(''); setNama(''); setNip(''); setGender(GENDER_OPTIONS[0]); setGolongan('');
    setPtkp('TK/0'); setJabatan(''); setStatusWithholding(STATUS_WITHHOLDING_OPTIONS[0]);
    setGross(emptyGross);
    setPreviousSlipNumber(''); setNetIncomeFromPrevious(0); setWithheldFromPrevious(0); setTaxWithheld(0);
    setNitku(tkus[0]?.nitku ?? '');
  }

  function openCreate() { resetForm(); setFormOpen(true); }

  function openEdit(doc: BupotDoc) {
    if (!canDraftBpa2) return;
    setEditingId(doc.id);
    setWorkingForSecondEmployer(Boolean(doc.fields.workingForSecondEmployer));
    setStartMonth(Number(doc.fields.startMonth ?? doc.taxPeriodMonth)); setStartYear(Number(doc.fields.startYear ?? doc.taxPeriodYear));
    setEndMonth(doc.taxPeriodMonth); setEndYear(doc.taxPeriodYear);
    setTin(doc.counterpartTin === NIK_TIDAK_PADAN ? '' : doc.counterpartTin);
    setNama(doc.counterpartName);
    setNip(String(doc.fields.nip ?? ''));
    setGender(String(doc.fields.gender ?? GENDER_OPTIONS[0]));
    setGolongan(String(doc.fields.golongan ?? ''));
    setPtkp(String(doc.fields.ptkp ?? 'TK/0'));
    setJabatan(String(doc.fields.jabatan ?? ''));
    setStatusWithholding(String(doc.fields.statusWithholding ?? STATUS_WITHHOLDING_OPTIONS[0]));
    setGross((doc.fields.grossIncome as GrossIncomeInput) ?? emptyGross);
    setPreviousSlipNumber(String(doc.fields.previousSlipNumber ?? ''));
    setNetIncomeFromPrevious(Number(doc.fields.netIncomeFromPrevious ?? 0));
    setWithheldFromPrevious(Number(doc.fields.withheldFromPrevious ?? 0));
    setTaxWithheld(doc.withheld);
    setNitku(doc.idPlaceOfBusinessActivity);
    setFormOpen(true);
  }

  function resolveCounterpart(rawTin: string, fallbackName: string) {
    const clean = rawTin.replace(/\D/g, '');
    const person = db.persons.find((p) => p.nik === clean || p.npwp16 === clean);
    const resolvedTin = clean && (!person || person.padan) ? clean : NIK_TIDAK_PADAN;
    return { resolvedTin, name: person?.nama ?? fallbackName };
  }

  function saveDraft(submit: boolean) {
    if (!canDraftBpa2) { setNotice(explainDenied('draft', 'BPA2')); return; }
    const { resolvedTin, name } = resolveCounterpart(tin, nama);
    const chosenNitku = nitku || tkus[0]?.nitku || `${entityTin}000000`;

    mutate((d) => {
      const fields = {
        workingForSecondEmployer,
        startMonth, startYear,
        nip, gender, golongan, ptkp, jabatan, statusWithholding,
        taxObjectName: BPA2_TAX_OBJECT.name,
        grossIncome: gross,
        previousSlipNumber,
        netIncomeFromPrevious,
        withheldFromPrevious,
        netIncome: calc.netIncome,
        taxableIncome: calc.taxableIncome,
        taxLiability: calc.article21TaxLiability,
        underOverPayment: calc.underOverPayment,
      };
      const existing = editingId ? d.bupots.find((b) => b.id === editingId) : undefined;
      if (existing) {
        Object.assign(existing, {
          status: submit ? 'SUBMITTED' : 'DRAFT',
          // Disimpan di masa pajak AKHIR (bukan awal) — BPA2 adalah rekonsiliasi
          // "Masa Pajak Terakhir" yang dilaporkan bersama SPT bulan terakhir itu,
          // supaya otomatis muncul di L-IB pada SPT bulan yang tepat.
          taxPeriodMonth: endMonth,
          taxPeriodYear: endYear,
          counterpartTin: resolvedTin,
          counterpartName: name,
          taxObjectCode: BPA2_TAX_OBJECT.code,
          gross: calc.totalGross,
          rate: 0,
          withheld: calc.article21TaxLiabilityInThisSlip,
          idPlaceOfBusinessActivity: chosenNitku,
          fields,
        });
      } else {
        d.bupots.push({
          id: crypto.randomUUID(),
          kind: 'BPA2',
          entityTin: entityTin!,
          status: submit ? 'SUBMITTED' : 'DRAFT',
          withholdingNumber: null,
          taxPeriodMonth: endMonth,
          taxPeriodYear: endYear,
          counterpartTin: resolvedTin,
          counterpartName: name,
          taxObjectCode: BPA2_TAX_OBJECT.code,
          gross: calc.totalGross,
          rate: 0,
          withheld: calc.article21TaxLiabilityInThisSlip,
          idPlaceOfBusinessActivity: chosenNitku,
          createdByNik: d.session!.personNik,
          createdAt: new Date().toISOString(),
          signature: null,
          cancelledAt: null,
          fields,
        });
      }
    });

    setNotice(
      resolvedTin === NIK_TIDAK_PADAN
        ? `Data tersimpan, tetapi NIK ${cleanTin || '(kosong)'} tidak dikenali dan dicatat sebagai ${NIK_TIDAK_PADAN}.`
        : 'Data bukti pemotongan tersimpan pada daftar Belum Terbit.',
    );
    setFormOpen(false);
    resetForm();
  }

  function issue(password: string, provider: 'KODE_OTORISASI_DJP' | 'SERTIFIKAT_ELEKTRONIK') {
    if (!password || !canSignBpa2) return;
    mutate((d) => {
      for (const id of selected) {
        const doc = d.bupots.find((b) => b.id === id);
        if (!doc || doc.status === 'ISSUED' || doc.status === 'CANCELLED') continue;
        doc.status = 'ISSUED';
        doc.withholdingNumber = nextWithholdingNumber(d, doc.entityTin, doc.taxPeriodYear);
        doc.signature = { provider, signerNik: d.session!.personNik, signedAt: new Date().toISOString() };
      }
    });
    setSigning(false);
    setSelected([]);
    setNotice('Data successfully issued!');
    setTab('TELAH_TERBIT');
  }

  function cancel() {
    if (!canSignBpa2) return;
    mutate((d) => {
      for (const id of selected) {
        const doc = d.bupots.find((b) => b.id === id);
        if (doc?.status === 'ISSUED') { doc.status = 'CANCELLED'; doc.cancelledAt = new Date().toISOString(); }
      }
    });
    setSelected([]);
    setNotice('Bukti pemotongan dibatalkan dan berpindah ke daftar Tidak Valid.');
  }

  function remove() {
    if (!canDraftBpa2) return;
    mutate((d) => {
      d.bupots = d.bupots.filter((b) => !(selected.includes(b.id) && b.status !== 'ISSUED'));
    });
    setSelected([]);
  }

  function refresh() { mutate(() => {}); }

  const exportHeaders = ['Tax Period Start', 'Tax Period End', 'Withholding Number', 'Status', 'NIK/NPWP', 'Nama', 'Total Gross', 'PPh Liability'];
  const exportRows = () => rows.map((r) => [
    `${monthLabel(Number(r.fields.startMonth ?? r.taxPeriodMonth))}/${r.fields.startYear ?? r.taxPeriodYear}`,
    `${monthLabel(r.taxPeriodMonth)}/${r.taxPeriodYear}`,
    r.withholdingNumber ?? '-', r.status, r.counterpartTin, r.counterpartName, r.gross, r.withheld,
  ]);
  function exportCsv() { downloadCsv('ebupot-bpa2.csv', exportHeaders, exportRows()); }
  function exportXls() { downloadXls('ebupot-bpa2.xls', exportHeaders, exportRows()); }
  function exportPdf() { printAsPdf('EBUPOT BPA2', exportHeaders, exportRows()); }

  function downloadCertificate(doc: BupotDoc) {
    printAsPdf(
      `1721-A2 — ${doc.counterpartName}`,
      ['Uraian', 'Nilai'],
      [
        ['Nomor Bukti Potong', doc.withholdingNumber ?? '-'],
        ['NIK/NPWP', doc.counterpartTin],
        ['Nama', doc.counterpartName],
        ['Masa Pajak', `${monthLabel(Number(doc.fields.startMonth ?? doc.taxPeriodMonth))}/${doc.fields.startYear ?? doc.taxPeriodYear} — ${monthLabel(doc.taxPeriodMonth)}/${doc.taxPeriodYear}`],
        ['Total Penghasilan Bruto', rupiah(doc.gross)],
        ['PPh Pasal 21 Terutang', rupiah(doc.withheld)],
      ],
    );
  }

  const gTotal = calc.totalGross;
  const viewDoc = viewing ? db.bupots.find((b) => b.id === viewing) : null;

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(220px,20%)_minmax(0,1fr)]">
      <aside className="rounded-card bg-white p-3 shadow-card">
        <p className="px-2 pb-2 text-[13px] font-semibold text-brand-800">
          Bukti Pemotongan A2 Masa Pajak Terakhir
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
          <h1 className="font-semibold">
            EBUPOT BPA2{tab === 'TELAH_TERBIT' ? ' ISSUED' : tab === 'TIDAK_VALID' ? ' INVALID' : ''}
          </h1>
          <div className="ml-auto flex gap-2">
            {tab === 'BELUM_TERBIT' && (
              <>
                <button className="btn-secondary" onClick={openCreate} disabled={!canDraftBpa2}
                  title={!canDraftBpa2 ? explainDenied('draft', 'BPA2') : undefined}>
                  + Create eBupot BPA2
                </button>
                <button className="btn-secondary" onClick={remove} disabled={!selected.length || !canDraftBpa2}
                  title={!canDraftBpa2 ? explainDenied('draft', 'BPA2') : undefined}>
                  Hapus
                </button>
                <button className="btn-primary" onClick={() => setSigning(true)} disabled={!selected.length || !canSignBpa2}
                  title={!canSignBpa2 ? explainDenied('sign', 'BPA2') : undefined}>
                  Terbitkan
                </button>
              </>
            )}
            {tab === 'TELAH_TERBIT' && (
              <button className="btn-secondary" onClick={cancel} disabled={!selected.length || !canSignBpa2}
                title={!canSignBpa2 ? explainDenied('sign', 'BPA2') : undefined}>
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

        <div className="mt-3">
          <ExportIconRow onRefresh={refresh} onCsv={exportCsv} onXls={exportXls} onPdf={exportPdf} />
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10" />
                <th>Tax Period Start</th>
                <th>Tax Period End</th>
                <th>Withholding Number</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-ink-muted">Belum ada bukti pemotongan pada daftar ini.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input type="checkbox" aria-label={`Pilih bupot ${r.counterpartName}`}
                      checked={selected.includes(r.id)}
                      onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))} />
                  </td>
                  <td>
                  {monthLabel(Number(r.fields.startMonth ?? r.taxPeriodMonth))}/
                  {String(r.fields.startYear ?? r.taxPeriodYear)}
                </td>
                  <td>{monthLabel(r.taxPeriodMonth)}/{r.taxPeriodYear}</td>
                  <td className="font-mono">{r.withholdingNumber ?? '—'}</td>
                  <td className="text-xxs">{r.status}</td>
                  <td>
                    <div className="flex gap-2">
                      {tab === 'BELUM_TERBIT' && r.status === 'DRAFT' && canDraftBpa2 && (
                        <button className="text-brand-600 hover:text-brand-800" title="Edit" onClick={() => openEdit(r)}>
                          <Pencil size={15} />
                        </button>
                      )}
                      <button className="text-brand-600 hover:underline" onClick={() => setViewing(r.id)}>Lihat</button>
                      {tab === 'TELAH_TERBIT' && (
                        <button className="text-brand-600 hover:underline" onClick={() => downloadCertificate(r)}>Download</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-900/40 p-4">
          <div className="w-full max-w-3xl rounded-card bg-white p-5 shadow-card">
            <h2 className="font-semibold">{editingId ? 'Edit' : 'Formulir'} EBUPOT BPA2</h2>

            <p className="mt-3 text-[13px] font-semibold text-ink-muted">General Information</p>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <div>
                <label className="field-label" htmlFor="wse">Working for a Second Employer</label>
                <select id="wse" className="field-input" value={workingForSecondEmployer ? 'Ya' : 'Tidak'}
                  onChange={(e) => setWorkingForSecondEmployer(e.target.value === 'Ya')}>
                  <option>Tidak</option><option>Ya</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="sm">Tax Period Start</label>
                <div className="flex gap-1">
                  <select id="sm" className="field-input" value={startMonth} onChange={(e) => setStartMonth(+e.target.value)}>
                    {MONTHS.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                  </select>
                  <input type="number" className="field-input" value={startYear} onChange={(e) => setStartYear(+e.target.value)} />
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="em">Tax Period End</label>
                <div className="flex gap-1">
                  <select id="em" className="field-input" value={endMonth} onChange={(e) => setEndMonth(+e.target.value)}>
                    {MONTHS.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                  </select>
                  <input type="number" className="field-input" value={endYear} onChange={(e) => setEndYear(+e.target.value)} />
                </div>
              </div>
              <div>
                <label className="field-label">Status</label>
                <output className="field-input block bg-canvas">NORMAL</output>
              </div>
              <div>
                <label className="field-label" htmlFor="btin">TIN</label>
                <input id="btin" className="field-input font-mono" maxLength={16} value={tin} onChange={(e) => handleTinChange(e.target.value)} />
                {tinNotFound && <p className="mt-1 text-xxs text-bad">Data tidak ditemukan. Isi manual di bawah.</p>}
              </div>
              <div>
                <label className="field-label" htmlFor="bnm">Name</label>
                <input id="bnm" className="field-input" value={nama} onChange={(e) => setNama(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Address</label>
                <output className="field-input block bg-canvas text-xxs">{matchedPerson?.alamat || '—'}</output>
              </div>
              <div>
                <label className="field-label" htmlFor="nip">NIP/NRP</label>
                <input id="nip" className="field-input" value={nip} onChange={(e) => setNip(e.target.value)} />
              </div>
              <div>
                <label className="field-label" htmlFor="gen">Gender</label>
                <select id="gen" className="field-input" value={gender} onChange={(e) => setGender(e.target.value)}>
                  {GENDER_OPTIONS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="gol">Class/Rank</label>
                <input id="gol" className="field-input" value={golongan} onChange={(e) => setGolongan(e.target.value)} />
              </div>
              <div>
                <label className="field-label" htmlFor="bptkp">Status of Tax Exemption</label>
                <select id="bptkp" className="field-input" value={ptkp} onChange={(e) => setPtkp(e.target.value)}>
                  {Object.keys(PTKP_AMOUNTS).map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="bjab">Position</label>
                <input id="bjab" className="field-input" value={jabatan} onChange={(e) => setJabatan(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Tax Object Name</label>
                <output className="field-input block bg-canvas text-xxs">{BPA2_TAX_OBJECT.name}</output>
              </div>
              <div>
                <label className="field-label">Tax Article</label>
                <output className="field-input block bg-canvas">PPh Pasal {BPA2_TAX_OBJECT.article}</output>
              </div>
              <div>
                <label className="field-label">Tax Object Code</label>
                <output className="field-input block bg-canvas font-mono">{BPA2_TAX_OBJECT.code}</output>
              </div>
              <div>
                <label className="field-label" htmlFor="sow">Status of Withholding</label>
                <select id="sow" className="field-input" value={statusWithholding} onChange={(e) => setStatusWithholding(e.target.value)}>
                  {STATUS_WITHHOLDING_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>

            <p className="mt-4 text-[13px] font-semibold text-ink-muted">Gross Income</p>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              {([
                ['salaryPensionThtJht', 'Salary/Pension or THT/JHT (Rp)'],
                ['wifeIncomeBenefit', 'Wife Income Benefit'],
                ['childrenIncomeBenefit', 'Children Income Benefit'],
                ['incomeImprovementBenefit', 'Income Improvement Benefit'],
                ['structuralFunctionalBenefit', 'Structural/Functional Benefit'],
                ['riceIncomeBenefit', 'Rice Income Benefit'],
                ['otherIncomeBenefit', 'Other Income Benefit'],
                ['otherFixedRegularIncome', 'Other Fixed and Regular Income Whose Payment is Separated from Salary Payments'],
              ] as [keyof GrossIncomeInput, string][]).map(([key, label]) => (
                <div key={key}>
                  <label className="field-label" htmlFor={key}>{label}</label>
                  <input id={key} type="number" className="field-input" value={gross[key]}
                    onChange={(e) => setGross((g) => ({ ...g, [key]: +e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="field-label">Total Gross Income (Rp)</label>
                <output className="field-input block bg-canvas font-semibold">{rupiah(gTotal)}</output>
              </div>
            </div>

            <p className="mt-4 text-[13px] font-semibold text-ink-muted">Perhitungan PPh Tahunan</p>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <div>
                <label className="field-label">Net Income (Rp)</label>
                <output className="field-input block bg-canvas">{rupiah(calc.netIncome)}</output>
              </div>
              <div className="md:col-span-2">
                <label className="field-label" htmlFor="psn">Previous Withholding Slip BPA1/BPA2 Number from Previous Employer (If any)</label>
                <div className="flex gap-1">
                  <input id="psn" className="field-input" value={previousSlipNumber} onChange={(e) => setPreviousSlipNumber(e.target.value)} />
                  <button type="button" className="btn-secondary shrink-0" title="Belum ada registry lintas pemberi kerja di simulator ini — isi manual di kolom sebelah">
                    Get data
                  </button>
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="nifp">Net Income from Previous Withholding Slip (Rp)</label>
                <input id="nifp" type="number" className="field-input" value={netIncomeFromPrevious}
                  onChange={(e) => setNetIncomeFromPrevious(+e.target.value)} />
              </div>
              <div>
                <label className="field-label">Total Net Income For Calculation of Income Tax Article 21 (In a Year/Annualized) (Rp)</label>
                <output className="field-input block bg-canvas">{rupiah(calc.totalNetIncomeForCalc)}</output>
              </div>
              <div>
                <label className="field-label">Tax Exemption (Rp)</label>
                <output className="field-input block bg-canvas">{rupiah(calc.taxExemption)}</output>
              </div>
              <div>
                <label className="field-label">Taxable Income In a Year/Annualized (Rp)</label>
                <output className="field-input block bg-canvas">{rupiah(calc.taxableIncome)}</output>
              </div>
              <div>
                <label className="field-label">Article 21 Income Tax on Taxable Income in a Year/Annualized (Rp)</label>
                <output className="field-input block bg-canvas">{rupiah(calc.article21TaxOnTaxableIncome)}</output>
              </div>
              <div>
                <label className="field-label">Article 21 Income Tax Liability (Rp)</label>
                <output className="field-input block bg-canvas">{rupiah(calc.article21TaxLiability)}</output>
              </div>
              <div>
                <label className="field-label" htmlFor="wfp">Article 21 Income Tax Withheld From Previous Withholding Slip (Rp)</label>
                <input id="wfp" type="number" className="field-input" value={withheldFromPrevious}
                  onChange={(e) => setWithheldFromPrevious(+e.target.value)} />
              </div>
              <div>
                <label className="field-label">Article 21 Income Tax Liability in this Withholding Slip (Rp)</label>
                <output className="field-input block bg-canvas">{rupiah(calc.article21TaxLiabilityInThisSlip)}</output>
              </div>
              <div>
                <label className="field-label" htmlFor="taxw">Article 21 Income Tax Withheld (Rp)</label>
                <div className="flex gap-1">
                  <input id="taxw" type="number" className="field-input" value={taxWithheld} onChange={(e) => setTaxWithheld(+e.target.value)} />
                  <button type="button" className="btn-secondary shrink-0 whitespace-nowrap text-xxs" onClick={sumFromBpmp}
                    title="Jumlahkan otomatis dari BPMP yang sudah terbit untuk NIK dan periode ini">
                    Dari BPMP
                  </button>
                </div>
              </div>
              <div>
                <label className="field-label">Article 21 Income Tax Under (Over) Payment (Rp)</label>
                <output className="field-input block bg-canvas">{rupiah(calc.underOverPayment)}</output>
              </div>
              <div>
                <label className="field-label">Revenue Code</label>
                <output className="field-input block bg-canvas font-mono">{BPA2_TAX_OBJECT.revenueCode}</output>
              </div>
              <div>
                <label className="field-label" htmlFor="bnitku">ID Place of Business Activity</label>
                {tkus.length > 0 ? (
                  <select id="bnitku" className="field-input font-mono text-xxs" value={nitku || tkus[0].nitku}
                    onChange={(e) => setNitku(e.target.value)}>
                    {tkus.map((t) => <option key={t.nitku} value={t.nitku}>{t.nitku} - {t.nama}</option>)}
                  </select>
                ) : (
                  <output className="field-input block bg-canvas text-xxs">Belum ada TKU terdaftar</output>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setFormOpen(false)}>Tutup</button>
              <button className="btn-secondary" onClick={() => saveDraft(false)}>Save Draft</button>
              <button className="btn-primary" onClick={() => saveDraft(true)}>Submit</button>
            </div>
          </div>
        </div>
      )}

      {viewDoc && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-900/40 p-4">
          <div className="w-full max-w-lg rounded-card bg-white p-5 shadow-card">
            <h2 className="font-semibold">Detail Bukti Pemotongan BPA2</h2>
            <dl className="mt-3 grid grid-cols-2 gap-y-2 text-[13px]">
              <dt className="text-ink-muted">Nomor Bupot</dt><dd className="font-mono">{viewDoc.withholdingNumber ?? '—'}</dd>
              <dt className="text-ink-muted">Masa Pajak</dt>
              <dd>
                {monthLabel(Number(viewDoc.fields.startMonth ?? viewDoc.taxPeriodMonth))}/
                {String(viewDoc.fields.startYear ?? viewDoc.taxPeriodYear)} — {monthLabel(viewDoc.taxPeriodMonth)}/{viewDoc.taxPeriodYear}
              </dd>
              <dt className="text-ink-muted">TIN/NIK</dt><dd className={`font-mono ${viewDoc.counterpartTin === NIK_TIDAK_PADAN ? 'text-bad' : ''}`}>{viewDoc.counterpartTin}</dd>
              <dt className="text-ink-muted">Nama</dt><dd>{viewDoc.counterpartName}</dd>
              <dt className="text-ink-muted">Total Bruto</dt><dd>{rupiah(viewDoc.gross)}</dd>
              <dt className="text-ink-muted">Net Income</dt><dd>{rupiah(Number(viewDoc.fields.netIncome ?? 0))}</dd>
              <dt className="text-ink-muted">Taxable Income</dt><dd>{rupiah(Number(viewDoc.fields.taxableIncome ?? 0))}</dd>
              <dt className="text-ink-muted">PPh Terutang Setahun</dt><dd>{rupiah(Number(viewDoc.fields.taxLiability ?? 0))}</dd>
              <dt className="text-ink-muted">PPh Slip Ini</dt><dd>{rupiah(viewDoc.withheld)}</dd>
              <dt className="text-ink-muted">Kurang/(Lebih) Bayar</dt><dd>{rupiah(Number(viewDoc.fields.underOverPayment ?? 0))}</dd>
              <dt className="text-ink-muted">ID Place of Business Activity</dt><dd className="font-mono text-xxs">{viewDoc.idPlaceOfBusinessActivity}</dd>
            </dl>
            <div className="mt-5 flex justify-end">
              <button className="btn-secondary" onClick={() => setViewing(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {signing && (
        <SignDialog signerNik={db.session!.personNik} onCancel={() => setSigning(false)} onConfirm={issue} />
      )}
    </div>
  );
}
