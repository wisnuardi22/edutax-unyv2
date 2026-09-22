'use client';
import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, RefreshCw } from 'lucide-react';
import type { BupotDoc } from '@/lib/domain/types';
import { BupotRecordActions } from './BupotRecordActions';
import { downloadBupot, downloadSimulationPdf } from '@/lib/export/documents';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function BupotTable({ kind, rows, selected, onSelect }: { kind: 'BPMP' | 'BP21' | 'BPA2'; rows: BupotDoc[]; selected: string[]; onSelect: (ids: string[]) => void }) {
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<'period' | 'number' | 'status' | 'tku'>('period');
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const filtered = useMemo(() => rows.filter((row) => (!query || [row.withholdingNumber, row.counterpartName, row.counterpartTin, row.idPlaceOfBusinessActivity].some((v) => v?.toLowerCase().includes(query.toLowerCase()))) && (!period || `${row.taxPeriodYear}-${String(row.taxPeriodMonth).padStart(2,'0')}` === period) && (!status || row.status === status)).sort((a,b) => {
    const value = (r: BupotDoc) => sort === 'period' ? r.taxPeriodYear * 100 + r.taxPeriodMonth : sort === 'number' ? r.withholdingNumber ?? '' : sort === 'status' ? r.status : r.idPlaceOfBusinessActivity;
    return String(value(a)).localeCompare(String(value(b)), undefined, {numeric: true}) * (descending ? -1 : 1);
  }), [rows, query, period, status, sort, descending]);
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * size, current * size);
  const allSelected = visible.length > 0 && visible.every((r) => selected.includes(r.id));
  function sortBy(key: typeof sort) { setDescending(sort === key ? !descending : false); setSort(key); }
  async function exportRows(format: 'csv' | 'xlsx' | 'pdf') {
    setBusy(true); setNotice('Generating...');
    try {
      const headers = ['Tax Period','Withholding Number','Status','TIN','Name','Gross Income','Income Tax Withheld','ID Place of Business Activity'];
      const values = filtered.map((r) => [`${r.taxPeriodMonth}/${r.taxPeriodYear}`,r.withholdingNumber ?? '',r.status,r.counterpartTin,r.counterpartName,r.gross,r.withheld,r.idPlaceOfBusinessActivity]);
      if (format === 'csv') {
        const cell = (v: unknown) => { let text = String(v); if (/^[=+@\-\t\r]/.test(text)) text = "'" + text; return '"' + text.replaceAll('"','""') + '"'; };
        downloadBlob(new Blob(['\uFEFF' + [headers,...values].map((r) => r.map(cell).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'}), 'edutax-bupot.csv');
      } else if (format === 'xlsx') {
        const { Workbook } = await import('exceljs'); const workbook = new Workbook();
        const sheet = workbook.addWorksheet('Bukti Potong'); sheet.addRow(headers); values.forEach((r) => sheet.addRow(r));
        sheet.getRow(1).font = {bold:true}; sheet.columns.forEach((c) => {c.width = 25;});
        const buffer = await workbook.xlsx.writeBuffer();
        downloadBlob(new Blob([new Uint8Array(buffer)], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), 'edutax-bupot.xlsx');
      } else {
        await downloadSimulationPdf('edutax-bupot', 'Daftar Bukti Pemotongan', values.flatMap((r, index) => [[`Record ${index+1}`, ''], ...r.map((v,i): [string,string] => [headers[i],String(v)])] as [string,string][]));
      }
      setNotice(`${filtered.length} record berhasil diekspor.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Export gagal.'); }
    finally { setBusy(false); }
  }
  return <div className="mt-3">
    <div className="mb-3 flex flex-wrap items-end gap-2">
      <label><span className="field-label">Tax Period</span><input aria-label="Filter Tax Period" type="month" className="field-input" value={period} onChange={(e) => {setPeriod(e.target.value);setPage(1);onSelect([]);}} /></label>
      <label className="min-w-48 flex-1"><span className="field-label">Withholding Number / TIN / Name / ID TKU</span><input aria-label="Cari bukti potong" className="field-input" value={query} onChange={(e) => {setQuery(e.target.value);setPage(1);onSelect([]);}} /></label>
      <label><span className="field-label">Status</span><select aria-label="Filter Status" className="field-input" value={status} onChange={(e) => {setStatus(e.target.value);setPage(1);onSelect([]);}}><option value="">Semua</option>{['DRAFT','SUBMITTED','ISSUED','CANCELLED'].map((v) => <option key={v}>{v}</option>)}</select></label>
      <button className="btn-secondary" title="Refresh" aria-label="Refresh" onClick={() => { setQuery('');setPeriod('');setStatus('');setPage(1);onSelect([]);setNotice('Data dimuat ulang.'); }}><RefreshCw size={16} /></button>
      {(['csv','xlsx','pdf'] as const).map((format) => <button key={format} className="btn-secondary" title={`Export ${format.toUpperCase()}`} aria-label={`Export ${format.toUpperCase()}`} disabled={busy} onClick={() => void exportRows(format)}>{format === 'xlsx' ? <FileSpreadsheet size={16} /> : <FileText size={16} />}{format.toUpperCase()}</button>)}
    </div>
    <p role="status" className="my-2 text-sm">{notice}</p>
    <div className="overflow-x-auto"><table className="data-table"><thead><tr>
      <th><input type="checkbox" aria-label="Pilih semua pada halaman" checked={allSelected} onChange={(e) => onSelect(e.target.checked ? [...new Set([...selected,...visible.map((r) => r.id)])] : selected.filter((id) => !visible.some((r) => r.id === id)))} /></th>
      {kind === 'BPA2' && <th>Tax Period Start</th>}<th><button onClick={() => sortBy('period')}>{kind === 'BPA2' ? 'Tax Period End' : 'Tax Period'}</button></th><th><button onClick={() => sortBy('number')}>Withholding Number</button></th><th><button onClick={() => sortBy('status')}>Status</button></th>{kind === 'BP21' && <th>E-Sign Status</th>}<th><button onClick={() => sortBy('tku')}>ID Place of Business Activity</button></th><th>Action</th>
    </tr></thead><tbody>{visible.length === 0 && <tr><td colSpan={kind === 'BPMP' ? 6 : 7} className="py-8 text-center text-ink-muted">Tidak ada data yang ditemukan.</td></tr>}{visible.map((r) => <tr key={r.id}><td><input type="checkbox" aria-label={`Pilih ${r.counterpartName}`} checked={selected.includes(r.id)} onChange={(e) => onSelect(e.target.checked ? [...selected,r.id] : selected.filter((id) => id !== r.id))} /></td>{kind === 'BPA2' && <td>{r.fields.startMonth as number ?? 1}/{r.taxPeriodYear}</td>}<td>{r.taxPeriodMonth}/{r.taxPeriodYear}</td><td>{r.withholdingNumber ?? '-'}</td><td><span className="rounded bg-brand-50 px-2 py-1 text-xs">{r.status}</span></td>{kind === 'BP21' && <td>{r.signature ? 'Signed' : '-'}</td>}<td className="font-mono text-xs">{r.idPlaceOfBusinessActivity}</td><td><span className="inline-flex items-center gap-3"><BupotRecordActions record={r} />{r.status === 'ISSUED' && <button title={r.kind === 'BPA2' ? 'Download BP A2' : 'Download Bukti Potong'} aria-label={r.kind === 'BPA2' ? 'Download BP A2' : 'Download Bukti Potong'} disabled={busy} onClick={async () => {setBusy(true);setNotice('Generating...');try {await downloadBupot(r);setNotice('Dokumen berhasil diunduh.');} catch {setNotice('Unduhan gagal.');} finally {setBusy(false);}}}><Download size={16} /></button>}</span></td></tr>)}</tbody></table></div>
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><label>Baris per halaman <select aria-label="Baris per halaman" value={size} onChange={(e) => {setSize(Number(e.target.value));setPage(1);}}>{[10,25,50].map((v) => <option key={v}>{v}</option>)}</select></label><span>{filtered.length} record | Halaman {current}/{pages}</span><button className="btn-secondary" disabled={current === 1} onClick={() => setPage(current-1)}>Sebelumnya</button><button className="btn-secondary" disabled={current === pages} onClick={() => setPage(current+1)}>Berikutnya</button></div>
  </div>;
}
