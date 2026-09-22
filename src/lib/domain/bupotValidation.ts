import type { BupotDoc } from './types';

/** Shared guard for the transition from a saved draft to an issued document. */
export function assertIssuable(records: BupotDoc[], selected: string[], entityTin: string | null | undefined) {
  if (!entityTin || !selected.length) throw new Error('Pilih bukti pemotongan pada akun aktif.');
  for (const id of selected) {
    const doc = records.find((r) => r.id === id && r.entityTin === entityTin);
    if (!doc || !['DRAFT','SUBMITTED'].includes(doc.status)) throw new Error('Pilihan memuat dokumen yang tidak dapat diterbitkan.');
    if (!/^\d{16}$/.test(doc.counterpartTin) || !doc.counterpartName.trim() || !doc.taxObjectCode || !doc.idPlaceOfBusinessActivity || !Number.isInteger(doc.taxPeriodMonth) || doc.taxPeriodMonth < 1 || doc.taxPeriodMonth > 12 || !Number.isInteger(doc.taxPeriodYear) || doc.taxPeriodYear < 2024 || doc.taxPeriodYear > 9999 || !Number.isFinite(doc.gross) || doc.gross <= 0 || !Number.isFinite(doc.withheld) || doc.withheld < 0) throw new Error('Lengkapi data wajib dan perhitungan sebelum menerbitkan bukti potong.');
    if (doc.kind === 'BP21' && (!String(doc.fields.documentNumber ?? '').trim() || !Number.isFinite(Date.parse(String(doc.fields.documentDate ?? ''))))) throw new Error('Dokumen referensi BP21 belum lengkap.');
  }
}
