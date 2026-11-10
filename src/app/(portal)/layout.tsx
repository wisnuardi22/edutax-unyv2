'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useDb } from '@/lib/storage/useDb';
import { ensureSeedData } from '@/lib/domain/portal';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { db, mutate } = useDb();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (db.session) {
      mutate((d) => ensureSeedData(d, { nik: d.session!.personNik, name: d.session!.personName }));
    }
  }, []);

  useEffect(() => {
    if (mounted && !db.session) router.replace('/login');
  }, [mounted, db.session, router]);

  if (!mounted || !db.session) return null;
  return <AppShell>{children}</AppShell>;
}
