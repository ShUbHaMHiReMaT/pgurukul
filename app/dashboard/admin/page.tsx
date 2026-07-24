'use client';

import { useAuth } from '@/app/providers';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  Users,
  Building2,
  Database,
  HardDrive,
  Activity,
  Settings,
} from 'lucide-react';

interface AdminSection {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user?.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading) return null;
  if (user?.role !== 'super_admin') return null;

  const sections: AdminSection[] = [
    {
      icon: <Users size={32} />,
      title: 'User Management',
      description: 'Manage users, roles, and permissions',
      href: '/dashboard/admin/users',
    },
    {
      icon: <Building2 size={32} />,
      title: 'Departments',
      description: 'Create and manage departments',
      href: '/dashboard/admin/departments',
    },
    {
      icon: <Database size={32} />,
      title: 'Database Viewer',
      description: 'Browse and manage database tables',
      href: '/dashboard/admin/database',
    },
    {
      icon: <HardDrive size={32} />,
      title: 'Storage Management',
      description: 'View and manage file storage',
      href: '/dashboard/admin/storage',
    },
    {
      icon: <Activity size={32} />,
      title: 'Activity Logs',
      description: 'View system audit logs and activity',
      href: '/dashboard/admin/logs',
    },
    {
      icon: <Settings size={32} />,
      title: 'System Settings',
      description: 'Configure system settings and policies',
      href: '/dashboard/admin/settings',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold">Administration</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Manage users, departments, and system settings
        </p>
      </div>

      {/* Admin Sections Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full p-6 hover:shadow-lg transition-all cursor-pointer group">
              <div className="text-primary/60 group-hover:text-primary transition-colors mb-4">
                {section.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2">{section.title}</h3>
              <p className="text-sm text-muted-foreground">{section.description}</p>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground mb-2">Total Users</p>
          <p className="text-3xl font-bold">-</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground mb-2">Departments</p>
          <p className="text-3xl font-bold">-</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground mb-2">Storage Used</p>
          <p className="text-3xl font-bold">-</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground mb-2">Messages Today</p>
          <p className="text-3xl font-bold">-</p>
        </Card>
      </div>
    </div>
  );
}
