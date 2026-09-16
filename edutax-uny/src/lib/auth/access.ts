import { ROLES, type RoleCode } from '@/lib/domain/roles';
import type { BupotDoc, RoleAssignment, Session } from '@/lib/domain/types';

/**
 * Otorisasi Coretax bekerja pada dua sumbu sekaligus:
 *
 *  1. Jenis pajak  — drafter/signer PPh 21 tidak dapat melihat dokumen
 *                    Unifikasi atau Faktur Pajak sama sekali.
 *  2. TKU          — PIC TKU 000001 tidak dapat melihat bupot milik TKU
 *                    000002, kecuali orang tersebut juga terdaftar sebagai
 *                    pihak terkait di pusat (scopeNitku === null).
 *
 * Signer/Drafter SPT yang terdaftar di pusat melihat seluruh dokumen dengan
 * jenis pajak yang sama, termasuk yang ditandatangani PIC TKU lain.
 */

export function assignmentsFor(all: RoleAssignment[], session: Session): RoleAssignment[] {
  if (!session.impersonatingTin) return [];
  return all.filter(
    (a) => a.personNik === session.personNik && a.entityTin === session.impersonatingTin,
  );
}

export function hasRole(all: RoleAssignment[], session: Session, role: RoleCode): boolean {
  return assignmentsFor(all, session).some((a) => a.role === role);
}

/** true bila orang ini terdaftar di pusat untuk salah satu role-nya. */
export function isPusat(all: RoleAssignment[], session: Session): boolean {
  return assignmentsFor(all, session).some((a) => a.scopeNitku === null);
}

/** Daftar NITKU yang boleh dilihat. null berarti tanpa batas (pusat). */
export function visibleNitkus(all: RoleAssignment[], session: Session): string[] | null {
  const mine = assignmentsFor(all, session);
  if (mine.some((a) => a.scopeNitku === null)) return null;
  return [...new Set(mine.map((a) => a.scopeNitku!).filter(Boolean))];
}

const BUPOT_21_KINDS = ['BPMP', 'BP21', 'BP26', 'BPA1', 'BPA2'];

function rolesForBupot(kind: string): { drafter: RoleCode; signer: RoleCode } {
  return BUPOT_21_KINDS.includes(kind)
    ? { drafter: ROLES.EBUPOT_21_DRAFTER, signer: ROLES.EBUPOT_21_SIGNER }
    : { drafter: ROLES.EBUPOT_UNIFIKASI_DRAFTER, signer: ROLES.EBUPOT_UNIFIKASI_SIGNER };
}

export function canDraft(all: RoleAssignment[], session: Session, kind: string): boolean {
  const { drafter, signer } = rolesForBupot(kind);
  return hasRole(all, session, drafter) || hasRole(all, session, signer);
}

export function canSign(all: RoleAssignment[], session: Session, kind: string): boolean {
  return hasRole(all, session, rolesForBupot(kind).signer);
}

/** Filter baris tabel sesuai kedua sumbu otorisasi di atas. */
export function filterVisibleBupots(
  docs: BupotDoc[],
  all: RoleAssignment[],
  session: Session,
): BupotDoc[] {
  if (!session.impersonatingTin) return [];
  const scope = visibleNitkus(all, session);
  return docs.filter((d) => {
    if (d.entityTin !== session.impersonatingTin) return false;
    if (!canDraft(all, session, d.kind)) return false;
    if (scope === null) return true;
    return scope.includes(d.idPlaceOfBusinessActivity);
  });
}

/**
 * Pesan penolakan ditulis menjelaskan penyebab dan jalan keluarnya, bukan
 * sekadar "akses ditolak", karena ini media belajar.
 */
export function explainDenied(action: 'draft' | 'sign', kind: string): string {
  const { drafter, signer } = rolesForBupot(kind);
  const needed = action === 'sign' ? signer : drafter;
  return `Akun Anda belum memiliki role ${needed}. Minta PIC Utama menambahkannya lewat Manajemen Akses → Wakil/Kuasa Saya → Tetapkan Role.`;
}
