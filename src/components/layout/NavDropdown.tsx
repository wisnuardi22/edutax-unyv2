'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

export interface NavSubItem {
  label: string;
  href: string;
  /** Label kecil, dipakai untuk menandai item tambahan khusus EduTax. */
  badge?: string;
}

/**
 * Dropdown untuk satu item di bar menu utama, meniru perilaku Coretax: setiap
 * menu (Portal Saya, Surat Pemberitahuan (SPT), dst.) adalah tombol dengan
 * panah bawah yang membuka daftar sub-menu mengambang, bukan tautan langsung.
 */
export function NavDropdown({ label, items }: { label: string; items: NavSubItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <div className="flex items-center gap-0.5 rounded text-[13px] hover:bg-white/10">
        <Link href="/portal" onClick={() => setOpen(false)} className="px-2.5 py-1.5">
          {label}
        </Link>
        <button
          type="button"
          aria-label={`Buka menu ${label}`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded px-1 py-1.5 hover:bg-white/10"
        >
          <ChevronDown size={13} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
      </div>

      {open && (
        <>
          <button
            aria-label="Tutup menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute left-0 z-50 mt-1 w-80 rounded-md border border-line bg-white py-1 text-ink shadow-card">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-2 px-3 py-2 text-[13px] hover:bg-brand-50"
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 text-xxs font-medium text-brand-700">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
