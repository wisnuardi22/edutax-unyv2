import { BP21_TAX_OBJECTS } from './bp21';
import { BPMP_TAX_OBJECTS } from './bpmp';
import type { BupotDoc, Person } from './types';

export const UNKNOWN_TIN = '9990000000999000';
export function resolveRecipient(persons: Person[], raw: string, fallbackName: string) {
  const originalTin = raw.replace(/\D/g, '');
  const person = persons.find((p) => p.nik === originalTin || p.npwp16 === originalTin);
  const substituted = originalTin.length === 16 && (!person || !person.padan);
  return {
    originalTin, resolvedTin: substituted ? UNKNOWN_TIN : originalTin,
    name: person?.nama || fallbackName.trim() || (substituted ? `PENERIMA PENGHASILAN#${originalTin}` : ''),
    substituted,
  };
}
export function originalRecipientTin(doc: BupotDoc): string {
  return String(doc.fields.originalTin || doc.counterpartTin);
}
export function withholdingDate(doc: BupotDoc): string {
  return String(doc.fields.withholdingDate || doc.signature?.signedAt || doc.createdAt).slice(0, 10);
}
export function parseWithholdingDate(value: string): string | null {
  const parts = value.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  const iso = parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}
/** Used on Submit and Issue; incomplete drafts remain editable. */
export function validateBupot(doc: Pick<BupotDoc, 'kind' | 'counterpartTin' | 'counterpartName' | 'taxPeriodMonth' | 'taxPeriodYear' | 'gross' | 'withheld' | 'idPlaceOfBusinessActivity' | 'fields'>, allowedNitkus: string[]): string | null {
  if (!/^\d{16}$/.test(doc.counterpartTin)) return 'NIK/NPWP wajib terdiri dari 16 digit.';
  if (!doc.counterpartName.trim()) return 'Nama penerima penghasilan wajib diisi.';
  if (!Number.isInteger(doc.taxPeriodMonth) || doc.taxPeriodMonth < 1 || doc.taxPeriodMonth > 12 || !Number.isInteger(doc.taxPeriodYear) || doc.taxPeriodYear < 2024 || doc.taxPeriodYear > 9999) return 'Masa pajak tidak valid (tahun minimal 2024).';
  if (!Number.isFinite(doc.gross) || doc.gross < 0 || !Number.isFinite(doc.withheld)) return 'Penghasilan dan pajak harus berupa angka yang valid; bruto tidak boleh negatif.';
  if (!allowedNitkus.includes(doc.idPlaceOfBusinessActivity)) return 'Pilih NITKU pemotong yang terdaftar dan berada dalam cakupan akses Anda.';
  if (!['TK/0','TK/1','TK/2','TK/3','K/0','K/1','K/2','K/3'].includes(String(doc.fields.ptkp))) return 'Pilih status PTKP yang valid.';
  if (doc.kind === 'BP21' && doc.fields.taxObjectName !== BP21_TAX_OBJECTS[0].name) return 'Objek pajak ini belum didukung pada praktikum. Pilih objek tenaga ahli yang sesuai modul.';
  if (doc.kind === 'BPMP' && (doc.fields.taxObjectName !== BPMP_TAX_OBJECTS[0].name && (doc.fields.taxObjectName !== BPMP_TAX_OBJECTS[1].name || doc.fields.foreignEmployee))) return 'Kode objek pajak untuk pilihan ini belum terverifikasi. Pilih pegawai tetap atau pensiunan dalam negeri.';
  if (doc.fields.taxFacility && doc.fields.taxFacility !== 'Tanpa Fasilitas' || doc.fields.taxCertificate && !['Tanpa Fasilitas', 'N/A'].includes(String(doc.fields.taxCertificate))) return 'Perhitungan fasilitas pajak ini belum tersedia dalam praktikum.';
  if (doc.kind === 'BP21' && (!doc.fields.referenceDocumentType || !String(doc.fields.referenceDocumentNumber ?? '').trim() || !parseWithholdingDate(String(doc.fields.referenceDocumentDate ?? '')))) return 'Jenis, nomor, dan tanggal dokumen referensi wajib diisi dengan benar.';
  if (doc.kind === 'BPMP' && !String(doc.fields.jabatan ?? '').trim()) return 'Jabatan wajib diisi.';
  if (doc.kind === 'BPA2') {
    const start = Number(doc.fields.startMonth);
    if (!Number.isInteger(start) || start < 1 || start > doc.taxPeriodMonth || Number(doc.fields.startYear) !== doc.taxPeriodYear) return 'Periode BPA2 harus berada dalam satu tahun, dengan masa awal tidak melebihi masa akhir.';
    if (doc.fields.statusWithholding === 'Setahun Penuh' && (start !== 1 || doc.taxPeriodMonth !== 12)) return 'Status Setahun Penuh memerlukan periode Januari sampai Desember.';
    if (!String(doc.fields.nip ?? '').trim() || !String(doc.fields.golongan ?? '').trim() || !String(doc.fields.jabatan ?? '').trim()) return 'NIP/NRP, golongan, dan jabatan wajib diisi.';
    const values = [...Object.values((doc.fields.grossIncome ?? {}) as Record<string, number>), doc.fields.taxWithheld ?? 0, doc.fields.netIncomeFromPrevious ?? 0, doc.fields.withheldFromPrevious ?? 0, doc.fields.lastPeriodGross ?? 0];
    if (values.some((n) => typeof n !== 'number' || !Number.isFinite(n) || n < 0)) return 'Komponen penghasilan dan pemotongan tidak boleh negatif atau tidak valid.';
    if (Number(doc.fields.lastPeriodGross) > doc.gross) return 'Bruto masa terakhir tidak boleh melebihi bruto selama periode.';
  }
  return null;
}
