'use client';
import { useRef, useState } from 'react';
import { useDb } from '@/lib/storage/useDb';
import type { BupotDoc } from '@/lib/domain/types';
import { bp21Tax, progressiveTax, ptkpAmount, withheldByTer } from '@/lib/domain/ter';

type Kind = 'BPMP' | 'BP21' | 'BPA2';
export function ImportMenu({ kind }: { kind: Kind }) {
  const { db, mutate } = useDb();
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  function template() {
    const tags = ['Month','Year','TIN','Name','Gross','PTKP','TaxObjectCode','NITKU', ...(kind === 'BP21' ? ['DocumentType','DocumentNumber','DocumentDate'] : []), ...(kind === 'BPA2' ? ['StartMonth','Deduction','PreviousWithheld'] : [])];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Template simulasi EduTax, bukan skema impor resmi DJP. Isi seluruh field sebelum Browse. -->\n<EduTaxImport kind="${kind}" version="1"><Record>\n${tags.map((tag) => `  <${tag}></${tag}>`).join('\n')}\n</Record></EduTaxImport>`;
    const url = URL.createObjectURL(new Blob([xml], {type:'application/xml'}));
    const a = document.createElement('a'); a.href = url; a.download = `template-edutax-${kind}.xml`; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  async function upload(file: File) {
    const entityTin = db.session?.impersonatingTin;
    if (!entityTin || !db.session) return;
    setBusy(true); setMessage('Uploading...');
    try {
      if (!file.name.toLowerCase().endsWith('.xml') || file.size > 2_000_000) throw new Error('Pilih file XML maksimal 2 MB.');
      const text = await file.text();
      if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('Deklarasi DTD/entity tidak didukung.');
      const xml = new DOMParser().parseFromString(text,'application/xml');
      if (xml.querySelector('parsererror') || xml.documentElement.tagName !== 'EduTaxImport' || xml.documentElement.getAttribute('kind') !== kind) throw new Error('XML tidak valid atau jenis dokumen berbeda. Gunakan template EduTax.');
      const nodes = [...xml.documentElement.children];
      if (!nodes.length || nodes.length > 500 || nodes.some((n) => n.tagName !== 'Record')) throw new Error('XML harus berisi 1 sampai 500 Record.');
      const records = nodes.map((node,index): BupotDoc => {
        const get = (tag: string) => [...node.children].find((e) => e.tagName === tag)?.textContent?.trim() ?? '';
        const number = (tag: string) => { const raw = get(tag); const value = Number(raw); if (!raw || !Number.isFinite(value) || value < 0) throw new Error(`Record ${index+1}: ${tag} harus angka nonnegatif.`); return value; };
        const month = number('Month'), year = number('Year'), gross = number('Gross'), tin = get('TIN'), name = get('Name'), nitku = get('NITKU'), ptkp = get('PTKP');
        if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2024 || year > 9999 || !/^\d{16}$/.test(tin) || !name || !gross || !get('TaxObjectCode')) throw new Error(`Record ${index+1}: identitas, periode, objek pajak, atau penghasilan belum valid.`);
        if (!db.tkus.some((t) => t.entityTin === entityTin && t.nitku === nitku)) throw new Error(`Record ${index+1}: NITKU bukan milik akun aktif.`);
        let rate = 0, withheld = 0;
        const fields: Record<string, unknown> = {ptkp};
        if (kind === 'BPMP') ({rate,withheld} = withheldByTer(ptkp,gross));
        if (kind === 'BP21') {
          if (!get('DocumentNumber') || !get('DocumentType') || !/^\d{4}-\d{2}-\d{2}$/.test(get('DocumentDate')) || !Number.isFinite(Date.parse(get('DocumentDate')))) throw new Error(`Record ${index+1}: dokumen referensi belum valid.`);
          ({rate,withheld} = bp21Tax(get('TaxObjectCode'),gross));
          Object.assign(fields,{documentNumber:get('DocumentNumber'),documentType:get('DocumentType'),documentDate:get('DocumentDate')});
        }
        if (kind === 'BPA2') {
          const startMonth = number('StartMonth'), deduction = number('Deduction'), previousWithheld = number('PreviousWithheld');
          if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > month) throw new Error(`Record ${index+1}: masa awal tidak valid.`);
          const net = Math.max(0,gross-deduction), taxable = Math.floor(Math.max(0,net-ptkpAmount(ptkp))/1000)*1000;
          withheld = progressiveTax(taxable); rate = withheld/gross*100;
          Object.assign(fields,{startMonth,endMonth:month,salary:gross,tht:0,deduction,previousWithheld,net,taxable,balance:withheld-previousWithheld});
        }
        const person = db.persons.find((p) => p.nik === tin && p.padan);
        return {id:crypto.randomUUID(),kind,entityTin,status:'DRAFT',withholdingNumber:null,taxPeriodMonth:month,taxPeriodYear:year,counterpartTin:person ? tin : '9990000000999000',counterpartName:name,taxObjectCode:get('TaxObjectCode'),gross,rate,withheld,idPlaceOfBusinessActivity:nitku,createdByNik:db.session!.personNik,createdAt:new Date().toISOString(),signature:null,cancelledAt:null,fields};
      });
      await new Promise((resolve) => setTimeout(resolve,400));
      mutate((current) => {
        if (current.session?.impersonatingTin !== entityTin) throw new Error('Akun aktif berubah. Ulangi impor.');
        current.bupots.push(...records);
      });
      setMessage(`${records.length} record berhasil diimpor ke Belum Terbit.${records.some((r) => r.counterpartTin === '9990000000999000') ? ' NIK yang tidak dikenali disimpan sebagai 9990000000999000.' : ''}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Impor gagal. Tidak ada record disimpan.'); }
    finally {setBusy(false); if(picker.current) picker.current.value='';}
  }
  return <div className="mt-3"><details><summary className="cursor-pointer text-sm font-medium text-brand-600">Impor Data</summary><div className="mt-2 flex flex-wrap gap-2"><button disabled={busy} className="btn-secondary" onClick={() => picker.current?.click()}>{busy ? 'Uploading...' : 'Browse'}</button><button disabled={busy} className="btn-secondary" onClick={template}>Download Template</button></div><p className="mt-2 text-xs text-ink-muted">Template XML simulasi EduTax, bukan format resmi DJP.</p></details><input ref={picker} type="file" accept=".xml,application/xml,text/xml" aria-label="Pilih XML bukti potong" className="hidden" onChange={(e) => {const file=e.target.files?.[0]; if(file) void upload(file);}} /><p role="status" className="mt-2 text-sm">{message}</p></div>;
}
