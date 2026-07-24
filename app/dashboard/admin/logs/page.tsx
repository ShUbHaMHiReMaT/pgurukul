'use client';

import { useAuth } from '@/app/providers';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card } from '@/components/ui/card';

export default function LogsPage() {
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
        <h1 className="text-3xl font-bold">Activity Logs</h1>
        <p className="text-muted-foreground mt-2">View system audit logs and user activity</p>
      </div>

      <Card className="p-8">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Activity logs interface</p>
          <p className="text-sm text-muted-foreground">
            This feature will show all user actions, login attempts, file operations, and security events with timestamps and details.
          </p>
        </div>
      </Card>
    </div>
  );
}
