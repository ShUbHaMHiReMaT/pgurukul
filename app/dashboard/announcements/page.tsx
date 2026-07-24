'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Pin, Trash2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/app/providers';
import { formatDateTime } from '@/lib/client-utils';

interface Announcement {
  id: string;
  content: string;
  isGlobal: boolean;
  isPinned: boolean;
  createdAt: string;
  createdByName?: string;
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const canCreate = user?.role === 'department_lead' || user?.role === 'super_admin';

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.trim() || !user?.departmentId) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          content: newAnnouncement,
          departmentId: user.departmentId,
          isGlobal: user.role === 'super_admin' && newAnnouncement.includes('[GLOBAL]'),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAnnouncements([data.announcement, ...announcements]);
        setNewAnnouncement('');
        setShowCreateForm(false);
      }
    } catch (error) {
      console.error('[v0] Failed to create announcement:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Announcements</h1>
          <p className="text-muted-foreground mt-2">Latest announcements and updates</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus size={20} className="mr-2" />
            New Announcement
          </Button>
        )}
      </div>

      {canCreate && showCreateForm && (
        <Card className="p-6">
          <form onSubmit={handleCreateAnnouncement} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Announcement</label>
              <textarea
                value={newAnnouncement}
                onChange={(e) => setNewAnnouncement(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-primary"
                placeholder="Write your announcement... (use [GLOBAL] prefix for global announcements if admin)"
                rows={4}
                required
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Publishing...' : 'Publish'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Announcements List */}
      <div className="space-y-4">
        {announcements.length === 0 ? (
          <Card className="p-8">
            <div className="text-center text-muted-foreground">
              <p>No announcements yet</p>
            </div>
          </Card>
        ) : (
          announcements.map((announcement) => (
            <Card
              key={announcement.id}
              className={`p-6 border-l-4 ${
                announcement.isPinned
                  ? 'border-l-primary bg-primary/5'
                  : announcement.isGlobal
                  ? 'border-l-orange-500'
                  : 'border-l-muted'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {announcement.isPinned && <Pin size={16} className="text-primary" />}
                  {announcement.isGlobal && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-orange-500/10 text-orange-500">
                      Global
                    </span>
                  )}
                </div>

                {canCreate && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" title="Pin announcement">
                      <Pin size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      title="Delete announcement"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                )}
              </div>

              <p className="text-foreground mb-2 whitespace-pre-wrap">{announcement.content}</p>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{announcement.createdByName || 'Admin'}</span>
                <span>{formatDateTime(announcement.createdAt)}</span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
