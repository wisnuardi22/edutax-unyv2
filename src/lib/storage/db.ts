'use client';

import type {
  BupotDoc, MainAccountProfile, Person, RelatedParty, RoleAssignment, Session, SptDoc, TaxEntity, Tku,
} from '@/lib/domain/types';

/**
 * Seluruh state praktikum disimpan di localStorage browser.
 * Identitas contoh (Main Account RAKA + satu Taxpayer) disemai otomatis saat
 * login lewat `ensureSeedData()` di `lib/domain/portal.ts`, mengikuti slide
 * 15-16 panduan — bukan lagi zero-data murni. Data transaksi (bupot, SPT,
 * role akses, dst.) tetap kosong dan diisi mahasiswa sendiri selama praktikum.
 * Naikkan SCHEMA_VERSION bila bentuk data berubah, agar data lama dibuang
 * dan tidak menimbulkan error saat dibaca komponen versi baru.
 */
const PREFIX = 'edutax.uny.v1';
const SCHEMA_VERSION = 3;

export interface Database {
  schemaVersion: number;
  persons: Person[];
  entities: TaxEntity[];
  tkus: Tku[];
  roleAssignments: RoleAssignment[];
  relatedParties: RelatedParty[];
  bupots: BupotDoc[];
  spts: SptDoc[];
  session: Session | null;
  /** Profil Main Account (Orang Pribadi) untuk permohonan sertifikat digital. */
  mainAccountProfile: MainAccountProfile | null;
  /** Counter nomor bupot per badan per tahun, agar penomoran urut. */
  counters: Record<string, number>;
}

export const EMPTY_DB: Database = {
  schemaVersion: SCHEMA_VERSION,
  persons: [],
  entities: [],
  tkus: [],
  roleAssignments: [],
  relatedParties: [],
  bupots: [],
  spts: [],
  session: null,
  mainAccountProfile: null,
  counters: {},
};

const KEY = `${PREFIX}.db`;

function isBrowser() {
  return typeof window !== 'undefined';
}

export function loadDb(): Database {
  if (!isBrowser()) return structuredClone(EMPTY_DB);
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY_DB);
    const parsed = JSON.parse(raw) as Database;
    if (parsed.schemaVersion !== SCHEMA_VERSION) return structuredClone(EMPTY_DB);
    return { ...structuredClone(EMPTY_DB), ...parsed };
  } catch {
    return structuredClone(EMPTY_DB);
  }
}

export function saveDb(db: Database) {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(db));
  window.dispatchEvent(new CustomEvent('edutax:db-changed'));
}

export function updateDb(fn: (db: Database) => void): Database {
  const db = loadDb();
  fn(db);
  saveDb(db);
  return db;
}

/** Tombol "Reset data praktikum" — kembalikan ke kondisi kosong. */
export function resetDb() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent('edutax:db-changed'));
}

/** Ekspor seluruh state agar mahasiswa bisa mengumpulkan hasil praktikum. */
export function exportDb(): string {
  return JSON.stringify(loadDb(), null, 2);
}

export function importDb(json: string) {
  const parsed = JSON.parse(json) as Database;
  saveDb({ ...structuredClone(EMPTY_DB), ...parsed, schemaVersion: SCHEMA_VERSION });
}

/**
 * Penomoran bukti pemotongan. Coretax memakai nomor urut per pemotong per
 * tahun; di sini dibuat sederhana namun konsisten agar mudah dijelaskan.
 */
export function nextWithholdingNumber(db: Database, entityTin: string, year: number): string {
  const key = `${entityTin}:${year}`;
  const next = (db.counters[key] ?? 0) + 1;
  db.counters[key] = next;
  return `${String(year).slice(-2)}${String(next).padStart(8, '0')}`;
}
