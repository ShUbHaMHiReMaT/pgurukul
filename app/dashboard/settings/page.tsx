'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/providers';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const { user, refetch } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    email: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        fullName: user.fullName || '',
        email: user.email,
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsEditing(false);
        await refetch();
      }
    } catch (error) {
      console.error('[v0] Failed to save profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your account settings</p>
      </div>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              disabled
              className="w-full rounded-lg border border-border px-3 py-2 bg-muted text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              disabled={!isEditing}
              className="w-full rounded-lg border border-border px-3 py-2 outline-none disabled:bg-muted disabled:text-muted-foreground focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Full Name</label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              disabled={!isEditing}
              className="w-full rounded-lg border border-border px-3 py-2 outline-none disabled:bg-muted disabled:text-muted-foreground focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Role</label>
            <input
              type="text"
              value={user?.role.replace('_', ' ').toUpperCase() || ''}
              disabled
              className="w-full rounded-lg border border-border px-3 py-2 bg-muted text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">Contact admin to change role</p>
          </div>

          {user?.departmentId && (
            <div>
              <label className="block text-sm font-medium mb-2">Department</label>
              <input
                type="text"
                value={user.departmentId}
                disabled
                className="w-full rounded-lg border border-border px-3 py-2 bg-muted text-muted-foreground"
              />
            </div>
          )}

          <div className="flex gap-2 pt-4">
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
            ) : (
              <>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Security Section */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Manage your account security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full">
            Change Password
          </Button>
          <div className="text-xs text-muted-foreground">
            <p className="mb-2">Last login: -</p>
            <p>Active sessions: 1</p>
          </div>
        </CardContent>
      </Card>

      {/* Preferences Section */}
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Customize your experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Email Notifications</label>
            <input type="checkbox" defaultChecked className="rounded" />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Dark Mode</label>
            <input type="checkbox" className="rounded" />
          </div>
          <Button variant="outline" className="w-full mt-4">
            Save Preferences
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
