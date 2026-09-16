'use client';

import { useState } from 'react';

/**
 * Meniru dialog "Tanda Tangan Dokumen" pada slide 135: pilih penyedia
 * penandatangan, ID terisi otomatis dari sesi, lalu kata sandi.
 */
export function SignDialog({
  signerNik,
  onCancel,
  onConfirm,
}: {
  signerNik: string;
  onCancel: () => void;
  onConfirm: (password: string, provider: 'KODE_OTORISASI_DJP' | 'SERTIFIKAT_ELEKTRONIK') => void;
}) {
  const [provider, setProvider] = useState<'KODE_OTORISASI_DJP' | 'SERTIFIKAT_ELEKTRONIK'>('KODE_OTORISASI_DJP');
  const [pass, setPass] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/40 p-4">
      <div className="w-full max-w-md rounded-card bg-white p-5 shadow-card">
        <h2 className="font-semibold">Tanda Tangan Dokumen</h2>
        <div className="mt-3 space-y-3">
          <div>
            <label className="field-label" htmlFor="sd-provider">Penyedia Penandatangan</label>
            <select
              id="sd-provider"
              className="field-input"
              value={provider}
              onChange={(e) => setProvider(e.target.value as typeof provider)}
            >
              <option value="KODE_OTORISASI_DJP">Kode Otorisasi DJP</option>
              <option value="SERTIFIKAT_ELEKTRONIK">Sertifikat Elektronik</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="sd-id">ID Penandatangan</label>
            <input id="sd-id" className="field-input bg-canvas font-mono" value={signerNik} readOnly />
          </div>
          <div>
            <label className="field-label" htmlFor="sd-pass">Kata Sandi Penandatangan</label>
            <input
              id="sd-pass"
              type="password"
              className="field-input"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && pass && onConfirm(pass, provider)}
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel}>Batal</button>
          <button className="btn-primary" onClick={() => onConfirm(pass, provider)} disabled={!pass}>
            Konfirmasi Tanda Tangan
          </button>
        </div>
      </div>
    </div>
  );
}
