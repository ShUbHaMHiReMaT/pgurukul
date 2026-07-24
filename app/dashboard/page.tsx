"use client";

import { useEffect, useState } from "react";
import { Bell, MessageSquare, FileText, CheckSquare, Megaphone, Users } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const [notifications, setNotifications] = useState(0);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Load user data
    const userId = localStorage.getItem("userId");
    if (userId) {
      fetch(`/api/users/${userId}`, {
        headers: { "x-user-id": userId },
      })
        .then((r) => r.json())
        .then((data) => setUser(data.user))
        .catch(console.error);

      // Load notification count
      fetch(`/api/notifications?unreadOnly=true`, {
        headers: { "x-user-id": userId },
      })
        .then((r) => r.json())
        .then((data) => setNotifications(data.unreadCount))
        .catch(console.error);
    }
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Welcome, {user?.name || "User"}!
          </h1>
          <p className="text-lg text-muted-foreground">
            Manage your team, collaborate, and stay organized
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unread Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">New chats</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Notifications</CardTitle>
              <Bell className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{notifications}</div>
              <p className="text-xs text-muted-foreground">Unread</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Files</CardTitle>
              <FileText className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">Recent uploads</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasks</CardTitle>
              <CheckSquare className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">In progress</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Chat */}
          <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-primary/20 hover:border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
              </div>
              <CardTitle>Team Chat</CardTitle>
              <CardDescription>
                Real-time messaging with your team members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/chat">
                <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  Open Chat
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Files */}
          <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-primary/20 hover:border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
              </div>
              <CardTitle>File Management</CardTitle>
              <CardDescription>
                Share and organize files with your team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/files">
                <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  Manage Files
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Tasks */}
          <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-primary/20 hover:border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                  <CheckSquare className="h-6 w-6 text-primary" />
                </div>
              </div>
              <CardTitle>Task Management</CardTitle>
              <CardDescription>
                Create and track team tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/tasks">
                <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  View Tasks
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Announcements */}
          <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-primary/20 hover:border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                  <Megaphone className="h-6 w-6 text-primary" />
                </div>
              </div>
              <CardTitle>Announcements</CardTitle>
              <CardDescription>
                Stay updated with team announcements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/announcements">
                <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  View Announcements
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Team */}
          <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-primary/20 hover:border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
              <CardTitle>Team Management</CardTitle>
              <CardDescription>
                Manage departments and team members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/team">
                <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  Manage Team
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>
              Fast access to common actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link href="/notifications">
                <Button variant="ghost" className="w-full justify-start">
                  View Notifications
                </Button>
              </Link>
              <Link href="/profile">
                <Button variant="ghost" className="w-full justify-start">
                  My Profile
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="ghost" className="w-full justify-start">
                  Settings
                </Button>
              </Link>
              <Link href="/help">
                <Button variant="ghost" className="w-full justify-start">
                  Get Help
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
