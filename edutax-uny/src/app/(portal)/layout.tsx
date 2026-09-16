'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useDb } from '@/lib/storage/useDb';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { db } = useDb();

  useEffect(() => {
    if (!db.session) router.replace('/login');
  }, [db.session, router]);

  if (!db.session) return null;
  return <AppShell>{children}</AppShell>;
}
