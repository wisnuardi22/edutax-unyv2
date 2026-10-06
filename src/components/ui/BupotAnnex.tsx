'use client';
import { useState } from 'react';
import type { BupotDoc } from '@/lib/domain/types';
import { periodGross, periodWithheld } from '@/lib/domain/sptCalc';
import { withholdingDate } from '@/lib/domain/bupotValidation';
import { downloadCsv, downloadXls, printAsPdf } from '@/lib/storage/csv';
import { ExportIconRow } from './ExportIconRow';

export function BupotAnnex({ title, rows, annual = false, lastPeriod = false, all = rows }: {
  title: string; rows: BupotDoc[]; annual?: boolean; lastPeriod?: boolean; all?: BupotDoc[];
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const filtered = rows.filter((b) => `${b.counterpartTin} ${b.counterpartName} ${b.withholdingNumber} ${b.taxObjectCode} ${b.idPlaceOfBusinessActivity}`.toLowerCase().includes(query.toLowerCase()));
  const headers = ['No', 'NIK/NPWP', 'Nama', 'Jenis Pajak', 'Nomor Bukti Pemotongan', 'Tanggal Bukti Pemotongan', 'Kode Objek Pajak',
    annual ? 'Bruto Setahun' : lastPeriod ? 'Bruto Masa Terakhir' : 'Penghasilan Bruto',
    annual ? 'PPh Setahun' : lastPeriod ? 'Kurang/(Lebih) Potong' : 'PPh Dipotong',
    'Masa Perolehan Penghasilan', 'Negara', 'NITKU', 'Status'];
  const gross = (b: BupotDoc) => lastPeriod ? periodGross(b, all) : b.gross;
  const tax = (b: BupotDoc) => lastPeriod ? periodWithheld(b) : b.withheld;
  const values = filtered.map((b, i) => [i + 1, b.counterpartTin, b.counterpartName, b.kind === 'BP26' ? 'Pasal 26' : 'Pasal 21',
    b.withholdingNumber ?? '-', withholdingDate(b).split('-').reverse().join('-'), b.taxObjectCode, gross(b), tax(b),
    `${b.fields.startMonth ?? b.taxPeriodMonth}/${b.fields.startYear ?? b.taxPeriodYear} - ${b.taxPeriodMonth}/${b.taxPeriodYear}`,
    b.fields.country && b.fields.country !== 'Indonesia' ? String(b.fields.country) : 'IDN', b.idPlaceOfBusinessActivity, b.status]);
  const totalGross = filtered.reduce((v, b) => v + gross(b), 0);
  const totalTax = filtered.reduce((v, b) => v + tax(b), 0);
  const exportRows = [...values, ['', '', '', '', '', '', 'TOTAL', totalGross, totalTax, '', '', '', '']];
  const lastPage = Math.max(0, Math.ceil(values.length / 10) - 1);
  const current = Math.min(page, lastPage);
  return <div className="mt-4 space-y-3">
    <h3 className="text-sm font-semibold">{title}</h3>
    <input className="field-input max-w-md" aria-label={`Cari ${title}`} placeholder="Cari NIK, nama, nomor bukti, objek pajak, atau NITKU" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
    <ExportIconRow onRefresh={() => { setQuery(''); setPage(0); }} onCsv={() => downloadCsv(`${title}.csv`, headers, exportRows)}
      onXls={() => downloadXls(`${title}.xls`, headers, exportRows)} onPdf={() => printAsPdf(title, headers, exportRows)} />
    <div className="overflow-x-auto"><table className="data-table"><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{!values.length && <tr><td colSpan={headers.length} className="py-6 text-center">Tidak ada data yang ditemukan.</td></tr>}
        {values.slice(current * 10, current * 10 + 10).map((row, i) => <tr key={filtered[current * 10 + i].id}>{row.map((v, j) => <td key={j} className={j === 7 || j === 8 ? 'text-right' : ''}>{typeof v === 'number' && j > 0 ? v.toLocaleString('id-ID') : v}</td>)}</tr>)}
      </tbody><tfoot><tr><td colSpan={7}>TOTAL</td><td className="text-right">{totalGross.toLocaleString('id-ID')}</td><td className="text-right">{totalTax.toLocaleString('id-ID')}</td><td colSpan={4} /></tr></tfoot>
    </table></div>
    <div className="flex items-center gap-3 text-sm"><button className="btn-secondary" disabled={current === 0} onClick={() => setPage(current - 1)}>Sebelumnya</button>
      <span>Halaman {current + 1} / {lastPage + 1} · {values.length} bukti potong</span>
      <button className="btn-secondary" disabled={current === lastPage} onClick={() => setPage(current + 1)}>Berikutnya</button></div>
  </div>;
}
