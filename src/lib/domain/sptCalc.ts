import type { BupotDoc, SptDoc, SptManualRows } from './types';

/**
 * Menghitung baris B/C pada Halaman Utama SPT Masa PPh Pasal 21, mengikuti
 * susunan slide 121-122. Baris 1 (jumlah dipotong) dijumlahkan otomatis dari
 * seluruh bupot berstatus ISSUED pada masa pajak yang sama; baris lain diisi
 * manual oleh pengguna atau dibawa dari SPT sebelumnya.
 */

const ARTICLE_21_KINDS = ['BPMP', 'BP21', 'BPA1', 'BPA2'];
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
  return bupots.reduce((sum, b) => {
    if (b.kind === 'BPA2') {
      const uo = Number(b.fields?.underOverPayment ?? 0);
      return sum + uo;
    }
    return sum + b.withheld;
  }, 0);
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
  priorSpts: SptDoc[] = [],
): { withheld: ArticleSummaryRow[]; borneByGovernment: ArticleSummaryRow[]; netPayable: number; balance: number } {
  const kinds = article === '21' ? ARTICLE_21_KINDS : ARTICLE_26_KINDS;
  const kap = article === '21' ? '411121-100' : '411127-100';
  const relevant = issuedBupotsFor(bupots, spt.entityTin, spt.taxPeriodMonth, spt.taxPeriodYear, kinds);
  const manual = article === '21' ? spt.manualArticle21 : spt.manualArticle26;

  let grossWithheld = totalWithheld(relevant);

  // Jika ada SPT sebelumnya yang dilaporkan, cari kompensasi lebih bayar
  let carryForward = 0;
  if (priorSpts && priorSpts.length > 0) {
    const sorted = [...priorSpts].sort((a, b) => a.taxPeriodMonth - b.taxPeriodMonth);
    // Cari SPT dilaporkan paling akhir sebelum periode berjalan
    const earlier = sorted.filter(
      (p) => p.status === 'DILAPORKAN' && p.taxPeriodMonth < spt.taxPeriodMonth
    );
    if (earlier.length > 0) {
      const prev = earlier[earlier.length - 1];
      const snapCarry = (prev as any).snapshot?.carry21;
      const sumPrev = buildArticleSummary(prev, (prev as any).snapshot?.bupots ?? [], article);
      if (snapCarry !== undefined && snapCarry > 0) {
        carryForward = snapCarry - totalWithheld((prev as any).snapshot?.bupots ?? []);
      } else if (sumPrev.balance < 0) {
        carryForward = Math.abs(sumPrev.balance);
      }
    }
  }

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

  if (spt.status === 'DILAPORKAN' && (spt as any).snapshot?.bupots) {
    const snapSummary = buildArticleSummary({ ...spt, status: 'KONSEP' }, (spt as any).snapshot.bupots, article, priorSpts);
    return { withheld, borneByGovernment, netPayable: 0, balance: snapSummary.balance };
  }

  return { withheld, borneByGovernment, netPayable: Math.max(netPayable, 0), balance: row4 };
}

export function totalNetPayable(spt: SptDoc, bupots: BupotDoc[]): number {
  const a21 = buildArticleSummary(spt, bupots, '21');
  const a26 = buildArticleSummary(spt, bupots, '26');
  return a21.netPayable + a26.netPayable;
}

/**
 * Ringkasan Induk SPT Masa PPh Unifikasi (Halaman Utama bagian B, slide
 * 21-22): dikelompokkan per Article (4 Section 2/15/22/23/26), masing-masing
 * dipecah per KAP-KJS. Kolom "Withholding" dijumlahkan dari BPPU berstatus
 * ISSUED pada masa pajak yang sama (persis pola Pasal 21/26 di atas); kolom
 * "Self Payment" dijumlahkan dari Daftar-II (`daftarIISendiri` +
 * `daftarIIKumulatif`) berdasarkan kode objek pajak yang sama.
 *
 * PENTING: kolom "Income Tax Borne by Government" dan "Amount of Income Tax
 * Paid (From Previous Return)" pada slide 21-22 BELUM dihitung di sini —
 * ditandai 0 apa adanya, bukan tebakan, sesuai instruksi untuk menandai
 * bagian yang belum dapat diverifikasi alih-alih mengarang rumusnya.
 */
export interface UnifikasiKjsRow {
  kapKjs: string;
  selfPayment: number;
  withholding: number;
}
export interface UnifikasiArticleGroup {
  article: string;
  rows: UnifikasiKjsRow[];
  subtotal: number;
}

const BPPU_ARTICLE_KAP: { article: string; kaps: string[] }[] = [
  { article: 'Article 4 Section 2', kaps: ['411128-100', '411128-402', '411128-403'] },
  { article: 'Article 15', kaps: ['411128-600', '411129-600'] },
  { article: 'Article 22', kaps: ['411122-100', '411122-900', '411122-910'] },
  { article: 'Article 23', kaps: ['411124-100'] },
  { article: 'Article 26', kaps: ['411127-110'] },
];

export function buildUnifikasiSummary(spt: SptDoc, bupots: BupotDoc[]): {
  groups: UnifikasiArticleGroup[];
  totalWithholding: number;
  totalSelfPayment: number;
  grandTotal: number;
} {
  const issued = bupots.filter(
    (b) => b.kind === 'BPPU' && b.status === 'ISSUED'
      && b.entityTin === spt.entityTin
      && b.taxPeriodMonth === spt.taxPeriodMonth
      && b.taxPeriodYear === spt.taxPeriodYear,
  );
  const selfRows = [...(spt.daftarIISendiri ?? []), ...(spt.daftarIIKumulatif ?? [])];

  const groups: UnifikasiArticleGroup[] = BPPU_ARTICLE_KAP.map(({ article, kaps }) => {
    const rows = kaps.map((kapKjs) => ({
      kapKjs,
      withholding: issued.filter((b) => String(b.fields.kap ?? '') === kapKjs).reduce((s, b) => s + b.withheld, 0),
      selfPayment: selfRows.filter((r) => r.kodeObjekPajak === kapKjs).reduce((s, r) => s + r.pph, 0),
    }));
    return { article, rows, subtotal: rows.reduce((s, r) => s + r.withholding + r.selfPayment, 0) };
  });

  const totalWithholding = groups.reduce((s, g) => s + g.rows.reduce((x, r) => x + r.withholding, 0), 0);
  const totalSelfPayment = groups.reduce((s, g) => s + g.rows.reduce((x, r) => x + r.selfPayment, 0), 0);
  return { groups, totalWithholding, totalSelfPayment, grandTotal: totalWithholding + totalSelfPayment };
}

export function periodGross(bupot: BupotDoc, all: BupotDoc[]): number {
  if (bupot.kind !== 'BPA2') {
    return bupot.gross;
  }

  if (bupot.fields?.lastPeriodGross !== undefined) {
    return Number(bupot.fields.lastPeriodGross);
  }

  const startMonth = Number(bupot.fields.startMonth ?? bupot.taxPeriodMonth);
  const startYear = Number(bupot.fields.startYear ?? bupot.taxPeriodYear);

  const sameRecipient = all.filter(
    (b) =>
      b.entityTin === bupot.entityTin &&
      b.counterpartTin === bupot.counterpartTin &&
      b.kind !== 'BPA2' &&
      b.status === 'ISSUED',
  );

  const periodRows = sameRecipient.filter((b) => {
    const value = b.taxPeriodYear * 12 + b.taxPeriodMonth;
    const start = startYear * 12 + startMonth;
    const end = bupot.taxPeriodYear * 12 + bupot.taxPeriodMonth;

    return value >= start && value <= end;
  });

  return periodRows.reduce((sum, b) => sum + b.gross, 0);
}

export function periodWithheld(bupot: BupotDoc): number {
  if (bupot.kind !== 'BPA2') {
    return bupot.withheld;
  }

  if (bupot.fields?.underOverPayment !== undefined) {
    return Number(bupot.fields.underOverPayment);
  }

  const taxLiability = Number(
    bupot.fields.taxLiability ??
    bupot.fields.article21TaxLiabilityInThisSlip ??
    bupot.withheld ??
    0,
  );

  const taxWithheld = Number(
    bupot.fields.taxWithheld ??
    bupot.fields.article21TaxWithheld ??
    0,
  );

  return taxLiability - taxWithheld;
}