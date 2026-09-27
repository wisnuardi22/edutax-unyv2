'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CertificateProvider, SigningCredential } from '@/lib/domain/types';

const PROVIDER_LABEL: Record<CertificateProvider, string> = {
  KODE_OTORISASI_DJP: 'Kode Otorisasi DJP',
  BRIN: 'BRIN (Sertifikat Elektronik)',
  BSSN: 'BSSN (Sertifikat Elektronik)',
  PERURI: 'PERURI (Sertifikat Elektronik)',
  PRIVY_ID: 'PrivyID (Sertifikat Elektronik)',
};

/**
 * Meniru dialog "Tanda Tangan Dokumen" pada slide 135/BP21/BPA2. Berbeda
 * dari versi sebelumnya, dialog ini sekarang memvalidasi kredensial yang
 * SUNGGUHAN — bukan menerima kata sandi apa saja:
 * - Bila `credential` null (belum pernah mengajukan Kode Otorisasi/
 *   Sertifikat Digital di Portal Saya → Sertifikat Digital), dialog
 *   menampilkan pesan dan mengarahkan ke sana, tanpa opsi menandatangani.
 * - Bila ada, provider terkunci ke provider yang benar-benar terdaftar
 *   (bukan dropdown bebas), dan untuk Kode Otorisasi DJP, kata sandi
 *   divalidasi terhadap `credential.passphrase` — salah akan ditolak,
 *   persis kredensial sungguhan. Untuk PSrE (BRIN/BSSN/PERURI/PrivyID),
 *   model data belum menyimpan PIN tersendiri, jadi kata sandi apa pun yang
 *   tidak kosong diterima (keterbatasan yang didokumentasikan).
 */
export function SignDialog({
  signerNik,
  credential,
  onCancel,
  onConfirm,
}: {
  signerNik: string;
  credential: SigningCredential | null;
  onCancel: () => void;
  onConfirm: (password: string, provider: CertificateProvider) => void;
}) {
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!credential) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/40 p-4">
        <div className="w-full max-w-md rounded-card bg-white p-5 shadow-card">
          <h2 className="font-semibold">Tanda Tangan Dokumen</h2>
          <p className="mt-3 text-[13px] text-ink-muted">
            Anda belum memiliki Kode Otorisasi DJP atau Sertifikat Digital. Ajukan dulu di{' '}
            <Link href="/portal/sertifikat-digital" className="text-brand-700 underline">
              Portal Saya → Sertifikat Digital
            </Link>{' '}
            sebelum bisa menandatangani dokumen ini.
          </p>
          <div className="mt-5 flex justify-end">
            <button className="btn-secondary" onClick={onCancel}>Tutup</button>
          </div>
        </div>
      </div>
    );
  }

  function confirm() {
    if (!pass) return;
    if (credential!.provider === 'KODE_OTORISASI_DJP' && pass !== credential!.passphrase) {
      setError('Kata sandi salah. Gunakan kata sandi yang sama dengan saat mengajukan Kode Otorisasi DJP.');
      return;
    }
    onConfirm(pass, credential!.provider);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/40 p-4">
      <div className="w-full max-w-md rounded-card bg-white p-5 shadow-card">
        <h2 className="font-semibold">Tanda Tangan Dokumen</h2>
        <div className="mt-3 space-y-3">
          <div>
            <label className="field-label">Penyedia Penandatangan</label>
            <output className="field-input block bg-canvas">{PROVIDER_LABEL[credential.provider]}</output>
          </div>
          <div>
            <label className="field-label" htmlFor="sd-id">ID Penandatangan</label>
            <input id="sd-id" className="field-input bg-canvas font-mono" value={credential.signerId ?? signerNik} readOnly />
          </div>
          <div>
            <label className="field-label" htmlFor="sd-pass">Kata Sandi Penandatangan</label>
            <input
              id="sd-pass"
              type="password"
              className="field-input"
              value={pass}
              onChange={(e) => { setPass(e.target.value); setError(null); }}
              onKeyDown={(e) => e.key === 'Enter' && confirm()}
            />
            {error && <p className="mt-1 text-xxs text-bad">{error}</p>}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel}>Batal</button>
          <button className="btn-primary" onClick={confirm} disabled={!pass}>
            Konfirmasi Tanda Tangan
          </button>
        </div>
      </div>
    </div>
  );
}
