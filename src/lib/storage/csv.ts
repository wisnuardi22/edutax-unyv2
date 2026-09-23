'use client';

/**
 * Utilitas Impor Data (Download Template / Upload File) dan Export
 * CSV/Excel/PDF yang dipakai bersama oleh semua halaman eBupot — dipakai
 * pertama kali di BP21, lalu dipasang juga ke BPMP untuk konsistensi
 * (keduanya "acuan bentuk" satu sama lain, lihat README).
 *
 * Excel diekspor sebagai tabel HTML berekstensi .xls (trik umum: Microsoft
 * Excel membuka file HTML yang diberi ekstensi .xls/.xlsx tanpa masalah)
 * supaya tidak perlu menambah dependency (mis. SheetJS) yang belum
 * terpasang di package.json. PDF diekspor lewat dialog cetak browser
 * (window.print ke jendela baru) — pengguna memilih "Save as PDF" di sana.
 * Ini simulasi kelas, bukan pengganti fitur DJP Coretax yang sesungguhnya
 * memakai XML terstruktur untuk impor; di sini dipakai CSV supaya bisa
 * dibuka & diedit gampang di Excel/Google Sheets oleh mahasiswa.
 */

export function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n');
}

/** Parser CSV sederhana yang menangani tanda kutip dan koma di dalam field. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      pushField();
    } else if (c === '\r') {
      // dilewati, \n yang menutup baris
    } else if (c === '\n') {
      pushRow();
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) pushRow();
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

/** Ubah baris CSV (dengan header di baris pertama) jadi array of object. */
export function csvRowsToRecords(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  return body.map((r) => {
    const rec: Record<string, string> = {};
    header.forEach((h, i) => { rec[h.trim()] = (r[i] ?? '').trim(); });
    return rec;
  });
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCsvTemplate(filename: string, headers: string[], example: (string | number)[]) {
  // \uFEFF: BOM supaya karakter non-ASCII (mis. nama dengan huruf beraksen) terbaca benar oleh Excel.
  download(filename, '\uFEFF' + toCsv(headers, [example]), 'text/csv;charset=utf-8');
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  download(filename, '\uFEFF' + toCsv(headers, rows), 'text/csv;charset=utf-8');
}

export function downloadXls(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html =
    `<html><head><meta charset="utf-8" /></head><body><table border="1">` +
    `<thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>` +
    `</table></body></html>`;
  download(filename, html, 'application/vnd.ms-excel');
}

/** Buka jendela cetak berisi tabel; pengguna memilih "Save as PDF" pada dialog cetak browser. */
export function printAsPdf(title: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(
    `<html><head><title>${esc(title)}</title><style>
      body{font-family:Arial,Helvetica,sans-serif;padding:16px;color:#111}
      h1{font-size:16px;margin:0 0 12px}
      table{border-collapse:collapse;width:100%;font-size:11px}
      th,td{border:1px solid #999;padding:4px 8px;text-align:left}
      th{background:#f2f2f2}
    </style></head><body>` +
    `<h1>${esc(title)}</h1>` +
    `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` +
    `</body></html>`,
  );
  w.document.close();
  w.focus();
  // Beri waktu render sebelum memanggil dialog cetak.
  setTimeout(() => w.print(), 300);
}

/** Buka file picker, baca file pertama yang dipilih sebagai teks. */
export function pickCsvFile(onLoad: (text: string, fileName: string) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,text/csv';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onLoad(String(reader.result ?? ''), file.name);
    reader.readAsText(file);
  };
  input.click();
}
