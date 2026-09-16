'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadDb, updateDb, type Database } from './db';

/**
 * Menjaga komponen tetap sinkron dengan localStorage, termasuk bila mahasiswa
 * membuka dua tab sekaligus (event `storage`) atau mengubah data dari komponen
 * lain di tab yang sama (event kustom `edutax:db-changed`).
 */
export function useDb() {
  const [db, setDb] = useState<Database>(() => loadDb());

  useEffect(() => {
    const sync = () => setDb(loadDb());
    sync();
    window.addEventListener('edutax:db-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('edutax:db-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const mutate = useCallback((fn: (db: Database) => void) => {
    setDb(updateDb(fn));
  }, []);

  return { db, mutate };
}
