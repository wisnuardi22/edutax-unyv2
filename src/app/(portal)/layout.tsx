'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useDb } from '@/lib/storage/useDb';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { db } = useDb();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !db.session) router.replace('/login');
  }, [mounted, db.session, router]);

  if (!mounted || !db.session) return null;
  return <AppShell>{children}</AppShell>;
}
