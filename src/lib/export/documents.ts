import type { BupotDoc, SptDoc, TaxEntity } from '@/lib/domain/types';

/** Downloads are generated locally; these documents are educational simulations. */
export async function downloadSimulationPdf(filename: string, title: string, rows: [string, string][]) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF();
  const heading = () => {
    pdf.setFontSize(16); pdf.text('EduTax - Universitas Negeri Yogyakarta', 14, 18);
    pdf.setFontSize(10); pdf.text('SIMULASI EDUKASI - BUKAN DOKUMEN RESMI DJP', 14, 26);
    pdf.setFontSize(13); pdf.text(title, 14, 38);
  };
  heading();
  let y = 50;
  pdf.setFontSize(10);
  for (const [label, value] of rows) {
    const lines: string[] = pdf.splitTextToSize(`${label}: ${value}`, 180);
    for (const line of lines) {
      if (y > 278) { pdf.addPage(); heading(); pdf.setFontSize(10); y = 50; }
      pdf.text(line, 14, y); y += 5;
    }
    y += 3;
  }
  pdf.save(`${filename}.pdf`);
}

export function downloadBupot(doc: BupotDoc) {
  return downloadSimulationPdf(`${doc.kind}-${doc.withholdingNumber ?? doc.id}`, `Bukti Pemotongan ${doc.kind}`, [
    ['NPWP Pemotong', doc.entityTin], ['Nomor Bukti Potong', doc.withholdingNumber ?? '-'],
    ['Status', doc.status], ['Masa Pajak', `${doc.taxPeriodMonth}/${doc.taxPeriodYear}`],
    ['NIK/NPWP Penerima', doc.counterpartTin], ['Nama', doc.counterpartName],
    ['Kode Objek Pajak', doc.taxObjectCode], ['Penghasilan Bruto', String(doc.gross)],
    ['PPh Dipotong', String(doc.withheld)], ['ID Tempat Kegiatan Usaha', doc.idPlaceOfBusinessActivity],
    ['Penandatangan', doc.signature?.signerNik ?? '-'], ['Tanggal Tanda Tangan', doc.signature?.signedAt ?? '-'],
    ...Object.entries(doc.fields).map(([key, value]): [string, string] => [key, String(value ?? '')]),
  ]);
}

export function downloadSpt(doc: SptDoc, entity: TaxEntity | undefined, receipt = false) {
  if (receipt && doc.status !== 'DILAPORKAN') throw new Error('Bukti penerimaan tersedia setelah SPT dilaporkan.');
  return downloadSimulationPdf(`${receipt ? 'BPE' : 'SPT'}-${doc.id}`, receipt ? 'Bukti Penerimaan Elektronik' : 'Formulir Induk SPT Masa PPh 21/26', [
    ['Referensi Simulasi', doc.id], ['NPWP', doc.entityTin], ['Nama', entity?.name ?? ''],
    ['Alamat', entity?.address ?? ''], ['Masa Pajak', `${doc.taxPeriodMonth}/${doc.taxPeriodYear}`],
    ['Model', doc.model], ['Status', doc.status], ['Tanggal Lapor', doc.submittedAt ?? '-'],
    ['Penandatangan', doc.declaration.signerName], ['Tanggal Tanda Tangan', doc.signature?.signedAt ?? '-'],
  ]);
}
