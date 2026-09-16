import { ROLES, type RoleCode } from '@/lib/domain/roles';
import type { BupotDoc, RelatedParty, RoleAssignment, Session } from '@/lib/domain/types';

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
 *
 * Di atas kedua sumbu ini ada satu pengecualian (slide 33, "Catatan"): PIC
 * Badan — satu orang yang ditunjuk lewat Informasi Umum → Pihak Terkait
 * (lihat `RelatedParty.isPic`) — punya akses penuh ke seluruh fitur Badan
 * yang diwakilinya, terlepas dari role apa pun yang eksplisit ditetapkan.
 * Ini BEDA dari PIC TKU (`Tku.picNiks`) yang hanya membatasi cakupan TKU.
 */

/** true bila orang ini adalah PIC Badan yang sedang diwakili (akses penuh). */
export function isEntityPic(parties: RelatedParty[], session: Session): boolean {
  if (!session.impersonatingTin) return false;
  return parties.some(
    (p) => p.entityTin === session.impersonatingTin && p.personNik === session.personNik && p.isPic,
  );
}

export function assignmentsFor(all: RoleAssignment[], session: Session): RoleAssignment[] {
  if (!session.impersonatingTin) return [];
  return all.filter(
    (a) => a.personNik === session.personNik && a.entityTin === session.impersonatingTin,
  );
}

export function hasRole(
  all: RoleAssignment[],
  session: Session,
  role: RoleCode,
  parties: RelatedParty[] = [],
): boolean {
  if (isEntityPic(parties, session)) return true;
  return assignmentsFor(all, session).some((a) => a.role === role);
}

/** true bila orang ini terdaftar di pusat untuk salah satu role-nya, atau PIC Badan. */
export function isPusat(all: RoleAssignment[], session: Session, parties: RelatedParty[] = []): boolean {
  if (isEntityPic(parties, session)) return true;
  return assignmentsFor(all, session).some((a) => a.scopeNitku === null);
}

/** Daftar NITKU yang boleh dilihat. null berarti tanpa batas (pusat atau PIC Badan). */
export function visibleNitkus(
  all: RoleAssignment[],
  session: Session,
  parties: RelatedParty[] = [],
): string[] | null {
  if (isEntityPic(parties, session)) return null;
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

export function canDraft(
  all: RoleAssignment[],
  session: Session,
  kind: string,
  parties: RelatedParty[] = [],
): boolean {
  if (isEntityPic(parties, session)) return true;
  const { drafter, signer } = rolesForBupot(kind);
  return hasRole(all, session, drafter) || hasRole(all, session, signer);
}

export function canSign(
  all: RoleAssignment[],
  session: Session,
  kind: string,
  parties: RelatedParty[] = [],
): boolean {
  if (isEntityPic(parties, session)) return true;
  return hasRole(all, session, rolesForBupot(kind).signer);
}

/** Filter baris tabel sesuai kedua sumbu otorisasi di atas. */
export function filterVisibleBupots(
  docs: BupotDoc[],
  all: RoleAssignment[],
  session: Session,
  parties: RelatedParty[] = [],
): BupotDoc[] {
  if (!session.impersonatingTin) return [];
  const scope = visibleNitkus(all, session, parties);
  return docs.filter((d) => {
    if (d.entityTin !== session.impersonatingTin) return false;
    if (!canDraft(all, session, d.kind, parties)) return false;
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
  return `Akun Anda belum memiliki role ${needed}. Minta PIC Badan menambahkannya lewat Manajemen Akses → Wakil/Kuasa Saya → Tetapkan Role, atau lewat Informasi Umum → Pihak Terkait bila Anda ingin menjadi PIC.`;
}
