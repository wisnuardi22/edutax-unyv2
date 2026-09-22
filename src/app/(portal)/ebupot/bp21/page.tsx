'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePendingAction } from '@/components/ui/usePendingAction';
import { usePathname, useRouter } from 'next/navigation';
import { BupotSidebar, BUPOT_TABS } from '@/components/ebupot/BupotSidebar';
import { assertIssuable } from '@/lib/domain/bupotValidation';
import { FormSection, FormRow } from '@/components/ui/FormSection';
import { PTKP_OPTIONS, bp21Tax } from '@/lib/domain/ter';
import { ImportMenu } from '@/components/ebupot/ImportMenu';
import { BupotTable } from '@/components/ebupot/BupotTable';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useDb } from '@/lib/storage/useDb';
import { nextWithholdingNumber } from '@/lib/storage/db';
import { SignDialog } from '@/components/ui/SignDialog';
import { tabOf, type DocTab } from '@/lib/domain/types';

const TABS: { key: DocTab; label: string }[] = [
  { key: 'BELUM_TERBIT', label: 'Belum Terbit' },
  { key: 'TELAH_TERBIT', label: 'Telah Terbit' },
  { key: 'TIDAK_VALID', label: 'Tidak Valid' },
];

const rupiah = (value: number) => value.toLocaleString('id-ID');
const TAX_OBJECTS = {
  jasa: { name: 'Imbalan kepada Tenaga Ahli', article: 'Pasal 21', code: '21-100-07', status: 'Tidak Final', revenue: '411121-100' },
  honor: { name: 'Honorarium Peserta Kegiatan', article: 'Pasal 21', code: '21-100-13', status: 'Tidak Final', revenue: '411121-100' },
} as const;

type TaxObjectKey = keyof typeof TAX_OBJECTS;

export default function Bp21Page() {
  const { db, mutate } = useDb();
  const pathname = usePathname();
  const router = useRouter();
  const entityTin = db.session?.impersonatingTin ?? null;
  const [tab, setTab] = useState<DocTab>('BELUM_TERBIT');
  useEffect(() => { setTab(BUPOT_TABS.find((t) => pathname.endsWith('/'+t.slug))?.key ?? 'BELUM_TERBIT'); }, [pathname]);
  const [formOpen, setFormOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<'delete' | 'cancel' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { pending, run } = usePendingAction(setNotice);
  const [month, setMonth] = useState(0);
  const [year, setYear] = useState(0);
  const [tin, setTin] = useState('');
  const [name, setName] = useState('');
  const [gross, setGross] = useState(0);
  const [taxObject, setTaxObject] = useState<TaxObjectKey | ''>('');
  const [documentType, setDocumentType] = useState('');
  const [ptkp, setPtkp] = useState('');
  const [nitku, setNitku] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentDate, setDocumentDate] = useState('');

  const object = taxObject ? TAX_OBJECTS[taxObject] : { name: '', article: '', code: '', status: '', revenue: '' };
  const { rate, withheld } = bp21Tax(object.code || '21-100-07', Number.isFinite(gross) && gross >= 0 ? gross : 0);
  const rows = useMemo(
    () => db.bupots.filter((b) => b.kind === 'BP21' && b.entityTin === entityTin && tabOf(b.status) === tab),
    [db.bupots, entityTin, tab],
  );
  const selectedPerson = db.persons.find((person) => person.nik === tin.replace(/\D/g, ''));
  const tkuOptions = db.tkus.filter((tku) => tku.entityTin === entityTin);

  useEffect(() => { setSelected([]); setSigning(false); setFormOpen(false); setConfirmation(null); }, [entityTin]);

  if (!entityTin) {
    return <p className="rounded-card bg-white p-5 text-sm shadow-card">Pilih badan yang Anda wakili di menu Portal Saya sebelum membuat bukti pemotongan.</p>;
  }
  const activeEntityTin = entityTin;

  function resetForm() {
    setTin(''); setName(''); setGross(0); setDocumentNumber(''); setDocumentDate(''); setFormOpen(false);
  }

  function save(submit: boolean) {
    const cleanTin = tin.replace(/\D/g, '');
    if (!taxObject || !ptkp || !nitku || !documentType || !month || !Number.isInteger(year) || year < 2024 || year > 9999 || !Number.isFinite(gross) || !Number.isFinite(Date.parse(documentDate)) || cleanTin.length !== 16 || !name.trim() || gross <= 0 || !documentNumber.trim() || !documentDate) {
      setNotice('Lengkapi TIN 16 digit, nama, penghasilan bruto, nomor dokumen, dan tanggal dokumen.');
      return;
    }
    mutate((d) => {
      if (d.session?.impersonatingTin !== entityTin) throw new Error('Akun aktif berubah. Ulangi penyimpanan.');
      d.bupots.push({
        id: crypto.randomUUID(), kind: 'BP21', entityTin: activeEntityTin, status: submit ? 'SUBMITTED' : 'DRAFT', withholdingNumber: null,
        taxPeriodMonth: month, taxPeriodYear: year, counterpartTin: cleanTin,
        counterpartName: selectedPerson?.nama ?? name.trim(), taxObjectCode: object.code, gross, rate, withheld,
        idPlaceOfBusinessActivity: nitku, createdByNik: d.session!.personNik,
        createdAt: new Date().toISOString(), signature: null, cancelledAt: null,
        fields: { ptkp, recipientNitku: `${cleanTin}000000`, taxArticle: object.article, incomeTaxStatus: object.status, revenueCode: object.revenue, documentType, documentNumber: documentNumber.trim(), documentDate, taxFacility: 'Tanpa Fasilitas' },
      });
    });
    setNotice(submit ? 'Data BP21 berhasil disimpan pada daftar Belum Terbit.' : 'Draft BP21 berhasil disimpan.');
    resetForm();
  }

  function issue(password: string, provider: 'KODE_OTORISASI_DJP' | 'SERTIFIKAT_ELEKTRONIK') {
    if (!password) return;
    mutate((d) => { assertIssuable(d.bupots, selected, d.session?.impersonatingTin); selected.forEach((id) => {
      const doc = d.bupots.find((item) => item.id === id);
      if (!doc || doc.entityTin !== d.session?.impersonatingTin || doc.kind !== 'BP21' || doc.status === 'CANCELLED' || doc.status === 'ISSUED') return;
      doc.status = 'ISSUED';
      doc.withholdingNumber = nextWithholdingNumber(d, doc.entityTin, doc.taxPeriodYear);
      doc.signature = { provider, signerNik: d.session!.personNik, signedAt: new Date().toISOString() };
    }); });
    setSigning(false); setSelected([]); setTab('TELAH_TERBIT'); router.replace('/ebupot/bp21/telah-terbit'); setNotice('BP21 berhasil diterbitkan dan tersedia pada lampiran L-III SPT.');
  }

  function remove() {
    mutate((d) => { d.bupots = d.bupots.filter((doc) => !(selected.includes(doc.id) && doc.kind === 'BP21' && doc.entityTin === d.session?.impersonatingTin && ['DRAFT', 'SUBMITTED'].includes(doc.status))); });
    setSelected([]); setNotice('Data BP21 berhasil dihapus.');
  }

  function cancel() {
    mutate((d) => selected.forEach((id) => {
      const doc = d.bupots.find((item) => item.id === id);
      if (doc?.kind === 'BP21' && doc.entityTin === d.session?.impersonatingTin && doc.status === 'ISSUED') { doc.status = 'CANCELLED'; doc.cancelledAt = new Date().toISOString(); }
    }));
    setSelected([]); setTab('TIDAK_VALID'); router.replace('/ebupot/bp21/tidak-valid'); setNotice('BP21 dibatalkan dan dipindahkan ke Tidak Valid.');
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(220px,20%)_minmax(0,1fr)]">
      <div className={formOpen ? 'hidden' : 'contents'}><BupotSidebar kind="BP21" tab={tab} />

      <section className="min-w-0 rounded-card bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-semibold">EBUPOT BP21 - {TABS.find((item) => item.key === tab)?.label}</h1>
          <div className="ml-auto flex gap-2">
            {tab === 'BELUM_TERBIT' && <><button className="btn-secondary" onClick={() => {setMonth(0);setYear(0);setTin('');setName('');setGross(0);setTaxObject('');setDocumentType('');setDocumentNumber('');setDocumentDate('');setPtkp('');setNitku('');setNotice(null);setFormOpen(true);}}>+ Buat eBupot BP21</button><button className="btn-secondary" onClick={() => setConfirmation('delete')} disabled={!selected.length}>Hapus</button><button className="btn-primary" onClick={() => setSigning(true)} disabled={!selected.length}>Terbitkan</button></>}
            {tab === 'TELAH_TERBIT' && <button className="btn-secondary" onClick={() => setConfirmation('cancel')} disabled={!selected.length}>Batal</button>}
          </div>
        </div>
        {notice && <p className="mt-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-[13px] text-brand-800">{notice}</p>}
        {tab === 'BELUM_TERBIT' && <ImportMenu kind="BP21" />}<BupotTable kind="BP21" rows={rows} selected={selected} onSelect={setSelected} />
      </section>

      </div>
      {formOpen && <section className="col-span-full bg-white p-4"><h1 className="mb-4 font-semibold text-brand-800">EBUPOT BP21</h1>
        <FormSection title="GENERAL INFORMATION">
          <FormRow label="Tax Period" required><div className="grid grid-cols-2 gap-2"><select id="bp21-month" aria-label="Tax Period" className="field-input" value={month} onChange={(e)=>setMonth(Number(e.target.value))}><option value={0}>Pilih masa pajak</option>{Array.from({length:12},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select><input id="bp21-year" aria-label="Tax Year" type="number" className="field-input" value={year||''} onChange={(e)=>setYear(Number(e.target.value))} /></div></FormRow>
          <FormRow label="Status"><input aria-label="Status" readOnly className="field-input bg-canvas" value="NORMAL" /></FormRow>
          <FormRow label="TIN" required><input id="bp21-tin" aria-label="TIN" maxLength={16} className="field-input" value={tin} onChange={(e)=>{setTin(e.target.value);setName(db.persons.find((p)=>p.nik===e.target.value)?.nama??'');}} /></FormRow>
          <FormRow label="Name" required><input id="bp21-name" aria-label="Name" className="field-input" value={name} onChange={(e)=>setName(e.target.value)} /></FormRow>
          <FormRow label="ID Place of Business Activity of Income Recipient"><select aria-label="ID Place of Business Activity of Income Recipient" className="field-input" value={tin.length===16?`${tin}000000`:''} onChange={()=>{}}><option value="">Pilih penerima penghasilan terlebih dahulu</option>{tin.length===16&&<option value={`${tin}000000`}>{tin}000000 - {name}</option>}</select></FormRow>
        </FormSection>
        <FormSection title="INCOME TAX">
          <FormRow label="Status of Tax Exemption" required><select aria-label="Status of Tax Exemption" className="field-input" value={ptkp} onChange={(e)=>setPtkp(e.target.value)}><option value="">Pilih PTKP</option>{PTKP_OPTIONS.map((v)=><option key={v}>{v}</option>)}</select></FormRow>
          <FormRow label="Fasilitas Pajak yang Dimiliki Penerima Penghasilan"><select aria-label="Fasilitas Pajak" className="field-input"><option>Tanpa Fasilitas</option></select></FormRow>
          <FormRow label="Tax Object Name" required><select id="bp21-object" aria-label="Tax Object Name" className="field-input" value={taxObject} onChange={(e)=>setTaxObject(e.target.value as TaxObjectKey)}><option value="">Pilih objek pajak</option>{Object.entries(TAX_OBJECTS).map(([key,value])=><option key={key} value={key}>{value.name}</option>)}</select></FormRow>
          <FormRow label="Tax Article"><input aria-label="Tax Article" readOnly className="field-input bg-canvas" value={object.article} /></FormRow>
          <FormRow label="Tax Object Code"><input aria-label="Tax Object Code" readOnly className="field-input bg-canvas" value={object.code} /></FormRow>
          <FormRow label="Income Tax Status"><input aria-label="Income Tax Status" readOnly className="field-input bg-canvas" value={object.status} /></FormRow>
          <FormRow label="Penghasilan Bruto" required><input id="bp21-gross" aria-label="Penghasilan Bruto" type="number" min="0" className="field-input" value={gross||''} onChange={(e)=>setGross(Number(e.target.value))} /></FormRow>
          <FormRow label="Rate"><output aria-label="Rate" className="field-input block bg-canvas">{taxObject?rate:0}%</output></FormRow>
          <FormRow label="Income Tax Withheld"><output aria-label="Income Tax Withheld" className="field-input block bg-canvas">Rp {rupiah(taxObject?withheld:0)}</output></FormRow>
          <FormRow label="Revenue Code"><input aria-label="Revenue Code" readOnly className="field-input bg-canvas" value={object.revenue} /></FormRow>
        </FormSection>
        <FormSection title="REFERENCE DOCUMENT">
          <FormRow label="Document Type" required><select id="bp21-doc-type" aria-label="Document Type" className="field-input" value={documentType} onChange={(e)=>setDocumentType(e.target.value)}><option value="">Pilih jenis dokumen</option><option>Bukti Pembayaran</option><option>Kontrak/Perjanjian</option><option>Invoice</option><option>Dokumen pendukung lainnya</option></select></FormRow>
          <FormRow label="Document Number" required><input id="bp21-doc-number" aria-label="Document Number" className="field-input" value={documentNumber} onChange={(e)=>setDocumentNumber(e.target.value)} /></FormRow>
          <FormRow label="Reference Document Date" required><input id="bp21-doc-date" aria-label="Reference Document Date" type="date" className="field-input" value={documentDate} onChange={(e)=>setDocumentDate(e.target.value)} /></FormRow>
          <FormRow label="ID Place of Business Activity" required><select id="bp21-tku" aria-label="ID Place of Business Activity" className="field-input" value={nitku} onChange={(e)=>setNitku(e.target.value)}><option value="">Pilih NITKU</option>{tkuOptions.map((t)=><option key={t.nitku} value={t.nitku}>{t.nitku} - {t.nama}</option>)}</select></FormRow>
        </FormSection>
        {notice&&<p role="status" className="my-3 text-sm">{notice}</p>}
        <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={resetForm}>Tutup</button><button className="btn-secondary" disabled={pending} onClick={()=>void run(()=>save(false))}>{pending ? 'Saving...' : 'Simpan Draft'}</button><button className="btn-primary" disabled={pending} onClick={()=>void run(()=>save(true))}>Submit</button></div>
      </section>}
      {confirmation && <ConfirmModal title={confirmation === 'delete' ? 'Hapus bukti pemotongan' : 'Batalkan bukti pemotongan'} message={confirmation === 'delete' ? 'Apakah Anda yakin ingin menghapus bukti pemotongan yang dipilih?' : 'Apakah Anda yakin ingin membatalkan bukti pemotongan terbit yang dipilih?'} actionLabel={confirmation === 'delete' ? 'Hapus' : 'Batalkan'} onCancel={() => setConfirmation(null)} onConfirm={confirmation === 'delete' ? remove : cancel} />}
      {signing && <SignDialog signerNik={db.session!.personNik} onCancel={() => setSigning(false)} onConfirm={issue} />}
    </div>
  );
}
