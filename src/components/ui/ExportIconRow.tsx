'use client';

import { FileDown, FileSpreadsheet, FileText, RefreshCw } from 'lucide-react';

/** Baris icon refresh + ekspor CSV/Excel/PDF, warna dan urutan persis slide 87. */
export function ExportIconRow({
  onRefresh,
  onCsv,
  onXls,
  onPdf,
}: {
  onRefresh: () => void;
  onCsv: () => void;
  onXls: () => void;
  onPdf: () => void;
}) {
  return (
    <div className="mb-2 flex gap-2">
      <button className="rounded-md bg-brand-50 p-2 text-brand-800" title="Muat ulang" onClick={onRefresh}>
        <RefreshCw size={16} />
      </button>
      <button className="rounded-md bg-zinc-600 p-2 text-white" title="Ekspor CSV" onClick={onCsv}>
        <FileText size={16} />
      </button>
      <button className="rounded-md bg-good p-2 text-white" title="Ekspor Excel" onClick={onXls}>
        <FileSpreadsheet size={16} />
      </button>
      <button className="rounded-md bg-bad p-2 text-white" title="Ekspor PDF" onClick={onPdf}>
        <FileDown size={16} />
      </button>
    </div>
  );
}
