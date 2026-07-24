# PGURUKUL - Classroom & Department Collaboration Platform

A modern, secure, lightweight collaboration platform combining the best features of Google Classroom, Google Drive, Discord, Slack, and Microsoft Teams.

## ✨ Features

### 🔐 Authentication & Authorization
- Secure email/password authentication with Better Auth
- Invite-code based department joining
- Role-based access control (Super Admin, Department Lead, Intern)
- Session management with secure cookies
- Activity audit trail for all actions

### 💬 Real-Time Collaboration
- Department-scoped chat with message history
- @Mention system with user autocomplete
- Message threading and replies
- Typing indicators and online status
- Message pinning and search

### 📁 File Management
- Drag-and-drop file upload
- Automatic file versioning
- Version history and restore
- File search and filtering
- Soft deletion with recovery
- Support for: PDF, DOCX, PPTX, Images, ZIP, CSV, Excel

### ✅ Task Management
- Create and assign tasks
- Status tracking (Not Started → In Progress → Review → Completed)
- Priority levels (Low, Medium, High)
- Due date tracking
- Task filtering and calendar view
- Task comments with @mentions

### 📢 Announcements
- Department and global announcements
- Pinnable announcements
- Announcement history
- Read/unread tracking

### 👥 User Management
- Admin user dashboard
- User search and filtering
- Edit user profiles and roles
- Account enable/disable
- Password reset functionality

### 🏢 Department Management
- Create departments with auto-generated invite codes
- Assign department leads
- Invite interns via email or code
- Department isolation (data, chat, files, tasks)

### 🛡️ Security
- Password hashing with bcryptjs
- CSRF protection
- XSS prevention
- SQL injection protection (Drizzle ORM)
- Rate limiting on auth endpoints
- Account lockout after failed attempts
- Department-level data isolation
- Comprehensive activity logging

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- pnpm (or npm/yarn)

### Installation

1. **Clone and install dependencies**
```bash
pnpm install
```

2. **Set up environment variables**
```bash
cp .env.example .env.local
```

3. **Generate authentication secret**
```bash
# Generate a random secret for Better Auth
openssl rand -base64 32
# Add it to .env.local as BETTER_AUTH_SECRET
```

4. **Configure database**
```bash
# Add your PostgreSQL connection string to DATABASE_URL in .env.local
DATABASE_URL="postgresql://user:password@localhost:5432/pgurukul"
```

5. **Run database migrations**
```bash
pnpm db:push
```

6. **Start development server**
```bash
pnpm dev
```

7. **Open in browser**
```
http://localhost:3000
```

### First Time Setup

1. **Sign up as Super Admin** (first user without invite code)
   - Navigate to `/signup`
   - Create account without using an invite code
   - This becomes the super admin account

2. **Create a department**
   - Go to Admin Dashboard → Departments
   - Create a new department
   - Copy the invite code

3. **Invite users**
   - Share the invite code with interns
   - They sign up using: `/signup?code=INVITE_CODE`

4. **Assign roles**
   - Admin can assign Department Leads
   - Department Leads can invite interns to their department

---

## 📚 Usage

### For Interns
- Join a department using invite code
- Chat with department members
- Upload and collaborate on files
- View and complete assigned tasks
- Read department announcements

### For Department Leads
- Manage department members
- Create and assign tasks
- Post announcements
- Organize department files
- Monitor activity

### For Super Admins
- Create departments
- Manage all users
- View system activity logs
- Access database viewer
- Manage storage
- Configure system settings

---

## 🏗️ Project Structure

```
app/
├── api/                    # Backend API routes
│   ├── auth/              # Authentication endpoints
│   ├── departments/       # Department management
│   ├── users/             # User management
│   ├── chat/              # Chat messages
│   ├── files/             # File operations
│   ├── tasks/             # Task management
│   ├── announcements/     # Announcements
│   └── admin/             # Admin functions
├── dashboard/             # Authenticated pages
│   ├── page.tsx          # Dashboard home
│   ├── chat/             # Chat interface
│   ├── files/            # File management
│   ├── tasks/            # Task management
│   ├── announcements/    # Announcements
│   ├── settings/         # User settings
│   └── admin/            # Admin pages
├── login/                 # Login page
├── signup/                # Signup page
└── layout.tsx            # Root layout

lib/
├── db.ts                 # Database connection
├── schema.ts             # Database schema
├── auth.ts               # Better Auth setup
├── auth-utils.ts         # Auth utilities
├── client-utils.ts       # Client utilities
└── toast.ts              # Toast notifications

components/
└── ui/                   # Reusable UI components
    ├── button.tsx
    ├── card.tsx
    └── ...

middleware.ts            # Route protection
```

---

## 📊 Database Schema

### Core Tables
- **users** - User accounts and profiles
- **departments** - Department organization
- **messages** - Chat messages
- **mentions** - @Mention tracking
- **files** - File metadata and storage
- **fileVersions** - File version history
- **tasks** - Task management
- **announcements** - Department/global announcements
- **notifications** - User notifications
- **activityLogs** - Audit trail
- **sessions** - Session management

---

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/sign-up` - Create account
- `POST /api/auth/sign-in` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Departments
- `POST /api/departments/create` - Create department
- `GET /api/departments/create` - List departments

### Users
- `GET /api/admin/users` - List all users
- `PATCH /api/admin/users` - Update user
- `DELETE /api/admin/users` - Delete user
- `GET /api/users/profile` - Get user profile
- `PATCH /api/users/profile` - Update profile

### Chat
- `POST /api/chat/messages` - Send message
- `GET /api/chat/messages` - Get messages

### Files
- `POST /api/files/upload` - Upload file
- `GET /api/files/upload` - List files
- `GET /api/files/[id]` - Get file
- `PATCH /api/files/[id]` - Update file
- `DELETE /api/files/[id]` - Delete file
- `GET /api/files/versions` - Get version history
- `POST /api/files/versions` - Restore version

---

## 🔒 Security Features

✅ **Authentication**
- Password hashing with bcryptjs
- Secure session management
- JWT tokens

✅ **Authorization**
- Role-based access control
- Department-level isolation
- Permission middleware

✅ **Data Protection**
- SQL injection prevention
- XSS input sanitization
- CSRF protection

✅ **Audit & Logging**
- All actions logged
- Activity audit trail
- IP and device tracking

---

## 🎯 Project Status

**Overall Completion: ~60%**

### Completed
- ✅ Database & Authentication
- ✅ Core Infrastructure
- ✅ User & Department Management
- ✅ Chat System
- ✅ File Management

### In Development
- 🔄 Notifications System
- 🔄 Task Management (API)
- 🔄 Search System
- 🔄 Admin Dashboard (full version)

### Planned
- ⏳ Real-time WebSockets (Socket.io)
- ⏳ Email notifications
- ⏳ Activity logs viewer
- ⏳ Performance optimization
- ⏳ Testing suite

See [PROJECT_STATUS.md](./PROJECT_STATUS.md) for detailed breakdown.

---

## 🛠️ Development

### Available Scripts

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linter
pnpm lint

# Database commands
pnpm db:generate   # Generate migrations
pnpm db:migrate    # Run migrations
pnpm db:push       # Push schema to DB
pnpm db:studio     # Open Drizzle Studio
```

### Adding New Features

1. **Database schema** → Add to `lib/schema.ts`
2. **Run migrations** → `pnpm db:push`
3. **API routes** → Create in `app/api/`
4. **Frontend** → Add pages/components
5. **Testing** → Write tests for new features

---

## 📖 Documentation

- **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** - Detailed project status and architecture
- **[.env.example](./.env.example)** - Environment variables reference
- **[API_DOCS.md](./docs/API_DOCS.md)** - (TODO) Comprehensive API documentation
- **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - (TODO) Render deployment guide

---

## 🤝 Contributing

To contribute:

1. Create a feature branch
2. Make your changes
3. Add/update tests
4. Submit a pull request

---

## 📝 License

This project is licensed under the MIT License.

---

## 💡 Support

For support or issues:
1. Check existing issues and documentation
2. Enable debug mode with `[v0]` console prefix
3. Contact the development team

---

## 🙏 Acknowledgments

Built with:
- [Next.js 16](https://nextjs.org/)
- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Better Auth](https://better-auth.com/)
- [PostgreSQL](https://www.postgresql.org/)

---

**Version**: 0.1.0  
**Last Updated**: July 2024  
**Status**: Active Development
