import type { BupotDoc, SptDoc, SptManualRows } from './types';

/**
 * Menghitung baris B/C pada Halaman Utama SPT Masa PPh Pasal 21, mengikuti
 * susunan slide 121-122. Baris 1 (jumlah dipotong) dijumlahkan otomatis dari
 * seluruh bupot berstatus ISSUED pada masa pajak yang sama; baris lain diisi
 * manual oleh pengguna atau dibawa dari SPT sebelumnya.
 */

const ARTICLE_21_KINDS = ['BPMP', 'BP21', 'BPA1'];
const ARTICLE_26_KINDS = ['BP26'];

function issuedBupotsFor(
  bupots: BupotDoc[],
  entityTin: string,
  month: number,
  year: number,
  kinds: string[],
): BupotDoc[] {
  return bupots.filter(
    (b) =>
      b.entityTin === entityTin &&
      b.status === 'ISSUED' &&
      b.taxPeriodMonth === month &&
      b.taxPeriodYear === year &&
      kinds.includes(b.kind),
  );
}

export function totalWithheld(bupots: BupotDoc[]): number {
  return bupots.reduce((sum, b) => sum + b.withheld, 0);
}

export interface ArticleSummaryRow {
  /** Nomor baris sesuai tabel di panduan. */
  no: number;
  uraian: string;
  kapKjs: string;
  jumlah: number;
  editableKey?: keyof SptManualRows;
}

/**
 * Menyusun 6 baris "Income Tax Withheld" plus 1 baris "Borne by Government",
 * persis urutan pada slide 121 (Pasal 21) dan 122 (Pasal 26).
 */
export function buildArticleSummary(
  spt: SptDoc,
  bupots: BupotDoc[],
  article: '21' | '26',
): { withheld: ArticleSummaryRow[]; borneByGovernment: ArticleSummaryRow[]; netPayable: number } {
  const kinds = article === '21' ? ARTICLE_21_KINDS : ARTICLE_26_KINDS;
  const kap = article === '21' ? '411121-100' : '411127-100';
  const relevant = issuedBupotsFor(bupots, spt.entityTin, spt.taxPeriodMonth, spt.taxPeriodYear, kinds);
  const manual = article === '21' ? spt.manualArticle21 : spt.manualArticle26;

  const grossWithheld = totalWithheld(relevant);
  const carryForward = 0; // Disederhanakan: kelebihan periode sebelumnya belum dilacak lintas SPT.
  const row4 = grossWithheld - carryForward - manual.sp2d;
  const row6 = spt.model === 'PEMBETULAN' ? row4 - manual.paidOnCorrectedReturn : 0;

  const withheld: ArticleSummaryRow[] = [
    { no: 1, uraian: `Pajak Penghasilan Pasal ${article} yang dilakukan pemotongan`, kapKjs: kap, jumlah: grossWithheld },
    { no: 2, uraian: 'Penyerahan kelebihan pembayaran dari periode pajak sebelumnya', kapKjs: '', jumlah: carryForward },
    {
      no: 3,
      uraian: 'Pembayaran dengan SP2D (hanya untuk instansi pemerintah)',
      kapKjs: '',
      jumlah: manual.sp2d,
      editableKey: 'sp2d',
    },
    { no: 4, uraian: 'Kurang bayar (lebih bayar) (1-2-3)', kapKjs: '', jumlah: row4 },
    {
      no: 5,
      uraian: 'Dibayar pada SPT yang diperbaiki',
      kapKjs: '',
      jumlah: manual.paidOnCorrectedReturn,
      editableKey: 'paidOnCorrectedReturn',
    },
    { no: 6, uraian: 'Kurang bayar (lebih bayar) akibat perbaikan (4-5)', kapKjs: '', jumlah: row6 },
  ];

  const borneByGovernment: ArticleSummaryRow[] = [
    {
      no: 1,
      uraian: `Pajak Penghasilan Pasal ${article} Ditanggung Pemerintah (DTP)`,
      kapKjs: kap,
      jumlah: manual.dtp,
      editableKey: 'dtp',
    },
  ];

  const netPayable = spt.model === 'PEMBETULAN' ? row6 : row4;
  return { withheld, borneByGovernment, netPayable: Math.max(netPayable, 0) };
}

export function totalNetPayable(spt: SptDoc, bupots: BupotDoc[]): number {
  const a21 = buildArticleSummary(spt, bupots, '21');
  const a26 = buildArticleSummary(spt, bupots, '26');
  return a21.netPayable + a26.netPayable;
}
