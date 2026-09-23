'use client';

import { useMemo, useState } from 'react';
import { useDb } from '@/lib/storage/useDb';
import { nextWithholdingNumber, type Database } from '@/lib/storage/db';
import {
  BP21_REFERENCE_DOCUMENT_TYPES, BP21_TAX_FACILITY_OPTIONS, BP21_TAX_OBJECTS,
  taxObjectByName, withheldByTaxObject,
} from '@/lib/domain/bp21';
import { PTKP_OPTIONS } from '@/lib/domain/ter';
import { tabOf, type BupotDoc, type DocTab } from '@/lib/domain/types';
import { SignDialog } from '@/components/ui/SignDialog';
import { canDraft, canSign, explainDenied, filterVisibleBupots } from '@/lib/auth/access';
import { ImportMenuButton } from '@/components/ui/ImportMenuButton';
import { ExportIconRow } from '@/components/ui/ExportIconRow';
import {
  csvRowsToRecords, downloadCsv, downloadXls, downloadXmlTemplate, parseSpreadsheetXml, pickCsvFile, printAsPdf,
} from '@/lib/storage/csv';
import { Pencil } from 'lucide-react';

/**
 * Bukti Pemotongan PPh Pasal 21 Selain Pegawai Tetap (BP21), slide 82-93.
 * Alur, tiga tab, dan tombol aksi disalin persis dari EBUPOT MP
 * (`ebupot/bpmp/page.tsx`) — yang berbeda hanya isi formulir: General
 * Information, Income Tax (Tax Object Name meng-auto-isi Article/Code/
 * Status/Deemed Net Income/Rate/Revenue Code), dan Reference Document
 * [12]-[15]. Edit draft, Impor Data (XML asli/SpreadsheetML — sama seperti
 * BPMP, lihat `lib/storage/csv.ts`), dan Export CSV/Excel/PDF sudah
 * lengkap. ID Place of Business Activity (Pemotong) memakai dropdown TKU
 * sungguhan dari `db.tkus`, sama seperti BPMP.
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
  'StatusTaxExemption', 'TaxFacility', 'TaxObjectName', 'Gross',
  'ReferenceDocumentType', 'ReferenceDocumentNumber', 'ReferenceDocumentDate', 'IDPlaceOfBusinessActivity',
];
const IMPORT_EXAMPLE = [
  9, 2024, '3217122601770007', 'Nama Penerima Penghasilan', 'K/3', 'Tanpa Fasilitas',
  BP21_TAX_OBJECTS[0].name, 2_000_000, 'Bukti Pembayaran', '456', '2024-09-20', '0012345678910000000000',
];

export default function Bp21Page() {
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
      db.bupots.filter((b) => b.kind === 'BP21'),
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

  // Formulir — Income Tax
  const [ptkp, setPtkp] = useState('K/0');
  const [taxFacility, setTaxFacility] = useState<string>(BP21_TAX_FACILITY_OPTIONS[0]);
  const [taxObjectName, setTaxObjectName] = useState(BP21_TAX_OBJECTS[0].name);
  const [gross, setGross] = useState(0);

  // Formulir — Reference Document
  const [refDocType, setRefDocType] = useState<string>(BP21_REFERENCE_DOCUMENT_TYPES[0]);
  const [refDocNumber, setRefDocNumber] = useState('');
  const [refDocDate, setRefDocDate] = useState('');
  const [nitku, setNitku] = useState('');

  const taxObject = taxObjectByName(taxObjectName);
  const preview = withheldByTaxObject(taxObjectName, gross);
  const cleanTin = tin.replace(/\D/g, '');
  // Field [7] "ID Place of Business Activity of Income Recipient": NITKU milik
  // penerima penghasilan sendiri. Data model belum punya registry NITKU per
  // penerima, jadi dipakai konvensi Coretax untuk NITKU Induk (TIN + 000000),
  // sama seperti satu-satunya opsi yang muncul pada contoh di slide.
  const recipientNitku = cleanTin.length === 16 ? `${cleanTin}000000` : '';

  if (!entityTin) {
    return (
      <p className="rounded-card bg-white p-5 text-sm shadow-card">
        Pilih badan yang Anda wakili di menu Portal Saya sebelum membuat bukti pemotongan.
      </p>
    );
  }

  const canDraftBp21 = canDraft(db.roleAssignments, db.session!, 'BP21', db.relatedParties);
  const canSignBp21 = canSign(db.roleAssignments, db.session!, 'BP21', db.relatedParties);

  if (!canDraftBp21 && !canSignBp21) {
    return (
      <p className="rounded-card bg-white p-5 text-sm shadow-card">
        {explainDenied('draft', 'BP21')}
      </p>
    );
  }

  function resetForm() {
    setEditingId(null);
    setMonth(new Date().getMonth() + 1); setYear(new Date().getFullYear());
    setTin(''); setNama('');
    setPtkp('K/0'); setTaxFacility(BP21_TAX_FACILITY_OPTIONS[0]); setTaxObjectName(BP21_TAX_OBJECTS[0].name);
    setGross(0);
    setRefDocType(BP21_REFERENCE_DOCUMENT_TYPES[0]); setRefDocNumber(''); setRefDocDate('');
    setNitku(tkus[0]?.nitku ?? '');
  }

  function openCreate() {
    resetForm();
    setFormOpen(true);
  }

  /** Icon pensil [edit] — isi ulang formulir dari draft yang dipilih (slide "Klik icon pensil"). */
  function openEdit(doc: BupotDoc) {
    if (!canDraftBp21) return;
    setEditingId(doc.id);
    setMonth(doc.taxPeriodMonth); setYear(doc.taxPeriodYear);
    setTin(doc.counterpartTin === TIN_TIDAK_PADAN ? '' : doc.counterpartTin);
    setNama(doc.counterpartName);
    setPtkp(String(doc.fields.ptkp ?? 'K/0'));
    setTaxFacility(String(doc.fields.taxFacility ?? BP21_TAX_FACILITY_OPTIONS[0]));
    setTaxObjectName(String(doc.fields.taxObjectName ?? BP21_TAX_OBJECTS[0].name));
    setGross(doc.gross);
    setRefDocType(String(doc.fields.referenceDocumentType ?? BP21_REFERENCE_DOCUMENT_TYPES[0]));
    setRefDocNumber(String(doc.fields.referenceDocumentNumber ?? ''));
    setRefDocDate(String(doc.fields.referenceDocumentDate ?? ''));
    setNitku(doc.idPlaceOfBusinessActivity);
    setFormOpen(true);
  }

  function resolveCounterpart(rawTin: string, fallbackName: string) {
    const clean = rawTin.replace(/\D/g, '');
    const person = db.persons.find((p) => p.nik === clean || p.npwp16 === clean);
    // NIK/NPWP yang tidak padan diganti sentinel — sama seperti EBUPOT MP.
    const resolvedTin = clean && (!person || person.padan) ? clean : TIN_TIDAK_PADAN;
    return { resolvedTin, name: person?.nama ?? fallbackName };
  }

  function saveDraft(submit: boolean) {
    if (!canDraftBp21) { setNotice(explainDenied('draft', 'BP21')); return; }
    const { resolvedTin, name } = resolveCounterpart(tin, nama);
    const chosenNitku = nitku || tkus[0]?.nitku || `${entityTin}000000`;

    mutate((d) => {
      const fields = {
        ptkp,
        taxFacility,
        taxObjectName,
        incomeTaxStatus: taxObject.incomeTaxStatus,
        deemedNetIncome: taxObject.deemedNetIncome,
        revenueCode: taxObject.revenueCode,
        counterpartNitku: recipientNitku || undefined,
        referenceDocumentType: refDocType,
        referenceDocumentNumber: refDocNumber,
        referenceDocumentDate: refDocDate,
      };
      const existing = editingId ? d.bupots.find((b) => b.id === editingId) : undefined;
      if (existing) {
        Object.assign(existing, {
          status: submit ? 'SUBMITTED' : 'DRAFT',
          taxPeriodMonth: month,
          taxPeriodYear: year,
          counterpartTin: resolvedTin,
          counterpartName: name,
          taxObjectCode: taxObject.taxObjectCode,
          gross,
          rate: preview.rate,
          withheld: preview.withheld,
          idPlaceOfBusinessActivity: chosenNitku,
          fields,
        });
      } else {
        d.bupots.push({
          id: crypto.randomUUID(),
          kind: 'BP21',
          entityTin: entityTin!,
          status: submit ? 'SUBMITTED' : 'DRAFT',
          withholdingNumber: null,
          taxPeriodMonth: month,
          taxPeriodYear: year,
          counterpartTin: resolvedTin,
          counterpartName: name,
          taxObjectCode: taxObject.taxObjectCode,
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
        ? `Data tersimpan, tetapi NIK/NPWP ${cleanTin || '(kosong)'} tidak dikenali dan dicatat sebagai ${TIN_TIDAK_PADAN}. Bukti potong ini tidak dapat dikreditkan. Padankan NIK/NPWP penerima penghasilan terlebih dahulu.`
        : 'Data bukti pemotongan tersimpan pada daftar Belum Terbit.',
    );
    setFormOpen(false);
    resetForm();
  }

  function issue(password: string, provider: 'KODE_OTORISASI_DJP' | 'SERTIFIKAT_ELEKTRONIK') {
    if (!password || !canSignBp21) return;
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
    if (!canSignBp21) return;
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
    if (!canDraftBp21) return;
    mutate((d) => {
      d.bupots = d.bupots.filter((b) => !(selected.includes(b.id) && b.status !== 'ISSUED'));
    });
    setSelected([]);
  }

  function refresh() {
    mutate(() => {}); // muat ulang dari localStorage — sinkron dgn tab lain, tanpa mengubah data.
  }

  const exportHeaders = [
    'Masa Pajak', 'Nomor Bupot', 'TIN/NIK', 'Nama', 'Objek Pajak',
    'Bruto', 'Deemed Net Income (%)', 'Rate (%)', 'PPh Dipotong', 'Status', 'Status Tanda Tangan',
  ];
  const exportRows = () => rows.map((r) => [
    `${String(r.taxPeriodMonth).padStart(2, '0')}/${r.taxPeriodYear}`,
    r.withholdingNumber ?? '-',
    r.counterpartTin,
    r.counterpartName,
    String(r.fields.taxObjectName ?? '-'),
    r.gross,
    String(r.fields.deemedNetIncome ?? '-'),
    r.rate,
    r.withheld,
    r.status,
    r.signature ? r.signature.provider : 'Belum ditandatangani',
  ]);
  const exportFileBase = () => `ebupot-bp21-${TABS.find((t) => t.key === tab)!.label.toLowerCase().replace(/\s+/g, '-')}`;

  function exportCsv() {
    downloadCsv(`${exportFileBase()}.csv`, exportHeaders, exportRows());
  }
  function exportXls() {
    downloadXls(`${exportFileBase()}.xls`, exportHeaders, exportRows());
  }
  function exportPdf() {
    printAsPdf(`EBUPOT BP21 — ${TABS.find((t) => t.key === tab)!.label}`, exportHeaders, exportRows());
  }

  function downloadTemplate() {
    downloadXmlTemplate('template-impor-bp21.xml', 'Sheet1', IMPORT_HEADERS, IMPORT_EXAMPLE);
  }

  function uploadFile() {
    if (!canDraftBp21) { setNotice(explainDenied('draft', 'BP21')); return; }
    pickCsvFile((text) => {
      const raw = parseSpreadsheetXml(text);
      const records = csvRowsToRecords(raw);
      if (records.length === 0) { setNotice('File XML kosong atau formatnya tidak sesuai template.'); return; }

      let created = 0;
      const errors: string[] = [];
      mutate((d: Database) => {
        records.forEach((rec, i) => {
          const rowLabel = `Baris ${i + 2}`;
          const m = Number(rec.TaxPeriodMonth), y = Number(rec.TaxPeriodYear), g = Number(rec.Gross);
          const obj = BP21_TAX_OBJECTS.find((o) => o.name === rec.TaxObjectName);
          if (!m || m < 1 || m > 12) { errors.push(`${rowLabel}: TaxPeriodMonth tidak valid.`); return; }
          if (!y) { errors.push(`${rowLabel}: TaxPeriodYear tidak valid.`); return; }
          if (!rec.CounterpartTin) { errors.push(`${rowLabel}: CounterpartTin kosong.`); return; }
          if (!obj) { errors.push(`${rowLabel}: TaxObjectName "${rec.TaxObjectName}" tidak dikenali — cocokkan persis dengan pilihan pada formulir.`); return; }
          if (!g || g <= 0) { errors.push(`${rowLabel}: Gross tidak valid.`); return; }

          const { resolvedTin, name } = resolveCounterpart(rec.CounterpartTin, rec.CounterpartName || '(tanpa nama)');
          const { withheld } = withheldByTaxObject(obj.name, g);
          const cleanRecTin = rec.CounterpartTin.replace(/\D/g, '');
          d.bupots.push({
            id: crypto.randomUUID(),
            kind: 'BP21',
            entityTin: entityTin!,
            status: 'DRAFT',
            withholdingNumber: null,
            taxPeriodMonth: m,
            taxPeriodYear: y,
            counterpartTin: resolvedTin,
            counterpartName: name,
            taxObjectCode: obj.taxObjectCode,
            gross: g,
            rate: obj.rate,
            withheld,
            idPlaceOfBusinessActivity: rec.IDPlaceOfBusinessActivity || tkus[0]?.nitku || `${entityTin}000000`,
            createdByNik: d.session!.personNik,
            createdAt: new Date().toISOString(),
            signature: null,
            cancelledAt: null,
            fields: {
              ptkp: rec.StatusTaxExemption || 'K/0',
              taxFacility: rec.TaxFacility || BP21_TAX_FACILITY_OPTIONS[0],
              taxObjectName: obj.name,
              incomeTaxStatus: obj.incomeTaxStatus,
              deemedNetIncome: obj.deemedNetIncome,
              revenueCode: obj.revenueCode,
              counterpartNitku: cleanRecTin.length === 16 ? `${cleanRecTin}000000` : undefined,
              referenceDocumentType: rec.ReferenceDocumentType || BP21_REFERENCE_DOCUMENT_TYPES[0],
              referenceDocumentNumber: rec.ReferenceDocumentNumber || '',
              referenceDocumentDate: rec.ReferenceDocumentDate || '',
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
    }, '.xml,application/xml,text/xml');
  }

  const viewDoc = viewing ? db.bupots.find((b) => b.id === viewing) : null;

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(220px,20%)_minmax(0,1fr)]">
      <aside className="rounded-card bg-white p-3 shadow-card">
        <p className="px-2 pb-2 text-[13px] font-semibold text-brand-800">
          Bukti Pemotongan Selain Pegawai Tetap
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
          <h1 className="font-semibold">EBUPOT BP21 — {TABS.find((t) => t.key === tab)!.label}</h1>
          <div className="ml-auto flex gap-2">
            {tab === 'BELUM_TERBIT' && (
              <>
                <button
                  className="btn-secondary"
                  onClick={openCreate}
                  disabled={!canDraftBp21}
                  title={!canDraftBp21 ? explainDenied('draft', 'BP21') : undefined}
                >
                  + Create eBupot BP21
                </button>
                <button
                  className="btn-secondary"
                  onClick={remove}
                  disabled={!selected.length || !canDraftBp21}
                  title={!canDraftBp21 ? explainDenied('draft', 'BP21') : undefined}
                >
                  Hapus
                </button>
                <button
                  className="btn-primary"
                  onClick={() => setSigning(true)}
                  disabled={!selected.length || !canSignBp21}
                  title={!canSignBp21 ? explainDenied('sign', 'BP21') : undefined}
                >
                  Terbitkan
                </button>
                <ImportMenuButton
                  disabled={!canDraftBp21}
                  title={explainDenied('draft', 'BP21')}
                  onDownloadTemplate={downloadTemplate}
                  onUpload={uploadFile}
                />
              </>
            )}
            {tab === 'TELAH_TERBIT' && (
              <button
                className="btn-secondary"
                onClick={cancel}
                disabled={!selected.length || !canSignBp21}
                title={!canSignBp21 ? explainDenied('sign', 'BP21') : undefined}
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
                  <td className="text-xxs">{r.signature ? r.signature.provider : '—'}</td>
                  <td>
                    <div className="flex gap-2">
                      {tab === 'BELUM_TERBIT' && r.status === 'DRAFT' && canDraftBp21 && (
                        <button
                          className="text-brand-600 hover:text-brand-800"
                          title="Edit"
                          onClick={() => openEdit(r)}
                        >
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
            <h2 className="font-semibold">{editingId ? 'Edit' : 'Formulir'} EBUPOT BP21</h2>

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
                <label className="field-label" htmlFor="tin">TIN (NPWP 16 digit / NIK)</label>
                <input id="tin" className="field-input font-mono" maxLength={16} value={tin}
                  onChange={(e) => setTin(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="field-label" htmlFor="nm">Nama (otomatis bila TIN valid)</label>
                <input id="nm" className="field-input" value={nama} onChange={(e) => setNama(e.target.value)} />
              </div>
              <div>
                <label className="field-label">ID Place of Business Activity of Income Recipient</label>
                <output className="field-input block bg-canvas font-mono text-xxs">
                  {recipientNitku || 'Isi TIN 16 digit terlebih dahulu'}
                </output>
              </div>
              <div>
                <label className="field-label" htmlFor="pemotong-nitku">ID Place of Business Activity (Pemotong)</label>
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

            <p className="mt-4 text-[13px] font-semibold text-ink-muted">Income Tax</p>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <div>
                <label className="field-label" htmlFor="p">Status of Tax Exemption (PTKP)</label>
                <select id="p" className="field-input" value={ptkp} onChange={(e) => setPtkp(e.target.value)}>
                  {PTKP_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="tf">Fasilitas Pajak</label>
                <select id="tf" className="field-input" value={taxFacility} onChange={(e) => setTaxFacility(e.target.value)}>
                  {BP21_TAX_FACILITY_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="ton">Tax Object Name</label>
                <select id="ton" className="field-input" value={taxObjectName} onChange={(e) => setTaxObjectName(e.target.value)}>
                  {BP21_TAX_OBJECTS.map((o) => <option key={o.name}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Tax Article</label>
                <output className="field-input block bg-canvas">Pasal {taxObject.article}</output>
              </div>
              <div>
                <label className="field-label">Tax Object Code</label>
                <output className="field-input block bg-canvas font-mono">{taxObject.taxObjectCode}</output>
              </div>
              <div>
                <label className="field-label">Income Tax Status</label>
                <output className="field-input block bg-canvas">
                  {taxObject.incomeTaxStatus === 'FINAL' ? 'Final' : 'Tidak Final'}
                </output>
              </div>
              <div>
                <label className="field-label">Deemed Net Income (%)</label>
                <output className="field-input block bg-canvas">{taxObject.deemedNetIncome},00</output>
              </div>
              <div>
                <label className="field-label">Rate (%)</label>
                <output className="field-input block bg-canvas">{taxObject.rate},00</output>
              </div>
              <div>
                <label className="field-label">Revenue Code (KAP-KJS)</label>
                <output className="field-input block bg-canvas font-mono">{taxObject.revenueCode}</output>
              </div>
              <div>
                <label className="field-label" htmlFor="g">Penghasilan Bruto (Rp)</label>
                <input id="g" type="number" className="field-input" value={gross}
                  onChange={(e) => setGross(+e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="field-label">Income Tax Withheld</label>
                <output className="field-input block bg-canvas">
                  {rupiah(preview.withheld)} ({rupiah(gross)} × {taxObject.deemedNetIncome}% × {taxObject.rate}%)
                </output>
              </div>
            </div>

            <p className="mt-4 text-[13px] font-semibold text-ink-muted">Reference Document</p>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <div>
                <label className="field-label" htmlFor="rdt">Document Type</label>
                <select id="rdt" className="field-input" value={refDocType} onChange={(e) => setRefDocType(e.target.value)}>
                  {BP21_REFERENCE_DOCUMENT_TYPES.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="rdn">Document Number</label>
                <input id="rdn" className="field-input" value={refDocNumber} onChange={(e) => setRefDocNumber(e.target.value)} />
              </div>
              <div>
                <label className="field-label" htmlFor="rdd">Reference Document Date</label>
                <input id="rdd" type="date" className="field-input" value={refDocDate} onChange={(e) => setRefDocDate(e.target.value)} />
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
            <h2 className="font-semibold">Detail Bukti Pemotongan BP21</h2>
            <dl className="mt-3 grid grid-cols-2 gap-y-2 text-[13px]">
              <dt className="text-ink-muted">Nomor Bupot</dt><dd className="font-mono">{viewDoc.withholdingNumber ?? '—'}</dd>
              <dt className="text-ink-muted">Masa Pajak</dt><dd>{String(viewDoc.taxPeriodMonth).padStart(2, '0')}/{viewDoc.taxPeriodYear}</dd>
              <dt className="text-ink-muted">TIN/NIK</dt><dd className={`font-mono ${viewDoc.counterpartTin === TIN_TIDAK_PADAN ? 'text-bad' : ''}`}>{viewDoc.counterpartTin}</dd>
              <dt className="text-ink-muted">Nama</dt><dd>{viewDoc.counterpartName}</dd>
              <dt className="text-ink-muted">ID Place of Business Activity</dt><dd className="font-mono text-xxs">{viewDoc.idPlaceOfBusinessActivity}</dd>
              <dt className="text-ink-muted">Tax Object Name</dt><dd>{String(viewDoc.fields.taxObjectName ?? '—')}</dd>
              <dt className="text-ink-muted">Tax Object Code</dt><dd className="font-mono">{viewDoc.taxObjectCode}</dd>
              <dt className="text-ink-muted">Income Tax Status</dt><dd>{String(viewDoc.fields.incomeTaxStatus ?? '—')}</dd>
              <dt className="text-ink-muted">Deemed Net Income</dt><dd>{String(viewDoc.fields.deemedNetIncome ?? '—')}%</dd>
              <dt className="text-ink-muted">Fasilitas Pajak</dt><dd>{String(viewDoc.fields.taxFacility ?? '—')}</dd>
              <dt className="text-ink-muted">Bruto</dt><dd>{rupiah(viewDoc.gross)}</dd>
              <dt className="text-ink-muted">Rate</dt><dd>{viewDoc.rate}%</dd>
              <dt className="text-ink-muted">PPh Dipotong</dt><dd>{rupiah(viewDoc.withheld)}</dd>
              <dt className="text-ink-muted">Dokumen Referensi</dt>
              <dd>{String(viewDoc.fields.referenceDocumentType ?? '—')} {String(viewDoc.fields.referenceDocumentNumber ?? '')}</dd>
            </dl>
            <div className="mt-5 flex justify-end">
              <button className="btn-secondary" onClick={() => setViewing(null)}>Tutup</button>
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
