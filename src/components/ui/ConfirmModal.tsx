'use client';
import { useEffect, useRef, useState } from 'react';

export function ConfirmModal({ title, message, actionLabel, onConfirm, onCancel }: {
  title: string; message: string; actionLabel: string;
  onConfirm: () => void | Promise<void>; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function confirm() {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    try { await new Promise((resolve) => setTimeout(resolve, 350)); await onConfirm(); onCancel(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Proses gagal. Silakan coba kembali.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <dialog ref={dialog} aria-labelledby="confirm-title" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card bg-white p-5 shadow-card backdrop:bg-brand-900/40">
    <h2 id="confirm-title" className="font-semibold">{title}</h2><p className="mt-3 text-sm">{message}</p>
    {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
    <div className="mt-5 flex justify-end gap-2"><button disabled={busy} className="btn-secondary" onClick={onCancel}>Batal</button><button disabled={busy} className="btn-primary" onClick={() => void confirm()}>{busy ? 'Processing...' : actionLabel}</button></div>
  </dialog>;
}
