# PGURUKUL Quick Start

## 🚀 Get Started in 2 Minutes

### Step 1: Start the App

```bash
pnpm install
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000)

### Step 2: Login with Demo Credentials

The app includes 3 demo users to test different roles:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@pgurukul.com | password123 |
| Department Lead | lead@pgurukul.com | password123 |
| Intern | intern@pgurukul.com | password123 |

### Step 3: Explore Features

After logging in as Admin, you can:

1. **View Dashboard**: See overview of all activities
2. **Chat**: Send messages to department members
3. **Admin Panel**: 
   - Manage users
   - Manage departments
   - View activity logs
   - Access database viewer (placeholder)
4. **Settings**: Update your profile

## 📁 Project Structure

```
pgurukul/
├── app/                      # Next.js app directory
│   ├── api/                  # API endpoints
│   ├── dashboard/            # Protected dashboard routes
│   ├── login/                # Login page
│   ├── signup/               # Signup page
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Home page
│   └── providers.tsx         # Global providers (Auth context)
│
├── components/
│   └── ui/                   # Reusable UI components
│
├── lib/
│   ├── db.ts                 # Database connection
│   ├── schema.ts             # Database schema
│   ├── auth.ts               # Better Auth config
│   ├── mock-data.ts          # Demo data for development
│   ├── auth-utils.ts         # Auth helper functions
│   ├── client-utils.ts       # Client-side utilities
│   └── toast.ts              # Toast notifications
│
├── public/                   # Static assets
├── .env.example              # Environment template
├── drizzle.config.ts         # Drizzle ORM config
├── next.config.ts            # Next.js config
├── tailwind.config.ts        # Tailwind CSS config
├── tsconfig.json             # TypeScript config
└── package.json              # Dependencies

```

## 🎯 Key Features

### Authentication
- Email & password login
- Department invite codes
- Role-based access control (Super Admin, Department Lead, Intern)
- Secure session management

### Chat System
- Department-scoped messaging
- @mention support
- Message history
- Real-time UI updates

### User Management
- Create/edit/delete users
- Assign roles
- Assign to departments

### Department Management
- Create departments
- Generate invite codes
- Invite users via code

### File Management
- Upload files
- Version history
- File deletion
- Storage in database

### Tasks
- Create tasks
- Assign to users
- Set priorities
- Track status (Not Started → In Progress → In Review → Completed)

### Announcements
- Global & department announcements
- Pin important announcements
- Admin-only posting

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/sign-in` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Chat
- `GET /api/chat/messages-mock` - Get messages (dev)
- `POST /api/chat/messages` - Send message

### Users
- `GET /api/admin/users` - List users (admin)
- `POST /api/admin/users` - Create user (admin)
- `PUT /api/admin/users` - Update user (admin)
- `DELETE /api/admin/users` - Delete user (admin)

### Departments
- `POST /api/departments/create` - Create department

### Files
- `POST /api/files/upload` - Upload file
- `GET /api/files/versions` - Get file versions
- `DELETE /api/files/[id]` - Delete file

### Tasks
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/[id]` - Update task

## 🛠️ Common Tasks

### Change Demo User Password

Edit `lib/mock-data.ts` in the `mockUsers` array:

```typescript
{
  password: 'your-new-password', // Change this
}
```

### Add New Demo User

Add to `mockUsers` array in `lib/mock-data.ts`:

```typescript
{
  id: 'user-4',
  email: 'newuser@pgurukul.com',
  username: 'newuser',
  fullName: 'New User',
  role: 'intern',
  departmentId: 'dept-1',
  avatarUrl: '',
  password: 'password123',
}
```

### Add Department

Edit `mockDepartments` array in `lib/mock-data.ts`:

```typescript
{
  id: 'dept-3',
  name: 'New Department',
  description: 'Description',
  inviteCode: 'NEW2024',
  createdBy: 'user-1',
  createdAt: new Date(),
}
```

### Connect to Real Database

1. Set `DATABASE_URL` in `.env.local`
2. Run `pnpm db:push` to create tables
3. Remove mock data references and use real API endpoints

## 🚀 Deployment

### Quick Deploy to Vercel

```bash
# Connect GitHub repo to Vercel
# Add environment variables in Vercel dashboard:
# - DATABASE_URL
# - BETTER_AUTH_SECRET

# Deploy
git push
```

See `DEPLOYMENT.md` for detailed instructions for other platforms.

## 📚 Documentation

- `README.md` - Full project documentation
- `DEPLOYMENT.md` - Deployment guide
- `PROJECT_STATUS.md` - Feature status and roadmap
- `IMPLEMENTATION_COMPLETE.md` - Technical details

## 💡 Tips

- Use admin account to create departments and invite users
- Demo data persists only in memory (resets on server restart)
- For production, connect to a real PostgreSQL database
- Check browser console for helpful debug logs

## ❓ Troubleshooting

### Login fails with "Invalid email or password"
- Use exact demo credentials from table above
- Check for typos in email

### App shows "Loading..." forever
- Check browser console for errors
- Verify API endpoint is responding
- Restart dev server: `Ctrl+C` then `pnpm dev`

### Database connection error in production
- Verify `DATABASE_URL` environment variable is set
- Test database connection: `psql $DATABASE_URL`
- Check database is running and accessible

## 🎓 Learning Path

1. Start with home page (public)
2. Login with admin credentials
3. View dashboard overview
4. Explore admin panel
5. Review API endpoints in `app/api/`
6. Check database schema in `lib/schema.ts`
7. Study authentication flow in `lib/auth-utils.ts`
8. Review UI components in `components/ui/`

## 📞 Support

- Check console logs: `F12` → Console tab
- Review error messages on screen
- Check `app/api/` for endpoint implementation
- See comments in source code

---

**Ready to build?** Jump to `DEPLOYMENT.md` for production setup!
