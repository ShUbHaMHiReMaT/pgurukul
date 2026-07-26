'use client';

import { useAuth } from '@/app/providers';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  MessageSquare,
  CheckSquare,
  Megaphone,
  Users,
  Settings,
  LogOut,
  Menu,
} from 'lucide-react';
import { useState, useEffect } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-border border-t-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const navigationItems = [
    { icon: MessageSquare, label: 'Chat', href: '/dashboard/chat' },
    { icon: FileText, label: 'Files', href: '/dashboard/files' },
    { icon: CheckSquare, label: 'Tasks', href: '/dashboard/tasks' },
    { icon: Megaphone, label: 'Announcements', href: '/dashboard/announcements' },
    ...(user.role === 'super_admin'
      ? [{ icon: Users, label: 'Admin', href: '/dashboard/admin' }]
      : []),
  ];

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } border-r border-border bg-card transition-all duration-300`}
      >
        <div className="flex h-20 items-center justify-between border-b border-border px-4">
          <div className={`font-bold ${sidebarOpen ? 'block' : 'hidden'}`}>
            PGURUKUL
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg p-2 hover:bg-muted"
          >
            <Menu size={20} />
          </button>
        </div>

        <nav className="space-y-2 p-4">
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-4 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              <item.icon size={20} />
              <span className={sidebarOpen ? 'block' : 'hidden'}>
                {item.label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-card p-4">
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-4 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Settings size={20} />
            <span className={sidebarOpen ? 'block' : 'hidden'}>Settings</span>
          </Link>
          <button
            onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-4 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <LogOut size={20} />
            <span className={sidebarOpen ? 'block' : 'hidden'}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="border-b border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{user.fullName || user.username || user.email}</h1>
              <p className="text-sm text-muted-foreground capitalize">{user.role.replace('_', ' ')}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
