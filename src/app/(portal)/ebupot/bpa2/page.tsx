'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePendingAction } from '@/components/ui/usePendingAction';
import { usePathname, useRouter } from 'next/navigation';
import { BupotSidebar, BUPOT_TABS } from '@/components/ebupot/BupotSidebar';
import { assertIssuable } from '@/lib/domain/bupotValidation';
import { FormSection, FormRow } from '@/components/ui/FormSection';
import { ImportMenu } from '@/components/ebupot/ImportMenu';
import { BupotTable } from '@/components/ebupot/BupotTable';
import { PTKP_OPTIONS, progressiveTax, ptkpAmount } from '@/lib/domain/ter';
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
const BENEFITS = ['Wife Income Benefit', 'Children Income Benefit', 'Income Improvement Benefit', 'Structural/Functional Benefit', 'Rice Income Benefit', 'Other Fixed and Regular Income Whose Payment is Separated from Salary Payments'];
const rupiah = (value: number) => value.toLocaleString('id-ID');

export default function Bpa2Page() {
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
  const [year, setYear] = useState(0);
  const [startMonth, setStartMonth] = useState(0);
  const [endMonth, setEndMonth] = useState(0);
  const [tin, setTin] = useState('');
  const [name, setName] = useState('');
  const [ptkp, setPtkp] = useState('');
  const [nip, setNip] = useState('');
  const [position, setPosition] = useState('');
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState('');
  const [rank, setRank] = useState('');
  const [secondEmployer, setSecondEmployer] = useState(false);
  const [previousSlip, setPreviousSlip] = useState('');
  const [benefits, setBenefits] = useState<Record<string, number>>({});
  const [nitku, setNitku] = useState('');
  const [taxObject, setTaxObject] = useState('');
  const [salary, setSalary] = useState(0);
  const [tht, setTht] = useState(0);
  const [deduction, setDeduction] = useState(0);
  const [previousWithheld, setPreviousWithheld] = useState(0);
  const rows = useMemo(() => db.bupots.filter((b) => b.kind === 'BPA2' && b.entityTin === entityTin && tabOf(b.status) === tab), [db.bupots, entityTin, tab]);
  const person = db.persons.find((item) => item.nik === tin.replace(/\D/g, ''));
  const gross = salary + tht + Object.values(benefits).reduce((sum, value) => sum + value, 0);
  const net = Math.max(0, gross - deduction);
  const taxable = ptkp ? Math.floor(Math.max(0, net - ptkpAmount(ptkp)) / 1000) * 1000 : 0;
  const annualTax = progressiveTax(Number.isFinite(taxable) ? taxable : 0);
  const balance = annualTax - previousWithheld;

  useEffect(() => { setSelected([]); setSigning(false); setFormOpen(false); setConfirmation(null); }, [entityTin]);

  if (!entityTin) return <p className="rounded-card bg-white p-5 text-sm shadow-card">Pilih badan yang Anda wakili di menu Portal Saya sebelum membuat BPA2.</p>;

  const activeEntityTin = entityTin;

  function resetForm() { setTin(''); setName(''); setNip(''); setPosition(''); setSalary(0); setTht(0); setDeduction(0); setPreviousWithheld(0); setFormOpen(false); }

  function save(submit: boolean) {
    const cleanTin = tin.replace(/\D/g, '');
    if (!taxObject || !nitku || !gender || !rank || !ptkp || cleanTin.length !== 16 || !name.trim() || !Number.isInteger(year) || year < 2024 || year > 9999 || !startMonth || !endMonth || startMonth > endMonth || ![salary, tht, deduction, previousWithheld, ...Object.values(benefits)].every((value) => Number.isFinite(value) && value >= 0) || gross <= 0) { setNotice('Lengkapi TIN 16 digit, nama, periode awal/akhir pada tahun yang sama (mulai 2024), dan penghasilan nonnegatif.'); return; }
    mutate((d) => {
      if (d.session?.impersonatingTin !== entityTin) throw new Error('Akun aktif berubah. Ulangi penyimpanan.');
      d.bupots.push({
        id: crypto.randomUUID(), kind: 'BPA2', entityTin: activeEntityTin, status: submit ? 'SUBMITTED' : 'DRAFT', withholdingNumber: null,
        taxPeriodMonth: endMonth, taxPeriodYear: year, counterpartTin: cleanTin, counterpartName: person?.nama ?? name.trim(),
        taxObjectCode: taxObject, gross, rate: gross ? Number((annualTax / gross * 100).toFixed(2)) : 0, withheld: annualTax,
        idPlaceOfBusinessActivity: nitku, createdByNik: d.session!.personNik,
        createdAt: new Date().toISOString(), signature: null, cancelledAt: null,
        fields: { address, gender, rank, secondEmployer, previousSlip, benefits, ptkp, taxable, startMonth, endMonth, year, nip, position, salary, tht, deduction, net, previousWithheld, balance, taxArticle: 'Pasal 21', statusOfWithholding: startMonth === 1 && endMonth === 12 ? 'Setahun' : 'Kurang dari Setahun' },
      });
    });
    setNotice(submit ? 'Data BPA2 berhasil disimpan pada daftar Belum Terbit.' : 'Draft BPA2 berhasil disimpan.'); resetForm();
  }

  function issue(password: string, provider: 'KODE_OTORISASI_DJP' | 'SERTIFIKAT_ELEKTRONIK') {
    if (!password) return;
    mutate((d) => { assertIssuable(d.bupots, selected, d.session?.impersonatingTin); selected.forEach((id) => { const doc = d.bupots.find((item) => item.id === id); if (!doc || doc.entityTin !== d.session?.impersonatingTin || doc.kind !== 'BPA2' || doc.status === 'ISSUED' || doc.status === 'CANCELLED') return; doc.status = 'ISSUED'; doc.withholdingNumber = nextWithholdingNumber(d, doc.entityTin, doc.taxPeriodYear); doc.signature = { provider, signerNik: d.session!.personNik, signedAt: new Date().toISOString() }; }); });
    setSigning(false); setSelected([]); setTab('TELAH_TERBIT'); router.replace('/ebupot/bpa2/telah-terbit'); setNotice('BPA2 berhasil diterbitkan dan tersedia pada lampiran L-II/L-IB SPT.');
  }
  function remove() { mutate((d) => { d.bupots = d.bupots.filter((doc) => !(selected.includes(doc.id) && doc.kind === 'BPA2' && doc.entityTin === d.session?.impersonatingTin && ['DRAFT', 'SUBMITTED'].includes(doc.status))); }); setSelected([]); setNotice('Data BPA2 berhasil dihapus.'); }
  function cancel() { mutate((d) => selected.forEach((id) => { const doc = d.bupots.find((item) => item.id === id); if (doc?.kind === 'BPA2' && doc.entityTin === d.session?.impersonatingTin && doc.status === 'ISSUED') { doc.status = 'CANCELLED'; doc.cancelledAt = new Date().toISOString(); } })); setSelected([]); setTab('TIDAK_VALID'); router.replace('/ebupot/bpa2/tidak-valid'); setNotice('BPA2 dibatalkan dan dipindahkan ke Tidak Valid.'); }

  return <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(220px,20%)_minmax(0,1fr)]">
    <div className={formOpen ? 'hidden' : 'contents'}><BupotSidebar kind="BPA2" tab={tab} />
    <section className="min-w-0 rounded-card bg-white p-4 shadow-card"><div className="flex flex-wrap items-center gap-2"><h1 className="font-semibold">EBUPOT BPA2 - {TABS.find((item) => item.key === tab)?.label}</h1><div className="ml-auto flex gap-2">{tab === 'BELUM_TERBIT' && <><button className="btn-secondary" onClick={() => {setYear(0);setStartMonth(0);setEndMonth(0);setTin('');setName('');setNip('');setPosition('');setAddress('');setGender('');setRank('');setSecondEmployer(false);setPreviousSlip('');setBenefits({});setNitku('');setTaxObject('');setPtkp('');setSalary(0);setTht(0);setDeduction(0);setPreviousWithheld(0);setNotice(null);setFormOpen(true);}}>+ Buat eBupot BPA2</button><button className="btn-secondary" onClick={() => setConfirmation('delete')} disabled={!selected.length}>Hapus</button><button className="btn-primary" onClick={() => setSigning(true)} disabled={!selected.length}>Terbitkan</button></>}{tab === 'TELAH_TERBIT' && <button className="btn-secondary" onClick={() => setConfirmation('cancel')} disabled={!selected.length}>Batal</button>}</div></div>{notice && <p className="mt-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-[13px] text-brand-800">{notice}</p>}{tab === 'BELUM_TERBIT' && <ImportMenu kind="BPA2" />}<BupotTable kind="BPA2" rows={rows} selected={selected} onSelect={setSelected} /></section>
    </div>
    {formOpen && <section className="col-span-full bg-white p-4"><h1 className="mb-4 font-semibold text-brand-800">EBUPOT BPA2</h1><FormSection title="GENERAL INFORMATION">
<FormRow label="Working for a Second Employer"><select aria-label="Working for a Second Employer" className="field-input" value={String(secondEmployer)} onChange={(e)=>setSecondEmployer(e.target.value==='true')}><option value="false">Tidak</option><option value="true">Ya</option></select></FormRow>
<FormRow label="Tax Period Start"><select id="bpa2-start" aria-label="Tax Period Start" className="field-input" value={startMonth} onChange={(e)=>setStartMonth(Number(e.target.value))}><option value={0}>Pilih masa pajak</option>{Array.from({length:12},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></FormRow>
<FormRow label="Tax Period End"><select id="bpa2-end" aria-label="Tax Period End" className="field-input" value={endMonth} onChange={(e)=>setEndMonth(Number(e.target.value))}><option value={0}>Pilih masa pajak</option>{Array.from({length:12},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></FormRow>
<FormRow label="Tax Year"><input id="bpa2-year" aria-label="Tax Year" type="number" className="field-input" value={year || ''} onChange={(e)=>setYear(Number(e.target.value))} /></FormRow>
<FormRow label="Status"><output aria-label="Status" className="field-input block bg-canvas">{'NORMAL'}</output></FormRow>
<FormRow label="TIN"><input id="bpa2-tin" aria-label="TIN" maxLength={16} className="field-input" value={tin} onChange={(e)=>{setTin(e.target.value);const person=db.persons.find((p)=>p.nik===e.target.value);setName(person?.nama??'');setAddress(person?.alamat??'');}} /></FormRow>
<FormRow label="Name"><input id="bpa2-name" aria-label="Name" type="text" className="field-input" value={name} onChange={(e)=>setName(e.target.value)} /></FormRow>
<FormRow label="Address"><input aria-label="Address" type="text" className="field-input" value={address} onChange={(e)=>setAddress(e.target.value)} /></FormRow>
<FormRow label="NIP/NRP"><input id="bpa2-nip" aria-label="NIP/NRP" type="text" className="field-input" value={nip} onChange={(e)=>setNip(e.target.value)} /></FormRow>
<FormRow label="Gender"><select aria-label="Gender" className="field-input" value={gender} onChange={(e)=>setGender(e.target.value)}><option value="">Pilih jenis kelamin</option><option>Pria</option><option>Wanita</option></select></FormRow>
<FormRow label="Class/Rank"><input aria-label="Class/Rank" type="text" className="field-input" value={rank} onChange={(e)=>setRank(e.target.value)} /></FormRow>
<FormRow label="Status of Exemption"><select id="bpa2-ptkp" aria-label="Status of Exemption" className="field-input" value={ptkp} onChange={(e)=>setPtkp(e.target.value)}><option value="">Pilih PTKP</option>{PTKP_OPTIONS.map((v)=><option key={v}>{v}</option>)}</select></FormRow>
<FormRow label="Position"><input id="bpa2-position" aria-label="Position" type="text" className="field-input" value={position} onChange={(e)=>setPosition(e.target.value)} /></FormRow>
<FormRow label="Tax Object Name"><select aria-label="Tax Object Name" className="field-input" value={taxObject} onChange={(e)=>setTaxObject(e.target.value)}><option value="">Pilih objek pajak</option><option value="21-100-01">Penghasilan yang Diterima atau Diperoleh Pegawai Tetap</option></select></FormRow>
<FormRow label="Tax Article"><output aria-label="Tax Article" className="field-input block bg-canvas">{taxObject ? 'Pasal 21' : ''}</output></FormRow>
<FormRow label="Tax Object Code"><output aria-label="Tax Object Code" className="field-input block bg-canvas">{taxObject}</output></FormRow>
<FormRow label="Status of Withholding"><output aria-label="Status of Withholding" className="field-input block bg-canvas">{startMonth && endMonth ? (startMonth === 1 && endMonth === 12 ? 'Setahun' : 'Kurang dari Setahun') : ''}</output></FormRow>
</FormSection><FormSection title="GROSS INCOME"><FormRow label="Salary/Pension or THT/JHT"><input id="bpa2-salary" aria-label="Salary/Pension or THT/JHT" type="number" className="field-input" value={salary || ''} onChange={(e)=>setSalary(Number(e.target.value))} /></FormRow>
{BENEFITS.map((label)=><FormRow key={label} label={label}><input aria-label={label} type="number" min="0" className="field-input" value={benefits[label]||''} onChange={(e)=>setBenefits((old)=>({...old,[label]:Number(e.target.value)}))} /></FormRow>)}<FormRow label="Other Income Benefit"><input id="bpa2-tht" aria-label="Other Income Benefit" type="number" className="field-input" value={tht || ''} onChange={(e)=>setTht(Number(e.target.value))} /></FormRow>
<FormRow label="Total Gross Income (Rp)"><output aria-label="Total Gross Income (Rp)" className="field-input block bg-canvas">{rupiah(gross)}</output></FormRow>
</FormSection><FormSection title="ANNUAL TAX CALCULATION"><FormRow label="Pengurang"><input id="bpa2-deduction" aria-label="Pengurang" type="number" className="field-input" value={deduction || ''} onChange={(e)=>setDeduction(Number(e.target.value))} /></FormRow>
<FormRow label="Net Income (Rp)"><output aria-label="Net Income (Rp)" className="field-input block bg-canvas">{rupiah(net)}</output></FormRow>
<FormRow label="Previous Withholding Slip BPA1/BPA2 Number from Previous Employer (if any)"><input aria-label="Previous Withholding Slip BPA1/BPA2 Number from Previous Employer (if any)" type="text" className="field-input" value={previousSlip} onChange={(e)=>setPreviousSlip(e.target.value)} /></FormRow>
<FormRow label="Tax Exemption (Rp)"><output aria-label="Tax Exemption (Rp)" className="field-input block bg-canvas">{ptkp ? rupiah(ptkpAmount(ptkp)) : ''}</output></FormRow>
<FormRow label="Taxable Income in a Year (Rp)"><output aria-label="Taxable Income in a Year (Rp)" className="field-input block bg-canvas">{rupiah(taxable)}</output></FormRow>
<FormRow label="Article 21 Income Tax Liability (Rp)"><output aria-label="Article 21 Income Tax Liability (Rp)" className="field-input block bg-canvas">{rupiah(annualTax)}</output></FormRow>
<FormRow label="Article 21 Income Tax Withheld"><input id="bpa2-previous" aria-label="Article 21 Income Tax Withheld" type="number" className="field-input" value={previousWithheld || ''} onChange={(e)=>setPreviousWithheld(Number(e.target.value))} /></FormRow>
<FormRow label="Article 21 Income Tax Under (Over) Payment on Last Period (Rp)"><output aria-label="Article 21 Income Tax Under (Over) Payment on Last Period (Rp)" className="field-input block bg-canvas">{rupiah(balance)}</output></FormRow>
<FormRow label="Revenue Code"><output aria-label="Revenue Code" className="field-input block bg-canvas">{taxObject ? '411121-100' : ''}</output></FormRow>
<FormRow label="ID Place of Business Activity"><select aria-label="ID Place of Business Activity" className="field-input" value={nitku} onChange={(e)=>setNitku(e.target.value)}><option value="">Pilih NITKU</option>{db.tkus.filter((t)=>t.entityTin===entityTin).map((t)=><option key={t.nitku} value={t.nitku}>{t.nitku} - {t.nama}</option>)}</select></FormRow>
</FormSection>{notice&&<p role="status" className="my-3 text-sm">{notice}</p>}<div className="flex justify-end gap-2"><button className="btn-secondary" onClick={resetForm}>Tutup</button><button className="btn-secondary" disabled={pending} onClick={()=>void run(()=>save(false))}>{pending ? 'Saving...' : 'Simpan Draft'}</button><button className="btn-primary" disabled={pending} onClick={()=>void run(()=>save(true))}>Submit</button></div></section>}
    {confirmation && <ConfirmModal title={confirmation === 'delete' ? 'Hapus bukti pemotongan' : 'Batalkan bukti pemotongan'} message={confirmation === 'delete' ? 'Apakah Anda yakin ingin menghapus bukti pemotongan yang dipilih?' : 'Apakah Anda yakin ingin membatalkan bukti pemotongan terbit yang dipilih?'} actionLabel={confirmation === 'delete' ? 'Hapus' : 'Batalkan'} onCancel={() => setConfirmation(null)} onConfirm={confirmation === 'delete' ? remove : cancel} />}
      {signing && <SignDialog signerNik={db.session!.personNik} onCancel={() => setSigning(false)} onConfirm={issue} />}
  </div>;
}
