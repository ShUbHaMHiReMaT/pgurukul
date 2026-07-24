'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/app/providers';
import { useRouter } from 'next/navigation';
import { Trash2, Edit2, Shield } from 'lucide-react';

interface User {
  id: string;
  email: string;
  username?: string;
  role: string;
  departmentId?: string;
  isDisabled: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user?.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (roleFilter) params.append('role', roleFilter);

      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: { 'x-user-id': user?.id || '' },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      }
    } catch (error) {
      console.error('[v0] Failed to fetch users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' },
      });

      if (response.ok) {
        setUsers(users.filter((u) => u.id !== userId));
      }
    } catch (error) {
      console.error('[v0] Failed to delete user:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground mt-2">Manage all users in the system</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>View and manage user accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-foreground outline-none focus:border-primary"
              />
              <select
                value={roleFilter || ''}
                onChange={(e) => setRoleFilter(e.target.value || null)}
                className="rounded-lg border border-border px-3 py-2 text-foreground outline-none focus:border-primary"
              >
                <option value="">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="department_lead">Department Lead</option>
                <option value="intern">Intern</option>
              </select>
              <Button onClick={fetchUsers} disabled={isLoadingUsers}>
                {isLoadingUsers ? 'Loading...' : 'Search'}
              </Button>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium">Email</th>
                    <th className="text-left py-3 px-4 font-medium">Username</th>
                    <th className="text-left py-3 px-4 font-medium">Role</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/50">
                      <td className="py-3 px-4">{u.email}</td>
                      <td className="py-3 px-4">{u.username || '-'}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          {u.role === 'super_admin' && <Shield size={16} />}
                          <span className="capitalize">{u.role.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          u.isDisabled
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-green-500/10 text-green-500'
                        }`}>
                          {u.isDisabled ? 'Disabled' : 'Active'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/dashboard/admin/users/${u.id}`)}
                          >
                            <Edit2 size={16} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteUser(u.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {users.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No users found
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
