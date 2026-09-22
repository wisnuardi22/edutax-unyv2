import type { ReactNode } from 'react';
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return <details open className="mb-4 border border-line"><summary className="cursor-pointer bg-brand-50 px-3 py-2 text-[13px] font-semibold text-brand-800">{title}</summary><div className="space-y-2 p-3">{children}</div></details>;
}
export function FormRow({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return <div className="grid items-center gap-2 sm:grid-cols-[210px_minmax(0,1fr)]"><span className="text-[12px] font-medium">{label}{required ? ' *' : ''}</span><div className="min-w-0">{children}</div></div>;
}
