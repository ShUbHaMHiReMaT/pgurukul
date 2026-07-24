import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Users, MessageSquare, FileText, CheckSquare } from 'lucide-react';

export default function Page() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* Navigation */}
      <nav className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold">PGURUKUL</div>
          <div className="flex gap-4">
            <Link href="/login">
              <Button variant="outline">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button>Sign Up</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
              Collaborate with Your{' '}
              <span className="text-primary">Department</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              PGURUKUL is a secure, lightweight collaboration platform combining the best features of Classroom, Google Drive, Discord, and Teams.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <Link href="/signup">
              <Button size="lg" className="gap-2">
                Get Started <ArrowRight size={20} />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Sign In
              </Button>
            </Link>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 gap-8 mt-16 pt-16 border-t border-border">
            <div className="space-y-3 text-left">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <MessageSquare size={24} />
              </div>
              <h3 className="text-lg font-semibold">Real-time Chat</h3>
              <p className="text-muted-foreground">
                Communicate instantly with your department members with typing indicators and read receipts.
              </p>
            </div>

            <div className="space-y-3 text-left">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <FileText size={24} />
              </div>
              <h3 className="text-lg font-semibold">File Management</h3>
              <p className="text-muted-foreground">
                Upload, version, and organize files with automatic version history and restore capabilities.
              </p>
            </div>

            <div className="space-y-3 text-left">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center">
                <CheckSquare size={24} />
              </div>
              <h3 className="text-lg font-semibold">Task Management</h3>
              <p className="text-muted-foreground">
                Create, assign, and track tasks with priorities, due dates, and progress updates.
              </p>
            </div>

            <div className="space-y-3 text-left">
              <div className="w-12 h-12 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center">
                <Users size={24} />
              </div>
              <h3 className="text-lg font-semibold">Department Isolation</h3>
              <p className="text-muted-foreground">
                Each department has its own secure space with isolated chat, files, and tasks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
          <p>&copy; 2024 PGURUKUL. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
