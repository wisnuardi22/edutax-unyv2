'use client';

import { useState } from 'react';
import { useDb } from '@/lib/storage/useDb';
import {
  INFORMASI_RINCIAN_MENU,
  profileForEntity,
  profileForMainAccount,
  type Profile360,
} from '@/lib/domain/portal';
import { BelumTersedia } from '@/components/ui/BelumTersedia';

/**
 * Portal Saya — halaman ini SEKARANG adalah "Taxpayer 360-Degree Overview"
 * (bukan lagi form registrasi), mengikuti identitas yang sedang aktif di
 * dropdown header: Main Account (RAKA) atau salah satu Taxpayer yang
 * diwakilinya. Sidebar "Informasi Rincian" mendaftar 16 item persis slide
 * 15-16; hanya "Ikhtisar Profil Wajib Pajak" yang datanya diisi penuh,
 * selebihnya ditandai belum tersedia (terlihat, bukan disembunyikan).
 */
export default function PortalPage() {
  const { db } = useDb();
  const session = db.session!;
  const [tab, setTab] = useState<string>(INFORMASI_RINCIAN_MENU[0].key);

  const activeEntity = db.entities.find((e) => e.tin === session.impersonatingTin);
  const profile: Profile360 = activeEntity
    ? profileForEntity(activeEntity.tin, activeEntity.name, activeEntity.address)
    : profileForMainAccount(session.personNik, session.personName);

  const breadcrumbId = activeEntity ? activeEntity.tin : session.personNik;
  const breadcrumbName = activeEntity ? activeEntity.name : session.personName;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-card bg-white p-3 shadow-card">
        <p className="px-2 pb-0.5 text-[15px] font-semibold leading-tight text-ink">{breadcrumbId}</p>
        <p className="px-2 pb-2 text-[13px] leading-tight text-ink-muted">{breadcrumbName}</p>

        <p className="mt-2 px-2 pb-1 text-xxs font-semibold uppercase tracking-wide text-ink-muted">
          Informasi Rincian
        </p>
        {INFORMASI_RINCIAN_MENU.map((m) => (
          <button
            key={m.key}
            onClick={() => setTab(m.key)}
            className={`block w-full rounded px-2 py-2 text-left text-[13px] ${
              tab === m.key ? 'bg-brand-50 font-semibold text-brand-700' : 'hover:bg-canvas'
            }`}
          >
            {m.label}
          </button>
        ))}
      </aside>

      <section className="rounded-card bg-white p-5 shadow-card">
        {tab === 'ikhtisar' ? (
          <TaxpayerOverview profile={profile} />
        ) : (
          <BelumTersedia
            judul={INFORMASI_RINCIAN_MENU.find((m) => m.key === tab)!.label}
            tahap="tahap pengembangan berikutnya"
          />
        )}
      </section>
    </div>
  );
}

function TaxpayerOverview({ profile }: { profile: Profile360 }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-lg font-semibold">Taxpayer 360-Degree Overview</h1>
        <button className="btn-secondary shrink-0" onClick={() => window.print()}>
          Print 360 Degree View
        </button>
      </div>

      <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Row label="Name" value={profile.name} />
        <Row label="Taxpayer Identification Number" value={profile.tin} mono />
        <Row label="Main Activity" value={profile.mainActivity} />
        <Row label="Taxpayer Type" value={profile.taxpayerType} />
        <Row label="Taxpayer Category" value={profile.taxpayerCategory} />
        <Row label="TIN Status" value={profile.tinStatus} />
        <Row label="Date Registered" value={profile.dateRegistered} />
        <Row label="Activation Date" value={profile.activationDate} />
        <Row label="Taxable Person for VAT Purposes Status" value={profile.vatStatus} />
        <Row label="Taxable Person for VAT Purposes Appointment Date" value={profile.vatAppointmentDate} />
        <Row label="Regional Tax Office" value={profile.regionalTaxOffice} />
        <Row label="Local Tax Office" value={profile.localTaxOffice} />
        <Row label="Supervisory Section" value={profile.supervisorySection} />
        <Row label="Date of Last Profile Update" value={profile.lastProfileUpdate} />
      </dl>

      <p className="mt-6 text-xxs text-ink-muted">
        Sebagian nilai di atas (Taxpayer Type, TIN Status, tanggal-tanggal, kantor pajak, dst.)
        tidak terbaca jelas pada screenshot panduan karena tertutup kotak anotasi, sehingga diisi
        dengan nilai yang wajar untuk keperluan simulasi — bukan disalin dari sumber resmi.
      </p>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[13px] font-semibold text-ink">{label}</dt>
      <dd className={`mt-0.5 text-[13px] text-ink-muted ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
