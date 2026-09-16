'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDb } from '@/lib/storage/useDb';
import { SignDialog } from '@/components/ui/SignDialog';
import { buildArticleSummary, totalNetPayable, type ArticleSummaryRow } from '@/lib/domain/sptCalc';
import type { SptManualRows } from '@/lib/domain/types';

/**
 * Halaman isi SPT Masa PPh Pasal 21/26. Lima tab dan susunan bagian mengikuti
 * slide 120-137 apa adanya: Halaman Utama (Induk, Identitas Pemotong, Article
 * 21/26 Income Tax, Declaration and Signature), lalu L-IA, L-IB, L-II, L-III.
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

  const editable = spt.status === 'KONSEP';
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
    setNotice('Konsep SPT tersimpan.');
  }

  function submit(password: string, provider: 'KODE_OTORISASI_DJP' | 'SERTIFIKAT_ELEKTRONIK') {
    if (!password) return;
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
              <BillingCard billing={spt.billing} onPay={pay} />
            )}

            <Section title="D. Declaration and Signature">
              {editable ? (
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

              {editable && (
                <div className="mt-4 flex gap-2">
                  <button className="btn-secondary" onClick={saveDraft}>Simpan Konsep</button>
                  <button
                    className="btn-primary"
                    onClick={() => setSigning(true)}
                    disabled={!spt.declaration.agreed || !spt.declaration.signerName}
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
}: {
  billing: { kodeBilling: string; kapKjs: string; masaPajak: string; nominal: number; expiresAt: string };
  onPay: () => void;
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
      <button className="btn-primary mt-3" onClick={onPay}>
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
  rows: { id: string; counterpartTin: string; counterpartName: string; withholdingNumber: string | null; gross: number; withheld: number; createdAt: string }[];
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
            <th className="text-right">Bruto</th>
            <th className="text-right">PPh Dipotong</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={6} className="py-6 text-center text-ink-muted">Tidak ada data yang ditemukan.</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td>{i + 1}</td>
              <td className="font-mono">{r.counterpartTin}</td>
              <td>{r.counterpartName}</td>
              <td className="font-mono">{r.withholdingNumber}</td>
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
      <p className="mt-2 text-xxs text-ink-muted">
        {sub} berisi data mengenai daftar bukti potong {sub === 'BPA1' ? '1721-A1' : '1721-A2'}. Modul pembuatan
        {sub === 'BPA1' ? ' BPA1' : ' BPA2'} disiapkan pada tahap pengembangan berikutnya.
      </p>
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
  bupots: { id: string; kind: string; entityTin: string; status: string; taxPeriodMonth: number; taxPeriodYear: number; counterpartTin: string; counterpartName: string; withholdingNumber: string | null; gross: number; withheld: number }[];
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
      <p className="mt-2 text-xxs text-ink-muted">
        Pada bagian ini ditampilkan data bukti pemotongan {sub === 'BP21' ? 'PPh Pasal 21' : 'PPh Pasal 26'} kepada
        selain pegawai tetap. Modul pembuatan {sub} disiapkan pada tahap pengembangan berikutnya.
      </p>
    </div>
  );
}
