'use client';
import { useEffect, useRef, useState } from 'react';
import { Eye, Pencil } from 'lucide-react';
import { useDb } from '@/lib/storage/useDb';
import type { BupotDoc } from '@/lib/domain/types';
import { bp21Tax, PTKP_OPTIONS, progressiveTax, ptkpAmount, withheldByTer } from '@/lib/domain/ter';

export function BupotRecordActions({ record }: { record: BupotDoc }) {
  const [mode, setMode] = useState<'view' | 'edit' | null>(null);
  const { db } = useDb();
  if (record.entityTin !== db.session?.impersonatingTin) return null;
  return <span className="inline-flex gap-2">
    <button title="View" aria-label={`View ${record.counterpartName}`} onClick={() => setMode('view')}><Eye size={16} /></button>
    {['DRAFT', 'SUBMITTED'].includes(record.status) && <button title="Edit" aria-label={`Edit ${record.counterpartName}`} onClick={() => setMode('edit')}><Pencil size={16} /></button>}
    {mode && <RecordDialog key={`${record.id}-${mode}`} record={record} readOnly={mode === 'view'} onClose={() => setMode(null)} />}
  </span>;
}

function RecordDialog({ record, readOnly, onClose }: { record: BupotDoc; readOnly: boolean; onClose: () => void }) {
  const { db, mutate } = useDb();
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(() => structuredClone(record));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { if (db.session?.impersonatingTin !== record.entityTin) onClose(); }, [db.session?.impersonatingTin, record.entityTin, onClose]);
  const change = (patch: Partial<BupotDoc>) => setDraft((value) => ({ ...value, ...patch }));
  const field = (key: string, value: unknown) => setDraft((current) => ({ ...current, fields: { ...current.fields, [key]: value } }));
  async function save() {
    if (busy || readOnly) return;
    setMessage('');
    if (!/^\d{16}$/.test(draft.counterpartTin) || !draft.counterpartName.trim() || !Number.isInteger(draft.taxPeriodMonth) || draft.taxPeriodMonth < 1 || draft.taxPeriodMonth > 12 || !Number.isInteger(draft.taxPeriodYear) || draft.taxPeriodYear < 2024 || !Number.isFinite(draft.gross) || draft.gross <= 0) { setMessage('Lengkapi identitas, masa/tahun pajak, dan penghasilan bruto positif.'); return; }
    setBusy(true);
    try {
      const updated = structuredClone(draft);
      if (updated.kind === 'BPMP') Object.assign(updated, withheldByTer(String(updated.fields.ptkp), updated.gross));
      if (updated.kind === 'BP21') {
        if (!String(updated.fields.documentNumber ?? '').trim() || !Number.isFinite(Date.parse(String(updated.fields.documentDate ?? '')))) throw new Error('Nomor dan tanggal dokumen referensi wajib diisi.');
        Object.assign(updated, bp21Tax(updated.taxObjectCode, updated.gross));
      }
      if (updated.kind === 'BPA2') {
        const salary = Number(updated.fields.salary), tht = Number(updated.fields.tht), deduction = Number(updated.fields.deduction), previous = Number(updated.fields.previousWithheld);
        if (![salary, tht, deduction, previous].every((n) => Number.isFinite(n) && n >= 0)) throw new Error('Nilai penghasilan dan pengurang harus nonnegatif.');
        const start = Number(updated.fields.startMonth ?? 1);
        if (start < 1 || start > updated.taxPeriodMonth) throw new Error('Masa awal tidak boleh melewati masa akhir.');
        updated.gross = salary + tht + Object.values((updated.fields.benefits ?? {}) as Record<string, number>).reduce((sum, n) => sum + n, 0);
        const net = Math.max(0, updated.gross - deduction);
        const taxable = Math.floor(Math.max(0, net - ptkpAmount(String(updated.fields.ptkp))) / 1000) * 1000;
        updated.withheld = progressiveTax(taxable);
        updated.rate = updated.gross ? updated.withheld / updated.gross * 100 : 0;
        Object.assign(updated.fields, { net, taxable, balance: updated.withheld - previous, endMonth: updated.taxPeriodMonth });
      }
      if (!Number.isFinite(updated.gross) || updated.gross <= 0) throw new Error('Penghasilan bruto harus positif.');
      await new Promise((resolve) => setTimeout(resolve, 350));
      mutate((current) => {
        const index = current.bupots.findIndex((b) => b.id === record.id && b.entityTin === current.session?.impersonatingTin && ['DRAFT', 'SUBMITTED'].includes(b.status));
        if (index < 0) throw new Error('Dokumen sudah berubah status atau akun aktif berubah.');
        current.bupots[index] = updated;
      });
      setMessage('Data berhasil disimpan.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal menyimpan data.'); }
    finally { setBusy(false); }
  }
  const textField = (label: string, value: string | number, onChange: (value: string) => void, type = 'text') => <label className="block"><span className="field-label">{label}</span><input aria-label={label} className="field-input" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
  return <dialog ref={dialog} aria-labelledby="record-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl overflow-auto rounded-card bg-white p-5 shadow-card backdrop:bg-brand-900/40">
    <h2 id="record-title" className="font-semibold">{readOnly ? 'View' : 'Edit'} EBUPOT {record.kind}</h2>
    <p className="mt-2 text-sm">{record.status} | {record.withholdingNumber ?? '-'}</p>
    <fieldset disabled={readOnly || busy} className="mt-4 grid gap-3 sm:grid-cols-2">
      {textField('Tax Period', draft.taxPeriodMonth, (v) => change({ taxPeriodMonth: Number(v) }), 'number')}
      {textField('Tax Year', draft.taxPeriodYear, (v) => change({ taxPeriodYear: Number(v) }), 'number')}
      {textField('TIN', draft.counterpartTin, (v) => change({ counterpartTin: v }))}
      {textField('Name', draft.counterpartName, (v) => change({ counterpartName: v }))}
      {record.kind !== 'BPA2' && textField('Penghasilan Bruto', draft.gross, (v) => change({ gross: Number(v) }), 'number')}
      {record.kind !== 'BP21' && <label><span className="field-label">Status of Tax Exemption</span><select aria-label="Status of Tax Exemption" className="field-input" value={String(draft.fields.ptkp ?? '')} onChange={(e) => field('ptkp', e.target.value)}><option value="">Pilih PTKP</option>{PTKP_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select></label>}
      {record.kind === 'BPMP' && textField('Position', String(draft.fields.jabatan ?? ''), (v) => field('jabatan', v))}
      {record.kind === 'BP21' && <>{textField('Document Number', String(draft.fields.documentNumber ?? ''), (v) => field('documentNumber', v))}{textField('Reference Document Date', String(draft.fields.documentDate ?? ''), (v) => field('documentDate', v), 'date')}</>}
      {record.kind === 'BPA2' && <>{textField('Tax Period Start', Number(draft.fields.startMonth ?? 1), (v) => field('startMonth', Number(v)), 'number')}{[['salary','Salary/Pension or THT/JHT'],['tht','Penghasilan lain'],['deduction','Pengurang'],['previousWithheld','PPh 21 telah dipotong']].map(([key,label]) => <div key={key}>{textField(label, Number(draft.fields[key] ?? 0), (v) => field(key, Number(v)), 'number')}</div>)}{textField('NIP/NRP', String(draft.fields.nip ?? ''), (v) => field('nip',v))}{textField('Position', String(draft.fields.position ?? ''), (v) => field('position',v))}</>}
      {record.kind !== 'BP21' && textField('Address', String(draft.fields.address ?? ''), (v) => field('address',v))}
      {record.kind === 'BPMP' && <>{textField('Country', String(draft.fields.country ?? ''), (v)=>field('country',v))}{textField('Passport Number', String(draft.fields.passport ?? ''), (v)=>field('passport',v))}</>}
      {record.kind === 'BPA2' && <>{textField('Gender', String(draft.fields.gender ?? ''), (v)=>field('gender',v))}{textField('Class/Rank', String(draft.fields.rank ?? ''), (v)=>field('rank',v))}{Object.entries((draft.fields.benefits ?? {}) as Record<string,number>).map(([label,value])=><div key={label}>{textField(label,value,(v)=>field('benefits',{...(draft.fields.benefits as Record<string,number>),[label]:Number(v)}),'number')}</div>)}</>}
      <label><span className="field-label">ID Place of Business Activity</span><select aria-label="ID Place of Business Activity" className="field-input" value={draft.idPlaceOfBusinessActivity} onChange={(event) => change({ idPlaceOfBusinessActivity: event.target.value })}>{db.tkus.filter((t) => t.entityTin === record.entityTin).map((t) => <option key={t.nitku} value={t.nitku}>{t.nitku} - {t.nama}</option>)}</select></label>
    </fieldset>
    <p className="mt-3 text-sm">PPh tersimpan: Rp {record.withheld.toLocaleString('id-ID')}</p>
    <p role="status" className="mt-3 text-sm">{message}</p>
    <div className="mt-4 flex justify-end gap-2"><button className="btn-secondary" disabled={busy} onClick={onClose}>Tutup</button>{!readOnly && <button className="btn-primary" disabled={busy} onClick={() => void save()}>{busy ? 'Saving...' : 'Simpan Perubahan'}</button>}</div>
  </dialog>;
}
