'use client';

import { useState } from 'react';
import { Search, ChevronDown, Building2, UserRound, Plus } from 'lucide-react';
import type { TaxEntity } from '@/lib/domain/types';

/**
 * Dropdown identitas di pojok kanan header, meniru slide 15-16 pada panduan:
 * dua kelompok — "Main Account" (akun Orang Pribadi itu sendiri) dan
 * "Taxpayers" (daftar Badan/OP yang diwakilinya). Memilih salah satu baris
 * langsung berpindah identitas (impersonating). Di bagian bawah tersedia
 * pintasan untuk mendaftarkan Taxpayer tambahan — bukan bagian asli Coretax,
 * tapi diperlukan karena sistem ini dimulai dari data kosong.
 */
export function IdentitySwitcher({
  personNik,
  personName,
  entities,
  activeEntityTin,
  onSelectMain,
  onSelectEntity,
  onAddEntity,
}: {
  personNik: string;
  personName: string;
  entities: TaxEntity[];
  activeEntityTin: string | null;
  onSelectMain: () => void;
  onSelectEntity: (tin: string) => void;
  onAddEntity: (tin: string, name: string, address: string) => string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [tin, setTin] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activeEntity = entities.find((e) => e.tin === activeEntityTin);
  const currentLabel = activeEntity ? `${activeEntity.tin} ${activeEntity.name}` : `${personNik} ${personName}`;

  const filtered = entities.filter((e) =>
    `${e.tin} ${e.name}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function pick(fn: () => void) {
    fn();
    setOpen(false);
    setQuery('');
  }

  function submitAdd() {
    const result = onAddEntity(tin, name, address);
    if (result) {
      setError(result);
      return;
    }
    setError(null);
    setTin('');
    setName('');
    setAddress('');
    setAddOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[13px] hover:bg-white/10"
      >
        <span className="max-w-[220px] truncate font-mono">{currentLabel}</span>
        <ChevronDown size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <>
          {/* Lapisan transparan untuk menutup dropdown saat klik di luar. */}
          <button
            aria-label="Tutup"
            onClick={() => { setOpen(false); setAddOpen(false); }}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-md border border-line bg-white text-ink shadow-card">
            <div className="border-b border-line p-2">
              <div className="flex items-center gap-2 rounded border border-line px-2 py-1.5">
                <Search size={14} className="text-ink-muted" />
                <input
                  autoFocus
                  className="w-full text-[13px] outline-none"
                  placeholder="Cari NPWP atau nama…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto py-1">
              <p className="px-3 pt-2 text-xxs font-semibold uppercase tracking-wide text-ink-muted">
                Main Account
              </p>
              <button
                onClick={() => pick(onSelectMain)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-brand-50 ${
                  !activeEntityTin ? 'bg-brand-50 font-semibold text-brand-700' : ''
                }`}
              >
                <UserRound size={15} className="text-ink-muted" />
                <span className="font-mono">{personNik}</span> {personName}
              </button>

              <p className="mt-2 px-3 pt-2 text-xxs font-semibold uppercase tracking-wide text-ink-muted">
                Taxpayers
              </p>
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-[13px] text-ink-muted">
                  {entities.length === 0 ? 'Belum ada Taxpayer terdaftar.' : 'Tidak ditemukan.'}
                </p>
              )}
              {filtered.map((e) => (
                <button
                  key={e.tin}
                  onClick={() => pick(() => onSelectEntity(e.tin))}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-brand-50 ${
                    activeEntityTin === e.tin ? 'bg-brand-50 font-semibold text-brand-700' : ''
                  }`}
                >
                  <Building2 size={15} className="text-ink-muted" />
                  <span className="font-mono">{e.tin}</span> {e.name}
                </button>
              ))}
            </div>

            <div className="border-t border-line p-2">
              {!addOpen ? (
                <button
                  onClick={() => setAddOpen(true)}
                  className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-[13px] text-brand-600 hover:bg-brand-50"
                >
                  <Plus size={14} /> Daftarkan Taxpayer baru
                </button>
              ) : (
                <div className="space-y-1.5 p-1">
                  <input
                    className="field-input py-1.5 font-mono text-[13px]"
                    placeholder="NPWP 16 digit"
                    maxLength={16}
                    value={tin}
                    onChange={(e) => setTin(e.target.value)}
                  />
                  <input
                    className="field-input py-1.5 text-[13px]"
                    placeholder="Nama badan/OP"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <input
                    className="field-input py-1.5 text-[13px]"
                    placeholder="Alamat"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                  {error && <p className="text-xxs text-bad">{error}</p>}
                  <div className="flex gap-1.5 pt-0.5">
                    <button className="btn-secondary flex-1 py-1.5 text-[13px]" onClick={() => setAddOpen(false)}>
                      Batal
                    </button>
                    <button className="btn-primary flex-1 py-1.5 text-[13px]" onClick={submitAdd}>
                      Simpan
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
