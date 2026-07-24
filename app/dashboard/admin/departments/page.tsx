'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/app/providers';
import { useRouter } from 'next/navigation';
import { Plus, Copy, Trash2 } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  inviteCode: string;
  departmentLeadId?: string;
  createdAt: string;
}

export default function DepartmentsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoadingDepts, setIsLoadingDepts] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDept, setNewDept] = useState({ name: '', departmentLeadEmail: '' });

  useEffect(() => {
    if (!isLoading && user?.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    setIsLoadingDepts(true);
    try {
      const response = await fetch('/api/departments/create', {
        headers: { 'x-user-id': user?.id || '' },
      });

      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments);
      }
    } catch (error) {
      console.error('[v0] Failed to fetch departments:', error);
    } finally {
      setIsLoadingDepts(false);
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/departments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
        },
        body: JSON.stringify(newDept),
      });

      if (response.ok) {
        const data = await response.json();
        setDepartments([...departments, data.department]);
        setNewDept({ name: '', departmentLeadEmail: '' });
        setShowCreateForm(false);
      }
    } catch (error) {
      console.error('[v0] Failed to create department:', error);
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    // Could add toast notification here
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Departments</h1>
          <p className="text-muted-foreground mt-2">Create and manage departments</p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus size={20} className="mr-2" />
          New Department
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Department</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateDepartment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Department Name
                </label>
                <input
                  type="text"
                  value={newDept.name}
                  onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-primary"
                  placeholder="e.g., Computer Science"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Department Lead Email (Optional)
                </label>
                <input
                  type="email"
                  value={newDept.departmentLeadEmail}
                  onChange={(e) => setNewDept({ ...newDept, departmentLeadEmail: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-primary"
                  placeholder="lead@example.com"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Create</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Departments</CardTitle>
          <CardDescription>Manage existing departments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoadingDepts ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : departments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No departments yet. Create one to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium">Name</th>
                      <th className="text-left py-3 px-4 font-medium">Invite Code</th>
                      <th className="text-left py-3 px-4 font-medium">Created</th>
                      <th className="text-right py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {departments.map((dept) => (
                      <tr key={dept.id} className="hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{dept.name}</td>
                        <td className="py-3 px-4 font-mono text-xs">{dept.inviteCode}</td>
                        <td className="py-3 px-4 text-xs">
                          {new Date(dept.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyInviteCode(dept.inviteCode)}
                              title="Copy invite code"
                            >
                              <Copy size={16} />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
