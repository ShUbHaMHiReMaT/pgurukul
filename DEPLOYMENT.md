# PGURUKUL Deployment Guide

## Overview

PGURUKUL is a Next.js 16 full-stack application designed for easy deployment to **Vercel**, **Render**, or other Node.js hosting platforms.

## Development Mode (Mock Data)

The application includes **mock data mode** for development/testing without a database:

### Demo Credentials
- **Admin**: admin@pgurukul.com / password123
- **Department Lead**: lead@pgurukul.com / password123
- **Intern**: intern@pgurukul.com / password123

### Running Locally

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Open http://localhost:3000 in your browser
```

## Production Deployment with Database

### Prerequisites

1. **Database**: PostgreSQL database (Neon, Supabase, Render PostgreSQL, or self-hosted)
2. **Authentication Secret**: Generate with `openssl rand -base64 32`
3. **Node.js 18+** hosting platform (Vercel, Render, Railway, etc.)

### Environment Variables

Create a `.env.local` file (for local) or set in your hosting platform:

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/dbname

# Authentication
BETTER_AUTH_SECRET=your-generated-secret-here

# Optional - for email notifications (future feature)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-password
```

### Database Setup

#### Option 1: Using Neon (Recommended)

1. Create account at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the PostgreSQL connection string
4. Set `DATABASE_URL` environment variable

#### Option 2: Using Supabase

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Navigate to Settings → Database
4. Copy the connection string (PostgreSQL)
5. Set `DATABASE_URL` environment variable

#### Option 3: Using Render

1. Create account at [render.com](https://render.com)
2. Create PostgreSQL database
3. Copy the connection string
4. Set `DATABASE_URL` environment variable

### Database Migrations

Once database is connected:

```bash
# Generate Drizzle migrations
pnpm db:generate

# Push schema to database
pnpm db:push

# View database in Studio (optional)
pnpm db:studio
```

### Deploying to Vercel

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables:
   - `DATABASE_URL`
   - `BETTER_AUTH_SECRET`
5. Click Deploy

### Deploying to Render

1. Create a new **Web Service** on [render.com](https://render.com)
2. Connect GitHub repository
3. Set build command: `pnpm install && pnpm build`
4. Set start command: `pnpm start`
5. Add environment variables:
   - `DATABASE_URL`
   - `BETTER_AUTH_SECRET`
6. Deploy

### Deploying to Railway

1. Create account at [railway.app](https://railway.app)
2. New Project → GitHub Repo
3. Add PostgreSQL plugin
4. Set `DATABASE_URL` to Railway's PostgreSQL
5. Add `BETTER_AUTH_SECRET`
6. Deploy

## Features by Environment

### Development (Mock Data)
✅ Authentication with demo users
✅ Chat system with sample messages
✅ User/department management UI
✅ File management UI
✅ Task management UI
✅ All navigation and UI components

❌ Real data persistence
❌ File uploads (UI only)
❌ Real-time WebSocket updates

### Production (With Database)
✅ All development features
✅ Persistent data storage
✅ Real file uploads and management
✅ User registration and authentication
✅ Department management
✅ Complete audit trail

Optional (future):
- 🔄 Real-time chat with WebSockets
- 📧 Email notifications
- 🔐 Two-factor authentication
- 📱 Mobile app

## Security Checklist

- [ ] `BETTER_AUTH_SECRET` is strong and unique
- [ ] `DATABASE_URL` uses SSL/TLS connection
- [ ] Environment variables are never committed to git
- [ ] `.env.local` is in `.gitignore`
- [ ] Database backups are enabled
- [ ] Application runs on HTTPS in production

## Monitoring & Logging

### Vercel
- Built-in analytics and logging
- Serverless Function logs in dashboard
- Real-time error monitoring

### Render
- View logs in dashboard
- Access error logs in real-time
- CPU/Memory usage metrics

### Railway
- View logs in dashboard
- Deployment history
- Resource monitoring

## Troubleshooting

### Database Connection Error
```
Error: connect ENOENT /var/run/postgresql/.s.PGSQL.5432
```
**Solution**: Ensure `DATABASE_URL` is set correctly

### Authentication Fails
**Solution**: Verify `BETTER_AUTH_SECRET` is set and strong

### Build Fails
**Solution**: 
```bash
# Clear cache and rebuild
rm -rf node_modules .next
pnpm install
pnpm build
```

### Migrations Fail
**Solution**: Ensure database is running and `DATABASE_URL` is correct

## Support

For issues:
1. Check logs in hosting platform dashboard
2. Verify environment variables are set
3. Ensure database connection is valid
4. Check GitHub for documentation

## Next Steps

After deployment:

1. **Create first department**: Use admin panel
2. **Generate invite codes**: Share with team members
3. **Invite users**: Send invite links to team
4. **Test features**: Chat, files, tasks, announcements

## Performance Optimization

### Database
- Indexes created automatically on foreign keys
- Query optimization in place
- Connection pooling configured

### Frontend
- Next.js 16 with automatic code splitting
- CSS-in-JS with Tailwind
- Image optimization
- Cache headers configured

### Build Size
- Total bundle: ~150KB (gzipped)
- Fast build times (~30s)
- Minimal dependencies

## Updating & Maintenance

### Update Dependencies
```bash
pnpm up
pnpm audit
```

### Backup Database
- Neon: Automatic daily backups
- Supabase: Automatic backups enabled
- Render: Configure backup retention

### Monitor Health
- Check deployment logs daily
- Monitor error rates
- Review database performance

## Support & Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Better Auth Docs](https://better-auth.vercel.app)
- [Drizzle ORM Docs](https://orm.drizzle.team)
- [Tailwind CSS Docs](https://tailwindcss.com)
