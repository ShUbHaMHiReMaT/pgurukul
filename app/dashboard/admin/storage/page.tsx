'use client';

import { useAuth } from '@/app/providers';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card } from '@/components/ui/card';

export default function StoragePage() {
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
        <h1 className="text-3xl font-bold">Storage Management</h1>
        <p className="text-muted-foreground mt-2">View and manage file storage across departments</p>
      </div>

      <Card className="p-8">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Storage management interface</p>
          <p className="text-sm text-muted-foreground">
            This feature will allow viewing storage usage, browsing files, managing quotas, and detecting duplicates.
          </p>
        </div>
      </Card>
    </div>
  );
}
