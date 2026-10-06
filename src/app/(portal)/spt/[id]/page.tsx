'use client';

import { Fragment, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDb } from '@/lib/storage/useDb';
import { SignDialog } from '@/components/ui/SignDialog';
import { buildArticleSummary, buildUnifikasiSummary, totalNetPayable, type ArticleSummaryRow } from '@/lib/domain/sptCalc';
import type { CertificateProvider, DaftarIISetorSendiriRow, SptDoc, SptManualRows } from '@/lib/domain/types';
import type { Database } from '@/lib/storage/db';
import { canDraftSpt, canSignSpt, explainDeniedSpt } from '@/lib/auth/access';
import { BPPU_ARTICLE_LABEL } from '@/lib/domain/bppu';

/**
 * Halaman isi SPT Masa PPh Pasal 21/26. Lima tab dan susunan bagian mengikuti
 * slide 120-137 apa adanya: Halaman Utama (Induk, Identitas Pemotong, Article
 * 21/26 Income Tax, Declaration and Signature), lalu L-IA, L-IB, L-II, L-III.
 *
 * Role Akses dipisah dua: SPT_21_DRAFTER mengisi angka manual (SP2D/DTP/dst)
 * pada bagian B & C, sementara SPT_21_SIGNER yang mengisi Deklarasi dan
 * menekan tombol Bayar dan Lapor — meniru pembagian tugas penyiap vs
 * penandatangan dokumen di Coretax asli.
 */

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

type TabKey = 'UTAMA' | 'L-IA' | 'L-IB' | 'L-II' | 'L-III';
const TABS: TabKey[] = ['UTAMA', 'L-IA', 'L-IB', 'L-II', 'L-III'];

const rupiah = (n: number) => n.toLocaleString('id-ID');

export default function SptEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { db, mutate } = useDb();
  const [tab, setTab] = useState<TabKey>('UTAMA');
  const [signing, setSigning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const spt = db.spts.find((s) => s.id === id);
  const entity = spt ? db.entities.find((e) => e.tin === spt.entityTin) : null;
  const bupots = db.bupots;

  const a21 = useMemo(() => (spt ? buildArticleSummary(spt, bupots, '21') : null), [spt, bupots]);
  const a26 = useMemo(() => (spt ? buildArticleSummary(spt, bupots, '26') : null), [spt, bupots]);
  const net = spt ? totalNetPayable(spt, bupots) : 0;

  if (!spt) {
    return (
      <p className="rounded-card bg-white p-5 text-sm shadow-card">
        SPT tidak ditemukan. Mungkin sudah dihapus dari daftar Konsep SPT.
      </p>
    );
  }

  const canDraftSptRole = canDraftSpt(db.roleAssignments, db.session!, spt.kind, db.relatedParties);
  const canSignSptRole = canSignSpt(db.roleAssignments, db.session!, spt.kind, db.relatedParties);

  if (spt.entityTin !== db.session?.impersonatingTin || (!canDraftSptRole && !canSignSptRole)) {
    return (
      <p className="rounded-card bg-white p-5 text-sm shadow-card">
        {explainDeniedSpt('draft', spt.kind)}
      </p>
    );
  }

  if (spt.kind === 'PPH_UNIFIKASI') {
    return (
      <UnifikasiSptView
        spt={spt}
        db={db}
        mutate={mutate}
        router={router}
        canDraftSptRole={canDraftSptRole}
        canSignSptRole={canSignSptRole}
      />
    );
  }

  const isKonsep = spt.status === 'KONSEP';
  /** Angka manual (baris B/C) diisi oleh Drafter. */
  const editable = isKonsep && canDraftSptRole;
  /** Kotak Pernyataan & nama penandatangan diisi oleh Signer, persis sebelum menandatangani. */
  const declarationEditable = isKonsep && canSignSptRole;
  const bpmpRows = bupots.filter(
    (b) => b.entityTin === spt.entityTin && b.kind === 'BPMP' && b.status === 'ISSUED'
      && b.taxPeriodMonth === spt.taxPeriodMonth && b.taxPeriodYear === spt.taxPeriodYear,
  );
  const isLastPeriod = spt.taxPeriodMonth === 12;

  function setManual(article: '21' | '26', key: keyof SptManualRows, value: number) {
    mutate((d) => {
      const s = d.spts.find((x) => x.id === id);
      if (!s) return;
      const target = article === '21' ? s.manualArticle21 : s.manualArticle26;
      target[key] = value;
    });
  }

  function saveDraft() {
    if (!canDraftSptRole) return;
    setNotice('Konsep SPT tersimpan.');
  }

  function submit(password: string, provider: CertificateProvider) {
    if (!password || !canSignSptRole) return;
    mutate((d) => {
      const s = d.spts.find((x) => x.id === id);
      if (!s) return;
      s.signature = { provider, signerNik: d.session!.personNik, signedAt: new Date().toISOString() };
      if (net > 0) {
        s.status = 'MENUNGGU_PEMBAYARAN';
        const created = new Date();
        const expires = new Date(created.getTime() + 48 * 3600 * 1000);
        s.billing = {
          kodeBilling: String(Math.floor(1_000_000_000_000_000 + Math.random() * 9_000_000_000_000_000)),
          kapKjs: '411121-100',
          masaPajak: `${String(s.taxPeriodMonth).padStart(2, '0')}-${s.taxPeriodYear}`,
          nominal: net,
          createdAt: created.toISOString(),
          expiresAt: expires.toISOString(),
        };
      } else {
        s.status = 'DILAPORKAN';
        s.submittedAt = new Date().toISOString();
      }
    });
    setSigning(false);
    setNotice(
      net > 0
        ? 'Dokumen berhasil ditandatangani. Kode billing telah terbit — selesaikan pembayaran pada tab SPT Menunggu Pembayaran.'
        : 'Dokumen berhasil ditandatangani. SPT nihil ini langsung tercatat sebagai Dilaporkan.',
    );
  }

  function pay() {
    if (!canSignSptRole) return;
    mutate((d) => {
      const s = d.spts.find((x) => x.id === id);
      if (!s) return;
      s.status = 'DILAPORKAN';
      s.submittedAt = new Date().toISOString();
    });
    setNotice('Pembayaran tercatat. SPT otomatis tersampaikan tanpa perlu input NTPN.');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button className="text-[13px] text-brand-600 hover:underline" onClick={() => router.push('/spt')}>
          ← Kembali ke daftar SPT
        </button>
      </div>

      <section className="rounded-card bg-white p-4 shadow-card">
        <h1 className="text-lg font-semibold">PEMOTONGAN PPH PASAL 21 DAN/ATAU PASAL 26</h1>

        <nav className="mt-3 flex gap-4 border-b border-line text-[13px]">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-1 pb-2 ${
                tab === t ? 'border-brand-500 font-semibold text-brand-700' : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {t === 'UTAMA' ? 'Halaman Utama' : t}
            </button>
          ))}
        </nav>

        {notice && (
          <p className="mt-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-[13px] text-brand-800">
            {notice}
          </p>
        )}

        {tab === 'UTAMA' && a21 && a26 && (
          <div className="mt-4 space-y-4">
            <Section title="Induk">
              <div className="grid gap-3 sm:grid-cols-3">
                <ReadField label="Periode Pajak Bulan" value={String(spt.taxPeriodMonth)} />
                <ReadField label="Periode Pajak Tahun" value={String(spt.taxPeriodYear)} />
                <ReadField label="Status" value={spt.model === 'NORMAL' ? 'Normal' : `Pembetulan ke-${spt.pembetulanKe}`} />
              </div>
            </Section>

            <Section title="A. Identitas Pemotong">
              <div className="grid gap-3 sm:grid-cols-2">
                <ReadField label="1. NPWP" value={entity?.tin ?? '-'} mono />
                <ReadField label="2. Nama" value={entity?.name ?? '-'} />
                <ReadField label="3. Alamat" value={entity?.address ?? '-'} />
              </div>
            </Section>

            <Section title="B. Article 21 Income Tax">
              <ArticleTable
                title="I. Article 21 Income Tax Withheld"
                rows={a21.withheld}
                editable={editable}
                onChange={(key, value) => setManual('21', key, value)}
              />
              <ArticleTable
                title="II. Article 21 Income Tax Borne by Government"
                rows={a21.borneByGovernment}
                editable={editable}
                onChange={(key, value) => setManual('21', key, value)}
              />
            </Section>

            <Section title="C. Article 26 Income Tax">
              <ArticleTable
                title="I. Article 26 Income Tax Withheld"
                rows={a26.withheld}
                editable={editable}
                onChange={(key, value) => setManual('26', key, value)}
              />
              <ArticleTable
                title="II. Article 26 Income Tax Borne by Government"
                rows={a26.borneByGovernment}
                editable={editable}
                onChange={(key, value) => setManual('26', key, value)}
              />
            </Section>

            <div className="rounded-md border border-line bg-canvas px-3 py-2 text-right text-[13px] font-semibold">
              Total PPh Kurang Bayar: Rp {rupiah(net)}
            </div>

            {spt.status === 'MENUNGGU_PEMBAYARAN' && spt.billing && (
              <BillingCard billing={spt.billing} onPay={pay} disabled={!canSignSptRole} />
            )}

            <Section title="D. Declaration and Signature">
              {declarationEditable ? (
                <DeclarationForm
                  spt={spt}
                  personName={db.session!.personName}
                  onChange={(patch) => mutate((d) => {
                    const s = d.spts.find((x) => x.id === id);
                    if (s) Object.assign(s.declaration, patch);
                  })}
                />
              ) : (
                <div className="grid gap-2 text-[13px] sm:grid-cols-3">
                  <ReadField label="Ditandatangani oleh" value={spt.declaration.signedAs === 'TAXPAYER' ? 'Taxpayer' : 'Representative'} />
                  <ReadField label="Nama" value={spt.declaration.signerName} />
                  <ReadField label="Ditandatangani pada" value={spt.signature ? new Date(spt.signature.signedAt).toLocaleString('id-ID') : '-'} />
                </div>
              )}

              {isKonsep && (
                <div className="mt-4 flex gap-2">
                  <button
                    className="btn-secondary"
                    onClick={saveDraft}
                    disabled={!canDraftSptRole}
                    title={!canDraftSptRole ? explainDeniedSpt('draft', spt.kind) : undefined}
                  >
                    Simpan Konsep
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => setSigning(true)}
                    disabled={!canSignSptRole || !spt.declaration.agreed || !spt.declaration.signerName}
                    title={!canSignSptRole ? explainDeniedSpt('sign', spt.kind) : undefined}
                  >
                    Bayar dan Lapor
                  </button>
                </div>
              )}
            </Section>
          </div>
        )}

        {tab === 'L-IA' && (
          <LampiranBulanan
            judul="Daftar Pemotongan Bulanan PPh Pasal 21 bagi Pegawai Tetap dan Pensiunan yang Menerima Uang Terkait Pensiun secara Berkala serta bagi PNS, TNI, Polri, Pejabat Negara, dan Pensiunannya"
            entityTin={spt.entityTin}
            month={spt.taxPeriodMonth}
            year={spt.taxPeriodYear}
            rows={bpmpRows}
          />
        )}

        {tab === 'L-IB' && (
          <>
            {!isLastPeriod && (
              <p className="mt-4 rounded-md border border-line bg-canvas px-3 py-2 text-[13px] text-ink-muted">
                Lampiran ini hanya diisi untuk SPT Masa pajak terakhir (Desember).
              </p>
            )}
            <LampiranBulanan
              judul="Daftar Pemotongan PPh Pasal 21 bagi Pegawai Tetap dan Pensiunan untuk Masa Pajak Terakhir"
              entityTin={spt.entityTin}
              month={spt.taxPeriodMonth}
              year={spt.taxPeriodYear}
              rows={isLastPeriod ? bpmpRows : []}
            />
          </>
        )}

        {tab === 'L-II' && (
          <LampiranTahunan entityTin={spt.entityTin} year={spt.taxPeriodYear} bupots={bupots} />
        )}

        {tab === 'L-III' && (
          <LampiranSelainPegawaiTetap
            entityTin={spt.entityTin}
            month={spt.taxPeriodMonth}
            year={spt.taxPeriodYear}
            bupots={bupots}
          />
        )}
      </section>

      {signing && (
        <SignDialog
          signerNik={db.session!.personNik}
          credential={db.mainAccountProfile?.signingCredential ?? null}
          onCancel={() => setSigning(false)}
          onConfirm={submit}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ komponen kecil */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line">
      <p className="border-b border-line bg-brand-50 px-3 py-2 text-[13px] font-semibold text-brand-800">
        {title}
      </p>
      <div className="p-3">{children}</div>
    </div>
  );
}

function ReadField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <output className={`field-input block bg-canvas ${mono ? 'font-mono' : ''}`}>{value}</output>
    </div>
  );
}

function ArticleTable({
  title,
  rows,
  editable,
  onChange,
}: {
  title: string;
  rows: ArticleSummaryRow[];
  editable: boolean;
  onChange: (key: keyof SptManualRows, value: number) => void;
}) {
  return (
    <div className="mt-3">
      <p className="text-[13px] font-medium text-ink-muted">{title}</p>
      <table className="data-table mt-1">
        <thead>
          <tr>
            <th className="w-10">No</th>
            <th>Uraian</th>
            <th>KAP-KJS</th>
            <th className="w-40 text-right">Jumlah (Rp)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.no}>
              <td>{r.no}</td>
              <td>{r.uraian}</td>
              <td className="font-mono text-xxs">{r.kapKjs}</td>
              <td className="text-right">
                {editable && r.editableKey ? (
                  <input
                    type="number"
                    className="field-input py-1 text-right"
                    value={r.jumlah}
                    onChange={(e) => onChange(r.editableKey!, +e.target.value)}
                  />
                ) : (
                  rupiah(r.jumlah)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeclarationForm({
  spt,
  personName,
  onChange,
}: {
  spt: { declaration: { agreed: boolean; signedAs: 'TAXPAYER' | 'REPRESENTATIVE'; signerName: string } };
  personName: string;
  onChange: (patch: Partial<{ agreed: boolean; signedAs: 'TAXPAYER' | 'REPRESENTATIVE'; signerName: string }>) => void;
}) {
  return (
    <div className="space-y-3 text-[13px]">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={spt.declaration.agreed}
          onChange={(e) => onChange({ agreed: e.target.checked })}
        />
        Dengan menyadari sepenuhnya akan segala akibatnya termasuk sanksi-sanksi sesuai dengan ketentuan
        perundang-undangan yang berlaku, saya menyatakan bahwa apa yang telah saya beritahukan di atas
        beserta lampiran-lampirannya adalah benar, lengkap, dan jelas.
      </label>

      <div>
        <p className="field-label">Ditandatangani oleh</p>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={spt.declaration.signedAs === 'TAXPAYER'}
              onChange={() => onChange({ signedAs: 'TAXPAYER', signerName: personName })}
            />
            Taxpayer
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={spt.declaration.signedAs === 'REPRESENTATIVE'}
              onChange={() => onChange({ signedAs: 'REPRESENTATIVE' })}
            />
            Representative
          </label>
        </div>
      </div>

      <div className="max-w-sm">
        <label className="field-label" htmlFor="signer-name">Nama</label>
        <input
          id="signer-name"
          className="field-input"
          value={spt.declaration.signerName}
          onChange={(e) => onChange({ signerName: e.target.value })}
          placeholder={spt.declaration.signedAs === 'TAXPAYER' ? personName : 'Nama kuasa/wakil'}
        />
      </div>
    </div>
  );
}

function BillingCard({
  billing,
  onPay,
  disabled,
}: {
  billing: { kodeBilling: string; kapKjs: string; masaPajak: string; nominal: number; expiresAt: string };
  onPay: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-md border border-accent bg-[#FFF8E6] p-4">
      <p className="text-[13px] font-semibold text-ink">Kode Billing</p>
      <p className="mt-1 font-mono text-lg tracking-wider">{billing.kodeBilling}</p>
      <div className="mt-2 grid gap-1 text-[13px] text-ink-muted sm:grid-cols-3">
        <span>KAP-KJS: {billing.kapKjs}</span>
        <span>Masa Pajak: {billing.masaPajak}</span>
        <span>Nominal: Rp {rupiah(billing.nominal)}</span>
      </div>
      <p className="mt-1 text-xxs text-ink-muted">
        Berlaku sampai {new Date(billing.expiresAt).toLocaleString('id-ID')}
      </p>
      <button className="btn-primary mt-3" onClick={onPay} disabled={disabled}>
        Simulasikan Pembayaran
      </button>
      <p className="mt-1 text-xxs text-ink-muted">
        Di Coretax, pembayaran nyata dilakukan lewat bank/pos dan status berubah otomatis tanpa input NTPN.
        Tombol ini menyingkat langkah tersebut untuk keperluan praktikum.
      </p>
    </div>
  );
}

function LampiranBulanan({
  judul,
  entityTin,
  month,
  year,
  rows,
}: {
  judul: string;
  entityTin: string;
  month: number;
  year: number;
  rows: { id: string; counterpartTin: string; counterpartName: string; withholdingNumber: string | null; taxObjectCode: string; gross: number; withheld: number; createdAt: string }[];
}) {
  return (
    <div className="mt-4">
      <p className="text-[13px] font-medium text-ink-muted">{judul.toUpperCase()}</p>
      <Section title="Induk">
        <div className="grid gap-3 sm:grid-cols-2">
          <ReadField label="NPWP" value={entityTin} mono />
          <ReadField label="Masa Pajak (MM-YYYY)" value={`${String(month).padStart(2, '0')}-${year}`} />
        </div>
      </Section>

      <p className="mt-3 text-[13px] font-medium">LIST-IA</p>
      <table className="data-table mt-1">
        <thead>
          <tr>
            <th>No</th>
            <th>NIK/NPWP</th>
            <th>Nama</th>
            <th>Nomor Bukti Pemotongan</th>
            <th>Tanggal Bukti Pemotongan</th>
            <th>Kode Objek Pajak</th>
            <th className="text-right">Penghasilan Bruto (Rp)</th>
            <th className="text-right">Pajak Penghasilan (Rp)</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={8} className="py-6 text-center text-ink-muted">Tidak ada data yang ditemukan.</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td>{i + 1}</td>
              <td className="font-mono">{r.counterpartTin}</td>
              <td>{r.counterpartName}</td>
              <td className="font-mono">{r.withholdingNumber}</td>
              <td>{new Date(r.createdAt).toLocaleDateString('id-ID').replace(/\//g, '-')}</td>
              <td className="font-mono">{r.taxObjectCode}</td>
              <td className="text-right">{rupiah(r.gross)}</td>
              <td className="text-right">{rupiah(r.withheld)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LampiranTahunan({
  entityTin,
  year,
  bupots,
}: {
  entityTin: string;
  year: number;
  bupots: { id: string; kind: string; entityTin: string; status: string; taxPeriodYear: number; counterpartTin: string; counterpartName: string; withholdingNumber: string | null; gross: number; withheld: number }[];
}) {
  const [sub, setSub] = useState<'BPA1' | 'BPA2'>('BPA1');
  const rows = bupots.filter(
    (b) => b.entityTin === entityTin && b.status === 'ISSUED' && b.kind === sub && b.taxPeriodYear === year,
  );

  return (
    <div className="mt-4">
      <p className="text-[13px] font-medium text-ink-muted">
        DAFTAR PEMOTONGAN SATU TAHUN PAJAK ATAU BAGIAN TAHUN PAJAK PPH PASAL 21 BAGI PEGAWAI TETAP DAN PENSIUNAN
      </p>
      <div className="mt-3 flex gap-1 border-b border-line">
        {(['BPA1', 'BPA2'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSub(s)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-[13px] ${
              sub === s ? 'border-brand-500 font-semibold text-brand-700' : 'border-transparent text-ink-muted'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <table className="data-table mt-2">
        <thead>
          <tr>
            <th>NIK/NPWP</th>
            <th>Nama</th>
            <th>Nomor Bukti Pemotongan</th>
            <th className="text-right">Bruto</th>
            <th className="text-right">PPh Dipotong</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={5} className="py-6 text-center text-ink-muted">Tidak ada data yang ditemukan.</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="font-mono">{r.counterpartTin}</td>
              <td>{r.counterpartName}</td>
              <td className="font-mono">{r.withholdingNumber}</td>
              <td className="text-right">{rupiah(r.gross)}</td>
              <td className="text-right">{rupiah(r.withheld)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sub === 'BPA1' && (
        <p className="mt-2 text-xxs text-ink-muted">
          BPA1 berisi data mengenai daftar bukti potong 1721-A1. Modul pembuatan BPA1 disiapkan pada
          tahap pengembangan berikutnya.
        </p>
      )}
    </div>
  );
}

function LampiranSelainPegawaiTetap({
  entityTin,
  month,
  year,
  bupots,
}: {
  entityTin: string;
  month: number;
  year: number;
  bupots: { id: string; kind: string; entityTin: string; status: string; taxPeriodMonth: number; taxPeriodYear: number; counterpartTin: string; counterpartName: string; withholdingNumber: string | null; taxObjectCode: string; gross: number; withheld: number; createdAt: string }[];
}) {
  const [sub, setSub] = useState<'BP21' | 'BP26'>('BP21');
  const rows = bupots.filter(
    (b) => b.entityTin === entityTin && b.status === 'ISSUED' && b.kind === sub
      && b.taxPeriodMonth === month && b.taxPeriodYear === year,
  );

  return (
    <div className="mt-4">
      <p className="text-[13px] font-medium text-ink-muted">
        DAFTAR PEMOTONGAN PPH PASAL 21/26 SELAIN PEGAWAI TETAP ATAU PENSIUNAN YANG MENERIMA UANG TERKAIT PENSIUN SECARA BERKALA
      </p>
      <div className="mt-3 flex gap-1 border-b border-line">
        {(['BP21', 'BP26'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSub(s)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-[13px] ${
              sub === s ? 'border-brand-500 font-semibold text-brand-700' : 'border-transparent text-ink-muted'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <table className="data-table mt-2">
        <thead>
          <tr>
            <th>NIK/NPWP</th>
            <th>Nama</th>
            <th>Jenis Pajak</th>
            <th>Nomor Bukti Pemotongan</th>
            <th>Tanggal Bukti Pemotongan</th>
            <th>Kode Objek Pajak</th>
            <th className="text-right">Penghasilan Bruto (Rp)</th>
            <th className="text-right">Pajak Penghasilan (Rp)</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={5} className="py-6 text-center text-ink-muted">Tidak ada data yang ditemukan.</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="font-mono">{r.counterpartTin}</td>
              <td>{r.counterpartName}</td>
              <td className="font-mono">{r.withholdingNumber}</td>
              <td className="text-right">{rupiah(r.gross)}</td>
              <td className="text-right">{rupiah(r.withheld)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xxs text-ink-muted">
        Pada bagian ini ditampilkan data bukti pemotongan {sub === 'BP21' ? 'PPh Pasal 21' : 'PPh Pasal 26'} kepada
        selain pegawai tetap. Modul pembuatan {sub} disiapkan pada tahap pengembangan berikutnya.
      </p>
    </div>
  );
}

type UnifikasiTab = 'UTAMA' | 'DAFTAR-I' | 'DAFTAR-II' | 'LAMPIRAN-I';
const UNIF_TABS: { key: UnifikasiTab; label: string }[] = [
  { key: 'UTAMA', label: 'SPT Masa PPh Unifikasi' },
  { key: 'DAFTAR-I', label: 'DAFTAR-I' },
  { key: 'DAFTAR-II', label: 'DAFTAR-II' },
  { key: 'LAMPIRAN-I', label: 'LAMPIRAN-I' },
];

/**
 * SPT Masa PPh Unifikasi — slide 15-27 "E-Bupot Unifikasi". Dirender sebagai
 * cabang terpisah dari komponen utama (bukan halaman baru — URL /spt/[id]
 * tetap sama), karena strukturnya jauh berbeda dari Pasal 21/26: 4 tab
 * (SPT Masa PPh Unifikasi / DAFTAR-I / DAFTAR-II / LAMPIRAN-I), bukan
 * UTAMA/L-IA/L-IB/L-II/L-III.
 */
function UnifikasiSptView({
  spt,
  db,
  mutate,
  router,
  canDraftSptRole,
  canSignSptRole,
}: {
  spt: SptDoc;
  db: Database;
  mutate: (fn: (d: Database) => void) => void;
  router: ReturnType<typeof useRouter>;
  canDraftSptRole: boolean;
  canSignSptRole: boolean;
}) {
  const [tab, setTab] = useState<UnifikasiTab>('UTAMA');
  const [signing, setSigning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const entity = db.entities.find((e) => e.tin === spt.entityTin);
  const summary = useMemo(() => buildUnifikasiSummary(spt, db.bupots), [spt, db.bupots]);
  const isKonsep = spt.status === 'KONSEP';
  const editable = isKonsep && canDraftSptRole;
  const declarationEditable = isKonsep && canSignSptRole;
  const net = summary.grandTotal;

  function saveField(patch: Partial<SptDoc>) {
    mutate((d) => {
      const s = d.spts.find((x) => x.id === spt.id);
      if (s) Object.assign(s, patch);
    });
  }

  function addDaftarIIRow(table: 'daftarIISendiri' | 'daftarIIKumulatif') {
    if (!editable) return;
    const row: DaftarIISetorSendiriRow = {
      id: crypto.randomUUID(), jenisPajak: '', kodeObjekPajak: '', objekPajak: '',
      dpp: 0, tarif: 0, pph: 0, fasilitas: 'Tanpa Fasilitas',
    };
    mutate((d) => {
      const s = d.spts.find((x) => x.id === spt.id);
      if (s) s[table] = [...s[table], row];
    });
  }

  function updateDaftarIIRow(table: 'daftarIISendiri' | 'daftarIIKumulatif', rowId: string, patch: Partial<DaftarIISetorSendiriRow>) {
    mutate((d) => {
      const s = d.spts.find((x) => x.id === spt.id);
      if (!s) return;
      s[table] = s[table].map((r) => {
        if (r.id !== rowId) return r;
        const next = { ...r, ...patch };
        next.pph = Math.floor((next.dpp * next.tarif) / 100);
        return next;
      });
    });
  }

  function removeDaftarIIRow(table: 'daftarIISendiri' | 'daftarIIKumulatif', rowId: string) {
    if (!editable) return;
    mutate((d) => {
      const s = d.spts.find((x) => x.id === spt.id);
      if (s) s[table] = s[table].filter((r) => r.id !== rowId);
    });
  }

  function saveDraft() {
    if (!canDraftSptRole) return;
    setNotice('Konsep SPT tersimpan.');
  }

  function submit(password: string, provider: CertificateProvider) {
    if (!password || !canSignSptRole) return;
    mutate((d) => {
      const s = d.spts.find((x) => x.id === spt.id);
      if (!s) return;
      s.signature = { provider, signerNik: d.session!.personNik, signedAt: new Date().toISOString() };
      if (net > 0) {
        s.status = 'MENUNGGU_PEMBAYARAN';
        const created = new Date();
        const expires = new Date(created.getTime() + 48 * 3600 * 1000);
        s.billing = {
          kodeBilling: String(Math.floor(1_000_000_000_000_000 + Math.random() * 9_000_000_000_000_000)),
          kapKjs: '411121-100',
          masaPajak: `${String(s.taxPeriodMonth).padStart(2, '0')}-${s.taxPeriodYear}`,
          nominal: net,
          createdAt: created.toISOString(),
          expiresAt: expires.toISOString(),
        };
      } else {
        s.status = 'DILAPORKAN';
        s.submittedAt = new Date().toISOString();
      }
    });
    setSigning(false);
    setNotice(
      net > 0
        ? 'Dokumen berhasil ditandatangani. Kode billing telah terbit — selesaikan pembayaran pada tab SPT Menunggu Pembayaran.'
        : 'Dokumen berhasil ditandatangani. SPT nihil ini langsung tercatat sebagai Dilaporkan.',
    );
  }

  function pay() {
    if (!canSignSptRole) return;
    mutate((d) => {
      const s = d.spts.find((x) => x.id === spt.id);
      if (!s) return;
      s.status = 'DILAPORKAN';
      s.submittedAt = new Date().toISOString();
    });
    setNotice('Pembayaran tercatat. SPT otomatis tersampaikan tanpa perlu input NTPN.');
  }

  const daftarIRows = db.bupots.filter(
    (b) => b.kind === 'BPPU' && b.status === 'ISSUED'
      && b.entityTin === spt.entityTin
      && b.taxPeriodMonth === spt.taxPeriodMonth
      && b.taxPeriodYear === spt.taxPeriodYear,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button className="text-[13px] text-brand-600 hover:underline" onClick={() => router.push('/spt')}>
          ← Kembali ke daftar SPT
        </button>
      </div>

      <section className="rounded-card bg-white p-4 shadow-card">
        <h1 className="font-semibold">SPT MASA PPH UNIFIKASI</h1>
        <div className="mt-3 flex gap-1 border-b border-line text-[13px]">
          {UNIF_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-3 py-2 ${tab === t.key ? 'border-brand-600 font-semibold text-brand-700' : 'border-transparent text-ink-muted'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {notice && (
          <p className="mt-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-[13px] text-brand-800">
            {notice}
          </p>
        )}

        {tab === 'UTAMA' && (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-[13px] font-semibold text-ink-muted">A. Identitas Pemotong</p>
              <dl className="mt-2 grid grid-cols-2 gap-y-1 text-[13px] sm:grid-cols-4">
                <dt className="text-ink-muted">Periode Pajak</dt>
                <dd>{String(spt.taxPeriodMonth).padStart(2, '0')}/{spt.taxPeriodYear}</dd>
                <dt className="text-ink-muted">NPWP/NIK</dt><dd className="font-mono">{spt.entityTin}</dd>
                <dt className="text-ink-muted">Nama Lengkap</dt><dd>{entity?.name ?? '—'}</dd>
                <dt className="text-ink-muted">Alamat</dt><dd>{entity?.address ?? '—'}</dd>
              </dl>
            </div>

            <div>
              <p className="text-[13px] font-semibold text-ink-muted">B. Pajak Penghasilan</p>
              <div className="mt-2 overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Uraian</th>
                      <th className="text-right">Self Payment (Rp)</th>
                      <th className="text-right">Withholding (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.groups.map((g) => (
                      <Fragment key={g.article}>
                        <tr>
                          <td className="font-semibold">{g.article}</td>
                          <td />
                          <td />
                        </tr>
                        {g.rows.map((r) => (
                          <tr key={r.kapKjs}>
                            <td className="pl-4 text-xxs text-ink-muted">KJS:{r.kapKjs}</td>
                            <td className="text-right">{rupiah(r.selfPayment)}</td>
                            <td className="text-right">{rupiah(r.withholding)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                    <tr className="font-semibold">
                      <td>TOTAL OF INCOME TAX</td>
                      <td className="text-right">{rupiah(summary.totalSelfPayment)}</td>
                      <td className="text-right">{rupiah(summary.totalWithholding)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-xxs text-ink-muted">
                Kolom "Income Tax Borne by Government" dan "Paid from Previous Return" belum dihitung pada
                simulasi ini (lihat catatan PENTING di <code>sptCalc.ts</code>).
              </p>
            </div>

            <div>
              <p className="text-[13px] font-semibold text-ink-muted">C. Pernyataan dan Tanda Tangan</p>
              {declarationEditable ? (
                <DeclarationForm
                  spt={spt}
                  personName={db.session!.personName}
                  onChange={(patch) => saveField({ declaration: { ...spt.declaration, ...patch } })}
                />
              ) : (
                <div className="mt-2 grid gap-2 text-[13px] sm:grid-cols-3">
                  <ReadField label="Ditandatangani oleh" value={spt.declaration.signedAs === 'TAXPAYER' ? 'Subjek Pajak/Wajib Pajak' : 'Wakil/Kuasa'} />
                  <ReadField label="Nama" value={spt.declaration.signerName} />
                  <ReadField label="Ditandatangani pada" value={spt.signature ? new Date(spt.signature.signedAt).toLocaleString('id-ID') : '-'} />
                </div>
              )}

              {isKonsep && (
                <div className="mt-4 flex gap-2">
                  <button className="btn-secondary" onClick={saveDraft} disabled={!canDraftSptRole}>Simpan Konsep</button>
                  <button
                    className="btn-primary"
                    onClick={() => setSigning(true)}
                    disabled={!canSignSptRole || !spt.declaration.agreed || !spt.declaration.signerName}
                    title={!canSignSptRole ? explainDeniedSpt('sign', 'PPH_UNIFIKASI') : undefined}
                  >
                    Bayar dan Lapor
                  </button>
                </div>
              )}
            </div>

            {spt.status === 'MENUNGGU_PEMBAYARAN' && spt.billing && (
              <BillingCard billing={spt.billing} onPay={pay} disabled={!canSignSptRole} />
            )}
          </div>
        )}

        {tab === 'DAFTAR-I' && (
          <div className="mt-4">
            <p className="text-[13px] text-ink-muted">
              Daftar Bukti Pemotongan/Pemungutan (BPPU) berstatus Telah Terbit pada masa pajak{' '}
              {String(spt.taxPeriodMonth).padStart(2, '0')}/{spt.taxPeriodYear}.
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>NIK/NPWP</th><th>Nama</th><th>Nomor Bukti Potong</th><th>Tanggal</th>
                    <th>Jenis Pajak</th><th>Kode Objek Pajak</th>
                    <th className="text-right">DPP/Bruto</th><th className="text-right">PPh</th>
                  </tr>
                </thead>
                <tbody>
                  {daftarIRows.length === 0 && (
                    <tr><td colSpan={8} className="py-6 text-center text-ink-muted">Tidak ada data yang ditemukan.</td></tr>
                  )}
                  {daftarIRows.map((b) => (
                    <tr key={b.id}>
                      <td className="font-mono text-xxs">{b.counterpartTin}</td>
                      <td>{b.counterpartName}</td>
                      <td className="font-mono">{b.withholdingNumber}</td>
                      <td>{b.createdAt ? new Date(b.createdAt).toLocaleDateString('id-ID') : '-'}</td>
                      <td>{BPPU_ARTICLE_LABEL[(b.fields.article as keyof typeof BPPU_ARTICLE_LABEL) ?? '23']}</td>
                      <td className="font-mono">{b.taxObjectCode}</td>
                      <td className="text-right">{rupiah(b.gross)}</td>
                      <td className="text-right">{rupiah(b.withheld)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'DAFTAR-II' && (
          <div className="mt-4 space-y-6">
            <DaftarIITable
              title="Tabel I. Daftar Pajak Penghasilan - Pembayaran Sendiri"
              rows={spt.daftarIISendiri}
              editable={editable}
              onAdd={() => addDaftarIIRow('daftarIISendiri')}
              onUpdate={(rowId, patch) => updateDaftarIIRow('daftarIISendiri', rowId, patch)}
              onRemove={(rowId) => removeDaftarIIRow('daftarIISendiri', rowId)}
            />
            <DaftarIITable
              title="Tabel II. Daftar Pajak Penghasilan - Pembayaran Kumulatif"
              rows={spt.daftarIIKumulatif}
              editable={editable}
              onAdd={() => addDaftarIIRow('daftarIIKumulatif')}
              onUpdate={(rowId, patch) => updateDaftarIIRow('daftarIIKumulatif', rowId, patch)}
              onRemove={(rowId) => removeDaftarIIRow('daftarIIKumulatif', rowId)}
            />
          </div>
        )}

        {tab === 'LAMPIRAN-I' && (
          <div className="mt-4">
            <p className="text-[13px] text-ink-muted">
              LAMPIRAN-I (Tabel I. ATC — Alokasi Transaksi antar Cabang) belum diimplementasikan pada tahap
              ini. Slide 27 PDF menunjukkan tabel ini kosong pada contoh, dengan kolom NIK/NPWP Penerima
              Penghasilan, Nama Penerima Penghasilan, ID Akun Penerima Pendapatan, NIK/NPWP Pemberi
              Penghasilan, Nama Pemberi Penghasilan, ID Akun Pemberi Penghasilan, dan Kode Objek Pajak —
              dicatat untuk tahap pengembangan berikutnya.
            </p>
          </div>
        )}
      </section>

      {signing && (
        <SignDialog
          signerNik={db.session!.personNik}
          credential={db.mainAccountProfile?.signingCredential ?? null}
          onCancel={() => setSigning(false)}
          onConfirm={submit}
        />
      )}
    </div>
  );
}

function DaftarIITable({
  title,
  rows,
  editable,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string;
  rows: DaftarIISetorSendiriRow[];
  editable: boolean;
  onAdd: () => void;
  onUpdate: (rowId: string, patch: Partial<DaftarIISetorSendiriRow>) => void;
  onRemove: (rowId: string) => void;
}) {
  const total = rows.reduce((s, r) => s + r.pph, 0);
  return (
    <div>
      <div className="flex items-center gap-2">
        <p className="text-[13px] font-semibold text-ink-muted">{title}</p>
        {editable && (
          <button className="btn-secondary ml-auto text-xxs" onClick={onAdd}>+ Tambah Baris</button>
        )}
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Jenis Pajak</th><th>Kode Objek Pajak</th><th>Objek Pajak</th>
              <th className="text-right">DPP (Rp)</th><th className="text-right">Tarif (%)</th>
              <th className="text-right">PPh (Rp)</th><th>Fasilitas</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="py-6 text-center text-ink-muted">Tidak ada data yang ditemukan.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <input className="field-input" disabled={!editable} value={r.jenisPajak}
                    onChange={(e) => onUpdate(r.id, { jenisPajak: e.target.value })} />
                </td>
                <td>
                  <input className="field-input font-mono" disabled={!editable} value={r.kodeObjekPajak}
                    onChange={(e) => onUpdate(r.id, { kodeObjekPajak: e.target.value })} />
                </td>
                <td>
                  <input className="field-input" disabled={!editable} value={r.objekPajak}
                    onChange={(e) => onUpdate(r.id, { objekPajak: e.target.value })} />
                </td>
                <td>
                  <input type="number" className="field-input text-right" disabled={!editable} value={r.dpp}
                    onChange={(e) => onUpdate(r.id, { dpp: +e.target.value })} />
                </td>
                <td>
                  <input type="number" className="field-input text-right" disabled={!editable} value={r.tarif}
                    onChange={(e) => onUpdate(r.id, { tarif: +e.target.value })} />
                </td>
                <td className="text-right">{rupiah(r.pph)}</td>
                <td>
                  <input className="field-input" disabled={!editable} value={r.fasilitas}
                    onChange={(e) => onUpdate(r.id, { fasilitas: e.target.value })} />
                </td>
                <td>
                  {editable && (
                    <button className="text-bad hover:underline" onClick={() => onRemove(r.id)}>Hapus</button>
                  )}
                </td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td colSpan={5}>TOTAL OF INCOME TAX TO BE PAID</td>
              <td className="text-right">{rupiah(total)}</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
