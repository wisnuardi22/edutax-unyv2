'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/** Tombol "Impor data" dengan submenu Download Template / Upload File (slide 88/183). */
export function ImportMenuButton({
  disabled,
  title,
  onDownloadTemplate,
  onUpload,
}: {
  disabled?: boolean;
  title?: string;
  onDownloadTemplate: () => void;
  onUpload: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        className="btn-secondary flex items-center gap-1"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title={disabled ? title : undefined}
      >
        Impor data <ChevronDown size={14} />
      </button>
      {open && (
        <>
          {/* Backdrop supaya klik di luar menutup submenu. */}
          <button
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-line bg-white py-1 shadow-card">
            <button
              className="block w-full px-3 py-2 text-left text-[13px] hover:bg-canvas"
              onClick={() => { setOpen(false); onDownloadTemplate(); }}
            >
              Download Template
            </button>
            <button
              className="block w-full px-3 py-2 text-left text-[13px] hover:bg-canvas"
              onClick={() => { setOpen(false); onUpload(); }}
            >
              Upload File
            </button>
          </div>
        </>
      )}
    </div>
  );
}
