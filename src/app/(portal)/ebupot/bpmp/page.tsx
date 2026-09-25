'use client';

import { useMemo, useState } from 'react';
import { useDb } from '@/lib/storage/useDb';
import { nextWithholdingNumber, type Database } from '@/lib/storage/db';
import { PTKP_OPTIONS, withheldByTer } from '@/lib/domain/ter';
import { BPMP_TAX_CERTIFICATE_OPTIONS, BPMP_TAX_OBJECTS, taxObjectByName, taxObjectCodeFor } from '@/lib/domain/bpmp';
import { tabOf, type BupotDoc, type DocTab } from '@/lib/domain/types';
import { canDraft, canSign, explainDenied, filterVisibleBupots } from '@/lib/auth/access';
import { ImportMenuButton } from '@/components/ui/ImportMenuButton';
import { ExportIconRow } from '@/components/ui/ExportIconRow';
import {
  csvRowsToRecords, downloadCsv, downloadXls, downloadXmlTemplate, parseSpreadsheetXml, pickCsvFile, printAsPdf,
} from '@/lib/storage/csv';
import { Pencil } from 'lucide-react';

/**
 * Bukti Pemotongan Bulanan Pegawai Tetap (EBUPOT MP), slide 1-59 bagian
 * "Pembuatan Bukti Pemotongan Bulanan Pegawai Tetap". Layar ini jadi acuan
 * bentuk untuk seluruh modul eBupot lainnya (BP21, dst): tiga tab status,
 * tombol buat/edit/hapus/terbitkan/batal, Impor Data (XML asli — lihat
 * `lib/storage/csv.ts`), Export CSV/Excel/PDF, dan daftar minimal (Tax
 * Period/Withholding Number/Status/ID Place of Business Activity) dengan
 * detail lengkap di dialog "Lihat" — persis susunan kolom pada screenshot
 * asli, bukan tabel lebar seperti versi sebelumnya.
 */

const TABS: { key: DocTab; label: string }[] = [
  { key: 'BELUM_TERBIT', label: 'Belum Terbit' },
  { key: 'TELAH_TERBIT', label: 'Telah Terbit' },
  { key: 'TIDAK_VALID', label: 'Tidak Valid' },
];

const NIK_TIDAK_PADAN = '9990000000999000';
const rupiah = (n: number) => n.toLocaleString('id-ID');

const IMPORT_HEADERS = [
  'TIN', 'TaxPeriodMonth', 'TaxPeriodYear', 'CounterpartOption', 'CounterpartPassport',
  'CounterpartTin', 'StatusTaxExemption', 'Position', 'TaxCertificate', 'TaxObjectCode',
  'Gross', 'Rate', 'IDPlaceOfBusinessActivity', 'WithholdingDate',
];
const IMPORT_EXAMPLE = [
  '3217122601770007', 9, 2024, 'Resident', '', '3217122601770007', 'K/0', 'Staf Keuangan',
  'Tanpa Fasilitas', '21-100-01', 10_000_000, 2, '0012345678910000000000', '18/09/2024',
];

export default function BpmpPage() {
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
      db.bupots.filter((b) => b.kind === 'BPMP'),
      db.roleAssignments,
      db.session,
      db.relatedParties,
    );
    return visible.filter((b) => tabOf(b.status) === tab);
  }, [db.bupots, db.roleAssignments, db.relatedParties, db.session, tab]);

  // Formulir — General Information
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [foreignEmployee, setForeignEmployee] = useState(false);
  const [nik, setNik] = useState('');
  const [nama, setNama] = useState('');
  const [passportNumber, setPassportNumber] = useState('');

  // Formulir — Tax Facility / Income Tax
  const [taxCertificate, setTaxCertificate] = useState<string>(BPMP_TAX_CERTIFICATE_OPTIONS[0]);
  const [taxObjectName, setTaxObjectName] = useState(BPMP_TAX_OBJECTS[0].name);
  const [ptkp, setPtkp] = useState('K/0');
  const [jabatan, setJabatan] = useState('');
  const [gross, setGross] = useState(0);
  const [nitku, setNitku] = useState('');

  const taxObject = taxObjectByName(taxObjectName);
  const taxObjectCode = taxObjectCodeFor(taxObjectName, foreignEmployee);
  const preview = withheldByTer(ptkp, gross);
  const cleanNik = nik.replace(/\D/g, '');
  const matchedPerson = db.persons.find((p) => p.nik === cleanNik || p.npwp16 === cleanNik);
  const nikNotFound = cleanNik.length === 16 && !matchedPerson;

  /**
   * TIN/NIK → cari di database pegawai → ditemukan? isi otomatis Nama,
   * PTKP, Jabatan, dan status Foreign Employee. Tidak ditemukan (tapi
   * sudah 16 digit)? JANGAN isi apa pun secara sembarangan — tampilkan
   * "Data tidak ditemukan" (lihat nikNotFound) dan biarkan kolom lain
   * kosong untuk diisi manual.
   */
  function handleNikChange(value: string) {
    setNik(value);
    const clean = value.replace(/\D/g, '');
    const person = db.persons.find((p) => p.nik === clean || p.npwp16 === clean);
    if (person) {
      setNama(person.nama);
      setPtkp(person.ptkp ?? 'K/0');
      setJabatan(person.jabatan ?? '');
      setForeignEmployee(person.negara !== 'Indonesia');
    } else if (clean.length === 16) {
      setNama('');
      setJabatan('');
    }
  }

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

  function resetForm() {
    setEditingId(null);
    setMonth(new Date().getMonth() + 1); setYear(new Date().getFullYear());
    setForeignEmployee(false);
    setNik(''); setNama(''); setPassportNumber('');
    setTaxCertificate(BPMP_TAX_CERTIFICATE_OPTIONS[0]);
    setTaxObjectName(BPMP_TAX_OBJECTS[0].name);
    setPtkp('K/0'); setJabatan(''); setGross(0);
    setNitku(tkus[0]?.nitku ?? '');
  }

  function openCreate() {
    resetForm();
    setFormOpen(true);
  }

  /** Icon pensil [edit] — isi ulang formulir dari draft yang dipilih. */
  function openEdit(doc: BupotDoc) {
    if (!canDraftBpmp) return;
    setEditingId(doc.id);
    setMonth(doc.taxPeriodMonth); setYear(doc.taxPeriodYear);
    setForeignEmployee(Boolean(doc.fields.foreignEmployee));
    setNik(doc.counterpartTin === NIK_TIDAK_PADAN ? '' : doc.counterpartTin);
    setNama(doc.counterpartName);
    setPassportNumber(String(doc.fields.passportNumber ?? ''));
    setTaxCertificate(String(doc.fields.taxCertificate ?? BPMP_TAX_CERTIFICATE_OPTIONS[0]));
    setTaxObjectName(String(doc.fields.taxObjectName ?? BPMP_TAX_OBJECTS[0].name));
    setPtkp(String(doc.fields.ptkp ?? 'K/0'));
    setJabatan(String(doc.fields.jabatan ?? ''));
    setGross(doc.gross);
    setNitku(doc.idPlaceOfBusinessActivity);
    setFormOpen(true);
  }

  function resolveCounterpart(rawNik: string, fallbackName: string) {
    const clean = rawNik.replace(/\D/g, '');
    const person = db.persons.find((p) => p.nik === clean);
    const resolvedTin = clean && (!person || person.padan) ? clean : NIK_TIDAK_PADAN;
    return { resolvedTin, name: person?.nama ?? fallbackName };
  }

  function saveDraft(submit: boolean) {
    if (!canDraftBpmp) { setNotice(explainDenied('draft', 'BPMP')); return; }
    const { resolvedTin, name } = resolveCounterpart(nik, nama);
    const chosenNitku = nitku || tkus[0]?.nitku || `${entityTin}000000`;

    mutate((d) => {
      const fields = {
        ptkp,
        jabatan,
        foreignEmployee,
        passportNumber: foreignEmployee ? passportNumber : undefined,
        taxCertificate,
        taxObjectName,
      };
      const existing = editingId ? d.bupots.find((b) => b.id === editingId) : undefined;
      if (existing) {
        Object.assign(existing, {
          status: submit ? 'SUBMITTED' : 'DRAFT',
          taxPeriodMonth: month,
          taxPeriodYear: year,
          counterpartTin: resolvedTin,
          counterpartName: name,
          taxObjectCode,
          gross,
          rate: preview.rate,
          withheld: preview.withheld,
          idPlaceOfBusinessActivity: chosenNitku,
          fields,
        });
      } else {
        d.bupots.push({
          id: crypto.randomUUID(),
          kind: 'BPMP',
          entityTin: entityTin!,
          status: submit ? 'SUBMITTED' : 'DRAFT',
          withholdingNumber: null,
          taxPeriodMonth: month,
          taxPeriodYear: year,
          counterpartTin: resolvedTin,
          counterpartName: name,
          taxObjectCode,
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
      resolvedTin === NIK_TIDAK_PADAN
        ? `Data tersimpan, tetapi NIK ${cleanNik || '(kosong)'} tidak dikenali dan dicatat sebagai ${NIK_TIDAK_PADAN}. Bukti potong ini tidak dapat dikreditkan. Padankan NIK pegawai terlebih dahulu.`
        : 'Data bukti pemotongan tersimpan pada daftar Belum Terbit.',
    );
    setFormOpen(false);
    resetForm();
  }

  /**
   * BPMP TIDAK memakai Sign Document — beda dari BP21/BPA2. Ini terlihat
   * jelas dari urutan screenshot asli: klik "Terbitkan" langsung menuju
   * notifikasi "Data successfully issued" tanpa ada dialog tanda tangan di
   * antaranya (dialog Sign Document hanya muncul pada alur BP21/BPA2).
   */
  function issue() {
    if (!canSignBpmp) return;
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
    setNotice('Data successfully issued! Bukti pemotongan masuk ke draft SPT Masa PPh Pasal 21.');
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

  function refresh() { mutate(() => {}); }

  const exportHeaders = ['Tax Period', 'Withholding Number', 'Status', 'ID Place of Business Activity', 'NIK/NPWP', 'Nama', 'Bruto', 'Tarif', 'PPh Dipotong'];
  const exportRows = () => rows.map((r) => [
    `${String(r.taxPeriodMonth).padStart(2, '0')}/${r.taxPeriodYear}`,
    r.withholdingNumber ?? '-',
    r.status,
    r.idPlaceOfBusinessActivity,
    r.counterpartTin,
    r.counterpartName,
    r.gross,
    r.rate,
    r.withheld,
  ]);
  const exportFileBase = () => `ebupot-mp-${TABS.find((t) => t.key === tab)!.label.toLowerCase().replace(/\s+/g, '-')}`;

  function exportCsv() { downloadCsv(`${exportFileBase()}.csv`, exportHeaders, exportRows()); }
  function exportXls() { downloadXls(`${exportFileBase()}.xls`, exportHeaders, exportRows()); }
  function exportPdf() { printAsPdf(`EBUPOT MP — ${TABS.find((t) => t.key === tab)!.label}`, exportHeaders, exportRows()); }

  function downloadTemplate() {
    downloadXmlTemplate('template-impor-ebupot-mp.xml', 'Sheet1', IMPORT_HEADERS, IMPORT_EXAMPLE);
  }

  function uploadFile() {
    if (!canDraftBpmp) { setNotice(explainDenied('draft', 'BPMP')); return; }
    pickCsvFile((text) => {
      const raw = parseSpreadsheetXml(text);
      const records = csvRowsToRecords(raw.length ? raw : []);
      if (records.length === 0) { setNotice('File XML kosong atau formatnya tidak sesuai template.'); return; }

      let created = 0;
      const errors: string[] = [];
      mutate((d: Database) => {
        records.forEach((rec, i) => {
          const rowLabel = `Baris ${i + 2}`;
          const m = Number(rec.TaxPeriodMonth), y = Number(rec.TaxPeriodYear), g = Number(rec.Gross);
          const isForeign = (rec.CounterpartOption || '').toLowerCase() === 'foreign';
          if (!m || m < 1 || m > 12) { errors.push(`${rowLabel}: TaxPeriodMonth tidak valid.`); return; }
          if (!y) { errors.push(`${rowLabel}: TaxPeriodYear tidak valid.`); return; }
          if (!rec.CounterpartTin) { errors.push(`${rowLabel}: CounterpartTin kosong.`); return; }
          if (!g || g <= 0) { errors.push(`${rowLabel}: Gross tidak valid.`); return; }

          const { resolvedTin, name } = resolveCounterpart(rec.CounterpartTin, '(tanpa nama)');
          const { withheld, rate } = withheldByTer(rec.StatusTaxExemption || 'K/0', g);
          d.bupots.push({
            id: crypto.randomUUID(),
            kind: 'BPMP',
            entityTin: entityTin!,
            status: 'DRAFT',
            withholdingNumber: null,
            taxPeriodMonth: m,
            taxPeriodYear: y,
            counterpartTin: resolvedTin,
            counterpartName: name,
            taxObjectCode: rec.TaxObjectCode || taxObjectCodeFor(BPMP_TAX_OBJECTS[0].name, isForeign),
            gross: g,
            rate,
            withheld,
            idPlaceOfBusinessActivity: rec.IDPlaceOfBusinessActivity || tkus[0]?.nitku || `${entityTin}000000`,
            createdByNik: d.session!.personNik,
            createdAt: new Date().toISOString(),
            signature: null,
            cancelledAt: null,
            fields: {
              ptkp: rec.StatusTaxExemption || 'K/0',
              jabatan: rec.Position || '',
              foreignEmployee: isForeign,
              passportNumber: isForeign ? rec.CounterpartPassport : undefined,
              taxCertificate: rec.TaxCertificate || BPMP_TAX_CERTIFICATE_OPTIONS[0],
              taxObjectName: BPMP_TAX_OBJECTS[0].name,
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
          <h1 className="font-semibold">
            EBUPOT MP{tab === 'TELAH_TERBIT' ? ' ISSUED' : tab === 'TIDAK_VALID' ? ' INVALID' : ''}
          </h1>
          <div className="ml-auto flex gap-2">
            {tab === 'BELUM_TERBIT' && (
              <>
                <button
                  className="btn-secondary"
                  onClick={openCreate}
                  disabled={!canDraftBpmp}
                  title={!canDraftBpmp ? explainDenied('draft', 'BPMP') : undefined}
                >
                  + Create eBupot MP
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
                  onClick={issue}
                  disabled={!selected.length || !canSignBpmp}
                  title={!canSignBpmp ? explainDenied('sign', 'BPMP') : undefined}
                >
                  Terbitkan
                </button>
                <ImportMenuButton
                  disabled={!canDraftBpmp}
                  title={explainDenied('draft', 'BPMP')}
                  onDownloadTemplate={downloadTemplate}
                  onUpload={uploadFile}
                />
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
                <th>ID Place of Business Activity</th>
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
                  <td className="font-mono text-xxs">{r.idPlaceOfBusinessActivity}</td>
                  <td>
                    <div className="flex gap-2">
                      {tab === 'BELUM_TERBIT' && r.status === 'DRAFT' && canDraftBpmp && (
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
            <h2 className="font-semibold">{editingId ? 'Edit' : 'Formulir'} EBUPOT MP</h2>

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
                <label className="field-label" htmlFor="fe">Foreign Employee</label>
                <select id="fe" className="field-input" value={foreignEmployee ? 'Ya' : 'Tidak'}
                  onChange={(e) => setForeignEmployee(e.target.value === 'Ya')}>
                  <option>Tidak</option>
                  <option>Ya</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="n">TIN (NPWP 16 digit / NIK)</label>
                <input id="n" className="field-input font-mono" maxLength={16} value={nik}
                  onChange={(e) => handleNikChange(e.target.value)} />
                {nikNotFound && (
                  <p className="mt-1 text-xxs text-bad">Data tidak ditemukan. Isi Nama secara manual di bawah.</p>
                )}
              </div>
              {foreignEmployee && (
                <div>
                  <label className="field-label" htmlFor="pp">Passport Number</label>
                  <input id="pp" className="field-input" value={passportNumber}
                    onChange={(e) => setPassportNumber(e.target.value)} />
                </div>
              )}
              <div>
                <label className="field-label" htmlFor="nm2">Name (otomatis bila TIN valid)</label>
                <input id="nm2" className="field-input" value={nama} onChange={(e) => setNama(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Address</label>
                <output className="field-input block bg-canvas text-xxs">{matchedPerson?.alamat || '—'}</output>
              </div>
              <div>
                <label className="field-label">Country</label>
                <output className="field-input block bg-canvas">{matchedPerson?.negara || 'Indonesia'}</output>
              </div>
              <div>
                <label className="field-label" htmlFor="p">Status of Tax Exemption (PTKP)</label>
                <select id="p" className="field-input" value={ptkp} onChange={(e) => setPtkp(e.target.value)}>
                  {PTKP_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="j">Position (Jabatan)</label>
                <input id="j" className="field-input" value={jabatan} onChange={(e) => setJabatan(e.target.value)} />
              </div>
            </div>

            <p className="mt-4 text-[13px] font-semibold text-ink-muted">Tax Facility</p>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <div>
                <label className="field-label" htmlFor="tc">Tax Certificate</label>
                <select id="tc" className="field-input" value={taxCertificate} onChange={(e) => setTaxCertificate(e.target.value)}>
                  {BPMP_TAX_CERTIFICATE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="ton">Tax Object Name</label>
                <select id="ton" className="field-input" value={taxObjectName} onChange={(e) => setTaxObjectName(e.target.value)}>
                  {BPMP_TAX_OBJECTS.map((o) => <option key={o.name}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Tax Article</label>
                <output className="field-input block bg-canvas">PPh Pasal {taxObject.article}</output>
              </div>
              <div>
                <label className="field-label">Tax Object Code</label>
                <output className="field-input block bg-canvas font-mono">{taxObjectCode}</output>
              </div>
              <div>
                <label className="field-label" htmlFor="g">Penghasilan Bruto (Rp)</label>
                <input id="g" type="number" className="field-input" value={gross}
                  onChange={(e) => setGross(+e.target.value)} />
              </div>
              <div>
                <label className="field-label">Rate (%)</label>
                <output className="field-input block bg-canvas">{preview.rate},00</output>
              </div>
              <div>
                <label className="field-label">Pajak Penghasilan yang Dipotong (Rp)</label>
                <output className="field-input block bg-canvas">{rupiah(preview.withheld)}</output>
              </div>
              <div>
                <label className="field-label">Revenue Code</label>
                <output className="field-input block bg-canvas font-mono">{taxObject.revenueCode}</output>
              </div>
              <div>
                <label className="field-label" htmlFor="tku">ID Place of Business Activity</label>
                {tkus.length > 0 ? (
                  <select id="tku" className="field-input font-mono text-xxs" value={nitku || tkus[0].nitku}
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
            <h2 className="font-semibold">Detail Bukti Pemotongan MP</h2>
            <dl className="mt-3 grid grid-cols-2 gap-y-2 text-[13px]">
              <dt className="text-ink-muted">Nomor Bupot</dt><dd className="font-mono">{viewDoc.withholdingNumber ?? '—'}</dd>
              <dt className="text-ink-muted">Masa Pajak</dt><dd>{String(viewDoc.taxPeriodMonth).padStart(2, '0')}/{viewDoc.taxPeriodYear}</dd>
              <dt className="text-ink-muted">Status</dt><dd>{viewDoc.status}</dd>
              <dt className="text-ink-muted">Foreign Employee</dt><dd>{viewDoc.fields.foreignEmployee ? 'Ya' : 'Tidak'}</dd>
              <dt className="text-ink-muted">TIN/NIK</dt><dd className={`font-mono ${viewDoc.counterpartTin === NIK_TIDAK_PADAN ? 'text-bad' : ''}`}>{viewDoc.counterpartTin}</dd>
              <dt className="text-ink-muted">Nama</dt><dd>{viewDoc.counterpartName}</dd>
              <dt className="text-ink-muted">Jabatan</dt><dd>{String(viewDoc.fields.jabatan ?? '—')}</dd>
              <dt className="text-ink-muted">PTKP</dt><dd>{String(viewDoc.fields.ptkp ?? '—')}</dd>
              <dt className="text-ink-muted">Tax Certificate</dt><dd>{String(viewDoc.fields.taxCertificate ?? '—')}</dd>
              <dt className="text-ink-muted">Tax Object Name</dt><dd>{String(viewDoc.fields.taxObjectName ?? '—')}</dd>
              <dt className="text-ink-muted">Tax Object Code</dt><dd className="font-mono">{viewDoc.taxObjectCode}</dd>
              <dt className="text-ink-muted">Bruto</dt><dd>{rupiah(viewDoc.gross)}</dd>
              <dt className="text-ink-muted">Rate</dt><dd>{viewDoc.rate}%</dd>
              <dt className="text-ink-muted">PPh Dipotong</dt><dd>{rupiah(viewDoc.withheld)}</dd>
              <dt className="text-ink-muted">ID Place of Business Activity</dt><dd className="font-mono text-xxs">{viewDoc.idPlaceOfBusinessActivity}</dd>
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
