'use client';

import { useMemo, useState } from 'react';
import { useDb } from '@/lib/storage/useDb';
import { nextWithholdingNumber, type Database } from '@/lib/storage/db';
import {
  BPPU_ARTICLE_LABEL, BPPU_REFERENCE_DOCUMENT_TYPES, BPPU_TAX_FACILITY_OPTIONS, BPPU_TAX_OBJECTS,
  taxObjectByName, withheldByTaxObject,
} from '@/lib/domain/bppu';
import { tabOf, type BupotDoc, type DocTab } from '@/lib/domain/types';
import { canDraft, canSign, explainDenied, filterVisibleBupots } from '@/lib/auth/access';
import { ImportMenuButton } from '@/components/ui/ImportMenuButton';
import { ExportIconRow } from '@/components/ui/ExportIconRow';
import {
  csvRowsToRecords, downloadCsv, downloadExcelTemplate, downloadXls, parseSpreadsheetXml, pickCsvFile, printAsPdf,
} from '@/lib/storage/csv';
import { Pencil } from 'lucide-react';

/**
 * EBUPOT BPU — Bukti Pemotongan/Pemungutan Unifikasi, slide 1-13 PDF
 * "E-Bupot Unifikasi". Satu formulir dipakai untuk SEMUA pasal yang
 * tercakup Unifikasi (4 ayat 2, 15, 22, 23, 26) — "Nama Objek Pajak" yang
 * dipilih menentukan Jenis Pajak/Tax Article/Kode Objek Pajak/Sifat secara
 * otomatis, bukan wizard "pilih jenis dulu" terpisah (lihat catatan di
 * `lib/domain/bppu.ts`). Tidak ada Sign Document di sini — PDF tidak pernah
 * menunjukkan dialog tanda tangan untuk BPPU (beda dari BP21/BPA2), persis
 * pola BPMP: Terbitkan langsung mem-posting.
 *
 * Status SUBMITTED sengaja TETAP di tab Belum Terbit sampai "Terbitkan"
 * berhasil — bukan berpindah otomatis begitu Submit ditekan (lihat slide 13
 * "Bukti Pemotongan dengan Status Submitted masih dalam menu eBupot Belum
 * Terbit, belum dilakukan Posting").
 */

const TABS: { key: DocTab; label: string }[] = [
  { key: 'BELUM_TERBIT', label: 'Belum Terbit' },
  { key: 'TELAH_TERBIT', label: 'Telah Terbit' },
  { key: 'TIDAK_VALID', label: 'Tidak Valid' },
];

const TIN_TIDAK_PADAN = '9990000000999000';
const rupiah = (n: number) => n.toLocaleString('id-ID');

const IMPORT_HEADERS = [
  'TaxPeriodMonth', 'TaxPeriodYear', 'CounterpartTin', 'CounterpartName',
  'TaxFacility', 'TaxObjectName', 'Gross', 'ReferenceDocumentType',
  'ReferenceDocumentNumber', 'ReferenceDocumentDate', 'IDPlaceOfBusinessActivity',
];
const IMPORT_EXAMPLE = [
  10, 2024, '0618265886', 'Nama Lawan Transaksi', 'Tanpa Fasilitas',
  BPPU_TAX_OBJECTS[0].name, 100_000_000, 'Akta Perjanjian', '123', '2025-01-08', '0012345678910000000000',
];

export default function BppuPage() {
  const { db, mutate } = useDb();
  const [tab, setTab] = useState<DocTab>('BELUM_TERBIT');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const entityTin = db.session?.impersonatingTin ?? null;
  const tkus = useMemo(() => db.tkus.filter((t) => t.entityTin === entityTin), [db.tkus, entityTin]);
  const rows = useMemo(() => {
    if (!db.session) return [];
    const visible = filterVisibleBupots(
      db.bupots.filter((b) => b.kind === 'BPPU'),
      db.roleAssignments,
      db.session,
      db.relatedParties,
    );
    return visible.filter((b) => tabOf(b.status) === tab);
  }, [db.bupots, db.roleAssignments, db.relatedParties, db.session, tab]);

  // Formulir — General Information
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [tin, setTin] = useState('');
  const [nama, setNama] = useState('');
  const [counterpartNitku, setCounterpartNitku] = useState('');

  // Formulir — Income Tax
  const [taxFacility, setTaxFacility] = useState<string>(BPPU_TAX_FACILITY_OPTIONS[0]);
  const [taxObjectName, setTaxObjectName] = useState(BPPU_TAX_OBJECTS[0].name);
  const [gross, setGross] = useState(0);

  // Formulir — Dokumen Referensi (ditampilkan untuk objek bersifat Final, mengikuti contoh Persewaan di slide 12)
  const [refDocType, setRefDocType] = useState<string>(BPPU_REFERENCE_DOCUMENT_TYPES[0]);
  const [refDocNumber, setRefDocNumber] = useState('');
  const [refDocDate, setRefDocDate] = useState('');
  const [nitku, setNitku] = useState('');

  const taxObject = taxObjectByName(taxObjectName);
  const preview = withheldByTaxObject(taxObjectName, gross);
  const cleanTin = tin.replace(/\D/g, '');

  if (!entityTin) {
    return (
      <p className="rounded-card bg-white p-5 text-sm shadow-card">
        Pilih badan yang Anda wakili di menu Portal Saya sebelum membuat bukti pemotongan.
      </p>
    );
  }

  const canDraftBppu = canDraft(db.roleAssignments, db.session!, 'BPPU', db.relatedParties);
  const canSignBppu = canSign(db.roleAssignments, db.session!, 'BPPU', db.relatedParties);

  if (!canDraftBppu && !canSignBppu) {
    return (
      <p className="rounded-card bg-white p-5 text-sm shadow-card">
        {explainDenied('draft', 'BPPU')}
      </p>
    );
  }

  function resetForm() {
    setEditingId(null);
    setMonth(new Date().getMonth() + 1); setYear(new Date().getFullYear());
    setTin(''); setNama(''); setCounterpartNitku('');
    setTaxFacility(BPPU_TAX_FACILITY_OPTIONS[0]);
    setTaxObjectName(BPPU_TAX_OBJECTS[0].name);
    setGross(0);
    setRefDocType(BPPU_REFERENCE_DOCUMENT_TYPES[0]); setRefDocNumber(''); setRefDocDate('');
    setNitku(tkus[0]?.nitku ?? '');
  }

  function openCreate() {
    resetForm();
    setFormOpen(true);
  }

  /** Icon pensil [edit] — isi ulang formulir dari draft/submitted yang dipilih. */
  function openEdit(doc: BupotDoc) {
    if (!canDraftBppu) return;
    setEditingId(doc.id);
    setMonth(doc.taxPeriodMonth); setYear(doc.taxPeriodYear);
    setTin(doc.counterpartTin === TIN_TIDAK_PADAN ? '' : doc.counterpartTin);
    setNama(doc.counterpartName);
    setCounterpartNitku(String(doc.fields.counterpartNitku ?? ''));
    setTaxFacility(String(doc.fields.taxFacility ?? BPPU_TAX_FACILITY_OPTIONS[0]));
    setTaxObjectName(String(doc.fields.taxObjectName ?? BPPU_TAX_OBJECTS[0].name));
    setGross(doc.gross);
    setRefDocType(String(doc.fields.referenceDocumentType ?? BPPU_REFERENCE_DOCUMENT_TYPES[0]));
    setRefDocNumber(String(doc.fields.referenceDocumentNumber ?? ''));
    setRefDocDate(String(doc.fields.referenceDocumentDate ?? ''));
    setNitku(doc.idPlaceOfBusinessActivity);
    setFormOpen(true);
  }

  function resolveCounterpart(rawTin: string, fallbackName: string) {
    const clean = rawTin.replace(/\D/g, '');
    const person = db.persons.find((p) => p.nik === clean || p.npwp16 === clean);
    const resolvedTin = clean && (!person || person.padan) ? clean : TIN_TIDAK_PADAN;
    return { resolvedTin, name: person?.nama ?? fallbackName };
  }

  function saveDraft(submit: boolean) {
    if (!canDraftBppu) { setNotice(explainDenied('draft', 'BPPU')); return; }
    const { resolvedTin, name } = resolveCounterpart(tin, nama);
    const chosenNitku = nitku || tkus[0]?.nitku || `${entityTin}000000`;

    mutate((d) => {
      const fields = {
        taxFacility,
        taxObjectName,
        article: taxObject.article,
        sifat: taxObject.sifat,
        kap: taxObject.kap,
        counterpartNitku: counterpartNitku || undefined,
        referenceDocumentType: taxObject.sifat === 'FINAL' ? refDocType : undefined,
        referenceDocumentNumber: taxObject.sifat === 'FINAL' ? refDocNumber : undefined,
        referenceDocumentDate: taxObject.sifat === 'FINAL' ? refDocDate : undefined,
      };
      const existing = editingId ? d.bupots.find((b) => b.id === editingId) : undefined;
      if (existing) {
        Object.assign(existing, {
          status: submit ? 'SUBMITTED' : 'DRAFT',
          taxPeriodMonth: month,
          taxPeriodYear: year,
          counterpartTin: resolvedTin,
          counterpartName: name,
          taxObjectCode: taxObject.code,
          gross,
          rate: preview.rate,
          withheld: preview.withheld,
          idPlaceOfBusinessActivity: chosenNitku,
          fields,
        });
      } else {
        d.bupots.push({
          id: crypto.randomUUID(),
          kind: 'BPPU',
          entityTin: entityTin!,
          status: submit ? 'SUBMITTED' : 'DRAFT',
          withholdingNumber: null,
          taxPeriodMonth: month,
          taxPeriodYear: year,
          counterpartTin: resolvedTin,
          counterpartName: name,
          taxObjectCode: taxObject.code,
          gross,
          rate: preview.rate,
          withheld: preview.withheld,
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
      resolvedTin === TIN_TIDAK_PADAN
        ? `Data tersimpan, tetapi NPWP16/NIK ${cleanTin || '(kosong)'} tidak dikenali dan dicatat sebagai ${TIN_TIDAK_PADAN}. Bukti potong ini tidak dapat dikreditkan. Padankan NIK/NPWP lawan transaksi terlebih dahulu.`
        : submit
          ? 'Dokumen berhasil disubmit. Status SUBMITTED tetap berada di daftar Belum Terbit sampai diterbitkan (posting).'
          : 'Draft bukti pemotongan tersimpan pada daftar Belum Terbit.',
    );
    setFormOpen(false);
    resetForm();
  }

  /**
   * Terbitkan (posting) — TANPA Sign Document, lihat catatan di atas file.
   * Ini satu-satunya titik status berubah dari SUBMITTED ke ISSUED.
   */
  function issue() {
    if (!canSignBppu) return;
    mutate((d) => {
      for (const id of selected) {
        const doc = d.bupots.find((b) => b.id === id);
        if (!doc || doc.status === 'ISSUED' || doc.status === 'CANCELLED') continue;
        doc.status = 'ISSUED';
        doc.withholdingNumber = nextWithholdingNumber(d, doc.entityTin, doc.taxPeriodYear);
        doc.signature = null;
      }
    });
    setSelected([]);
    setNotice('Data successfully issued! Bukti pemotongan masuk ke Daftar-I draft SPT Masa PPh Unifikasi.');
    setTab('TELAH_TERBIT');
  }

  function cancel() {
    if (!canSignBppu) return;
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
    setNotice('Bukti pemotongan dibatalkan dan berpindah ke daftar Tidak Valid. Nomor dan data dokumen asal tetap dipertahankan sebagai riwayat.');
  }

  function remove() {
    if (!canDraftBppu) return;
    mutate((d) => {
      d.bupots = d.bupots.filter((b) => !(selected.includes(b.id) && b.status !== 'ISSUED'));
    });
    setSelected([]);
  }

  function refresh() { mutate(() => {}); }

  const exportHeaders = ['Tax Period', 'Withholding Number', 'Status', 'Jenis Pajak', 'NIK/NPWP', 'Nama', 'DPP', 'Tarif', 'PPh Dipotong/Dipungut'];
  const exportRows = () => rows.map((r) => [
    `${String(r.taxPeriodMonth).padStart(2, '0')}/${r.taxPeriodYear}`,
    r.withholdingNumber ?? '-',
    r.status,
    BPPU_ARTICLE_LABEL[(r.fields.article as keyof typeof BPPU_ARTICLE_LABEL) ?? '23'] ?? '-',
    r.counterpartTin,
    r.counterpartName,
    r.gross,
    r.rate,
    r.withheld,
  ]);
  const exportFileBase = () => `ebupot-bppu-${TABS.find((t) => t.key === tab)!.label.toLowerCase().replace(/\s+/g, '-')}`;

  function exportCsv() { downloadCsv(`${exportFileBase()}.csv`, exportHeaders, exportRows()); }
  function exportXls() { downloadXls(`${exportFileBase()}.xls`, exportHeaders, exportRows()); }
  function exportPdf() { printAsPdf(`EBUPOT BPU — ${TABS.find((t) => t.key === tab)!.label}`, exportHeaders, exportRows()); }

  function downloadTemplate() {
    downloadExcelTemplate('template-impor-bppu.xls', 'Sheet1', IMPORT_HEADERS, IMPORT_EXAMPLE);
  }

  function uploadFile() {
    if (!canDraftBppu) { setNotice(explainDenied('draft', 'BPPU')); return; }
    pickCsvFile((text) => {
      const raw = parseSpreadsheetXml(text);
      const records = csvRowsToRecords(raw);
      if (records.length === 0) { setNotice('File kosong atau formatnya tidak sesuai template. Jika Anda mengedit dan menyimpan ulang di Excel, pastikan tetap disimpan sebagai "Web Page/XML Spreadsheet 2003 (.xls)", bukan dikonversi ke .xlsx.'); return; }

      let created = 0;
      const errors: string[] = [];
      mutate((d: Database) => {
        records.forEach((rec, i) => {
          const rowLabel = `Baris ${i + 2}`;
          const m = Number(rec.TaxPeriodMonth), y = Number(rec.TaxPeriodYear), g = Number(rec.Gross);
          const obj = BPPU_TAX_OBJECTS.find((o) => o.name === rec.TaxObjectName);
          if (!m || m < 1 || m > 12) { errors.push(`${rowLabel}: TaxPeriodMonth tidak valid.`); return; }
          if (!y) { errors.push(`${rowLabel}: TaxPeriodYear tidak valid.`); return; }
          if (!rec.CounterpartTin) { errors.push(`${rowLabel}: CounterpartTin kosong.`); return; }
          if (!obj) { errors.push(`${rowLabel}: TaxObjectName "${rec.TaxObjectName}" tidak dikenali — cocokkan persis dengan pilihan pada formulir.`); return; }
          if (!g || g <= 0) { errors.push(`${rowLabel}: Gross tidak valid.`); return; }

          const { resolvedTin, name } = resolveCounterpart(rec.CounterpartTin, rec.CounterpartName || '(tanpa nama)');
          const { withheld } = withheldByTaxObject(obj.name, g);
          d.bupots.push({
            id: crypto.randomUUID(),
            kind: 'BPPU',
            entityTin: entityTin!,
            status: 'DRAFT',
            withholdingNumber: null,
            taxPeriodMonth: m,
            taxPeriodYear: y,
            counterpartTin: resolvedTin,
            counterpartName: name,
            taxObjectCode: obj.code,
            gross: g,
            rate: obj.rate,
            withheld,
            idPlaceOfBusinessActivity: rec.IDPlaceOfBusinessActivity || tkus[0]?.nitku || `${entityTin}000000`,
            createdByNik: d.session!.personNik,
            createdAt: new Date().toISOString(),
            signature: null,
            cancelledAt: null,
            fields: {
              taxFacility: rec.TaxFacility || BPPU_TAX_FACILITY_OPTIONS[0],
              taxObjectName: obj.name,
              article: obj.article,
              sifat: obj.sifat,
              kap: obj.kap,
              referenceDocumentType: rec.ReferenceDocumentType || undefined,
              referenceDocumentNumber: rec.ReferenceDocumentNumber || undefined,
              referenceDocumentDate: rec.ReferenceDocumentDate || undefined,
            },
          });
          created++;
        });
      });

      setTab('BELUM_TERBIT');
      setNotice(
        errors.length === 0
          ? `${created} bukti pemotongan berhasil diimpor ke daftar Belum Terbit.`
          : `${created} baris berhasil diimpor. ${errors.length} baris gagal: ${errors.slice(0, 5).join(' ')}${errors.length > 5 ? ' …' : ''}`,
      );
    }, '.xls,.xml,application/vnd.ms-excel,application/xml,text/xml');
  }

  const viewDoc = viewing ? db.bupots.find((b) => b.id === viewing) : null;

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(220px,20%)_minmax(0,1fr)]">
      <aside className="rounded-card bg-white p-3 shadow-card">
        <p className="px-2 pb-2 text-[13px] font-semibold text-brand-800">
          Bukti Pemotongan/Pemungutan Unifikasi
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
          <h1 className="font-semibold">EBUPOT BPU</h1>
          <div className="ml-auto flex gap-2">
            {tab === 'BELUM_TERBIT' && (
              <>
                <button
                  className="btn-secondary"
                  onClick={openCreate}
                  disabled={!canDraftBppu}
                  title={!canDraftBppu ? explainDenied('draft', 'BPPU') : undefined}
                >
                  + Create eBupot BPU
                </button>
                <button
                  className="btn-secondary"
                  onClick={remove}
                  disabled={!selected.length || !canDraftBppu}
                  title={!canDraftBppu ? explainDenied('draft', 'BPPU') : undefined}
                >
                  Hapus
                </button>
                <button
                  className="btn-primary"
                  onClick={issue}
                  disabled={!selected.length || !canSignBppu}
                  title={!canSignBppu ? explainDenied('sign', 'BPPU') : undefined}
                >
                  Terbitkan
                </button>
                <ImportMenuButton
                  disabled={!canDraftBppu}
                  title={explainDenied('draft', 'BPPU')}
                  onDownloadTemplate={downloadTemplate}
                  onUpload={uploadFile}
                />
              </>
            )}
            {tab === 'TELAH_TERBIT' && (
              <button
                className="btn-secondary"
                onClick={cancel}
                disabled={!selected.length || !canSignBppu}
                title={!canSignBppu ? explainDenied('sign', 'BPPU') : undefined}
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

        <div className="mt-3">
          <ExportIconRow onRefresh={refresh} onCsv={exportCsv} onXls={exportXls} onPdf={exportPdf} />
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10" />
                <th>Tax Period</th>
                <th>Withholding Number</th>
                <th>Status</th>
                <th>E-Sign Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-muted">
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
                  <td className="text-xxs">{r.status}</td>
                  <td className="text-xxs">—</td>
                  <td>
                    <div className="flex gap-2">
                      {tab === 'BELUM_TERBIT' && r.status !== 'ISSUED' && canDraftBppu && (
                        <button className="text-brand-600 hover:text-brand-800" title="Edit" onClick={() => openEdit(r)}>
                          <Pencil size={15} />
                        </button>
                      )}
                      <button className="text-brand-600 hover:underline" onClick={() => setViewing(r.id)}>
                        Lihat
                      </button>
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
            <h2 className="font-semibold">{editingId ? 'Edit' : 'Formulir'} EBUPOT BPU</h2>

            <p className="mt-3 text-[13px] font-semibold text-ink-muted">General Information</p>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <div>
                <label className="field-label" htmlFor="m">Tax Period (Masa Pajak)</label>
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
                <label className="field-label">Status</label>
                <output className="field-input block bg-canvas">NORMAL</output>
              </div>
              <div>
                <label className="field-label" htmlFor="tin">TIN (NPWP16/NIK lawan transaksi)</label>
                <input id="tin" className="field-input font-mono" maxLength={16} value={tin}
                  onChange={(e) => setTin(e.target.value)} />
              </div>
              <div>
                <label className="field-label" htmlFor="nm">Name (otomatis bila TIN valid)</label>
                <input id="nm" className="field-input" value={nama} onChange={(e) => setNama(e.target.value)} />
              </div>
              <div>
                <label className="field-label" htmlFor="cnitku">NITKU Lawan Transaksi</label>
                <input id="cnitku" className="field-input font-mono text-xxs" value={counterpartNitku}
                  onChange={(e) => setCounterpartNitku(e.target.value)} placeholder="22 digit, opsional bila berstatus cabang" />
              </div>
            </div>

            <p className="mt-4 text-[13px] font-semibold text-ink-muted">Income Tax</p>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <div>
                <label className="field-label" htmlFor="tf">Fasilitas Pajak yang Dimiliki oleh Penerima Penghasilan</label>
                <select id="tf" className="field-input" value={taxFacility} onChange={(e) => setTaxFacility(e.target.value)}>
                  {BPPU_TAX_FACILITY_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="ton">Nama Objek Pajak</label>
                <select id="ton" className="field-input" value={taxObjectName} onChange={(e) => setTaxObjectName(e.target.value)}>
                  {BPPU_TAX_OBJECTS.map((o) => (
                    <option key={o.name}>{o.name}{!o.verified ? ' (perlu dikonfirmasi)' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Jenis Pajak</label>
                <output className="field-input block bg-canvas">{BPPU_ARTICLE_LABEL[taxObject.article]}</output>
              </div>
              <div>
                <label className="field-label">Kode Objek Pajak</label>
                <output className="field-input block bg-canvas font-mono">{taxObject.code}</output>
              </div>
              <div>
                <label className="field-label">Sifat Pajak Penghasilan</label>
                <output className="field-input block bg-canvas">{taxObject.sifat === 'FINAL' ? 'Final' : 'Tidak Final'}</output>
              </div>
              <div>
                <label className="field-label" htmlFor="g">Dasar Pengenaan Pajak / Penghasilan Bruto (Rp)</label>
                <input id="g" type="number" className="field-input" value={gross}
                  onChange={(e) => setGross(+e.target.value)} />
              </div>
              <div>
                <label className="field-label">Tarif (%)</label>
                <output className="field-input block bg-canvas">{taxObject.rate},00</output>
              </div>
              <div>
                <label className="field-label">Pajak Penghasilan (Rp)</label>
                <output className="field-input block bg-canvas">{rupiah(preview.withheld)}</output>
              </div>
              <div>
                <label className="field-label">KAP</label>
                <output className="field-input block bg-canvas font-mono">{taxObject.kap}</output>
              </div>
            </div>
            {!taxObject.verified && (
              <p className="mt-2 rounded-md border border-accent/40 bg-[#FFF8E6] px-3 py-2 text-xxs text-ink">
                Kode objek pajak, tarif, dan KAP untuk objek ini belum ditunjukkan terisi di PDF panduan —
                cocokkan ke PMK-141/PMK.03/2015 atau referensi KAP-KJS resmi sebelum dipakai menilai jawaban
                mahasiswa. Hanya "Persewaan Tanah dan/atau Bangunan" yang terverifikasi penuh dari contoh PDF.
              </p>
            )}

            {taxObject.sifat === 'FINAL' && (
              <>
                <p className="mt-4 text-[13px] font-semibold text-ink-muted">Dokumen Referensi</p>
                <div className="mt-2 grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="field-label" htmlFor="rdt">Jenis Dokumen</label>
                    <select id="rdt" className="field-input" value={refDocType} onChange={(e) => setRefDocType(e.target.value)}>
                      {BPPU_REFERENCE_DOCUMENT_TYPES.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="rdn">Nomor Dokumen</label>
                    <input id="rdn" className="field-input" value={refDocNumber} onChange={(e) => setRefDocNumber(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="rdd">Tanggal Dokumen</label>
                    <input id="rdd" type="date" className="field-input" value={refDocDate} onChange={(e) => setRefDocDate(e.target.value)} />
                  </div>
                </div>
              </>
            )}

            <p className="mt-4 text-[13px] font-semibold text-ink-muted">NITKU Pemotong</p>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <div>
                <label className="field-label" htmlFor="pemotong-nitku">NITKU/Nomor Identitas Sub Unit Organisasi</label>
                {tkus.length > 0 ? (
                  <select id="pemotong-nitku" className="field-input font-mono text-xxs" value={nitku || tkus[0].nitku}
                    onChange={(e) => setNitku(e.target.value)}>
                    {tkus.map((t) => (
                      <option key={t.nitku} value={t.nitku}>{t.nitku} - {t.nama}</option>
                    ))}
                  </select>
                ) : (
                  <output className="field-input block bg-canvas text-xxs">
                    Belum ada TKU terdaftar — tambahkan di Manajemen Akses
                  </output>
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
            <h2 className="font-semibold">Detail Bukti Pemotongan/Pemungutan Unifikasi</h2>
            <dl className="mt-3 grid grid-cols-2 gap-y-2 text-[13px]">
              <dt className="text-ink-muted">Nomor Bupot</dt><dd className="font-mono">{viewDoc.withholdingNumber ?? '—'}</dd>
              <dt className="text-ink-muted">Masa Pajak</dt><dd>{String(viewDoc.taxPeriodMonth).padStart(2, '0')}/{viewDoc.taxPeriodYear}</dd>
              <dt className="text-ink-muted">Status</dt><dd>{viewDoc.status}</dd>
              <dt className="text-ink-muted">NIK/NPWP</dt><dd className={`font-mono ${viewDoc.counterpartTin === TIN_TIDAK_PADAN ? 'text-bad' : ''}`}>{viewDoc.counterpartTin}</dd>
              <dt className="text-ink-muted">Nama</dt><dd>{viewDoc.counterpartName}</dd>
              <dt className="text-ink-muted">Jenis Pajak</dt><dd>{BPPU_ARTICLE_LABEL[(viewDoc.fields.article as '4(2)'|'15'|'22'|'23'|'26') ?? '23']}</dd>
              <dt className="text-ink-muted">Nama Objek Pajak</dt><dd>{String(viewDoc.fields.taxObjectName ?? '—')}</dd>
              <dt className="text-ink-muted">Kode Objek Pajak</dt><dd className="font-mono">{viewDoc.taxObjectCode}</dd>
              <dt className="text-ink-muted">Sifat</dt><dd>{viewDoc.fields.sifat === 'FINAL' ? 'Final' : 'Tidak Final'}</dd>
              <dt className="text-ink-muted">DPP/Bruto</dt><dd>{rupiah(viewDoc.gross)}</dd>
              <dt className="text-ink-muted">Tarif</dt><dd>{viewDoc.rate}%</dd>
              <dt className="text-ink-muted">PPh Dipotong/Dipungut</dt><dd>{rupiah(viewDoc.withheld)}</dd>
              <dt className="text-ink-muted">KAP</dt><dd className="font-mono">{String(viewDoc.fields.kap ?? '—')}</dd>
              <dt className="text-ink-muted">NITKU Pemotong</dt><dd className="font-mono text-xxs">{viewDoc.idPlaceOfBusinessActivity}</dd>
              {viewDoc.fields.referenceDocumentType ? (
                <>
                  <dt className="text-ink-muted">Dokumen Referensi</dt>
                  <dd>{String(viewDoc.fields.referenceDocumentType)} {String(viewDoc.fields.referenceDocumentNumber ?? '')}</dd>
                </>
              ) : null}
            </dl>
            <div className="mt-5 flex justify-end">
              <button className="btn-secondary" onClick={() => setViewing(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
