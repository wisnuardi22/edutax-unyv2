import studentsData from './students.json';

export interface Student {
  no: number;
  nim: string;
  nama: string;
  kelas: string;
  prodi: string;
}

export const STUDENTS: Student[] = studentsData as Student[];

export function findStudentByNim(nim: string): Student | undefined {
  const clean = nim.trim();
  return STUDENTS.find((s) => s.nim === clean);
}
