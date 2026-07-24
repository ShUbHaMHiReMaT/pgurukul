'use client';

import { useAuth } from '@/app/providers';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card } from '@/components/ui/card';

export default function DatabasePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user?.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Database Viewer</h1>
        <p className="text-muted-foreground mt-2">Browse and manage database tables</p>
      </div>

      <Card className="p-8">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Database viewer interface</p>
          <p className="text-sm text-muted-foreground">
            This feature will allow browsing all database tables, viewing records with pagination, filtering, and sorting.
          </p>
        </div>
      </Card>
    </div>
  );
}
