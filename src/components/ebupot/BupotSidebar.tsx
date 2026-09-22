'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DocTab } from '@/lib/domain/types';
export const BUPOT_MODULES = [
  {kind:'BPMP',slug:'bpmp',label:'Bukti Pemotongan Bulanan Pegawai Tetap'},
  {kind:'BP21',slug:'bp21',label:'BP21 - Bukti Pemotongan Selain Pegawai Tetap'},
  {kind:'BPA2',slug:'bpa2',label:'BPA2 - Bukti Pemotongan A2 Masa Pajak Terakhir'},
] as const;
export const BUPOT_TABS = [
  {key:'BELUM_TERBIT',slug:'belum-terbit',label:'Belum Terbit'},
  {key:'TELAH_TERBIT',slug:'telah-terbit',label:'Telah Terbit'},
  {key:'TIDAK_VALID',slug:'tidak-valid',label:'Tidak Valid'},
] as const;
export function BupotSidebar({ kind, tab }: {kind:string;tab:DocTab}) {
  const router=useRouter();
  return <aside className="self-start rounded-card bg-white p-3 shadow-card">
    {BUPOT_MODULES.map((module)=><div key={module.kind} className="mb-3"><Link href={`/ebupot/${module.slug}`} className="mb-1 block px-2 text-[13px] font-semibold text-brand-800">{module.label}</Link>{kind===module.kind && BUPOT_TABS.map((item)=><button key={item.key} className={`block w-full rounded px-3 py-2 text-left text-[13px] ${tab===item.key?'bg-brand-50 font-semibold text-brand-700':'hover:bg-canvas'}`} onClick={()=>router.push(`/ebupot/${module.slug}/${item.slug}`)}>{item.label}</button>)}</div>)}
  </aside>;
}
