-- ============================================================
-- PGURUKUL PostgreSQL Schema
-- Run this ONCE to initialize the database
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For full-text similarity search

-- ─── DEPARTMENTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(10) DEFAULT '🏢',
    invite_code VARCHAR(20) NOT NULL UNIQUE,
    temp_password VARCHAR(255),
    lead_id VARCHAR(36),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    storage_used_bytes BIGINT NOT NULL DEFAULT 0,
    storage_limit_bytes BIGINT NOT NULL DEFAULT 10737418240,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── USERS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(512) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'intern'
        CHECK (role IN ('super_admin', 'department_lead', 'intern')),
    department_id VARCHAR(36) REFERENCES departments(id) ON DELETE SET NULL,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMP,
    last_login_at TIMESTAMP,
    last_login_ip VARCHAR(45),
    last_seen_at TIMESTAMP,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add FK for lead_id (circular reference)
ALTER TABLE departments
    ADD CONSTRAINT fk_dept_lead
    FOREIGN KEY (lead_id) REFERENCES users(id) ON DELETE SET NULL;

-- ─── MESSAGES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    department_id VARCHAR(36) NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    sender_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text'
        CHECK (message_type IN ('text', 'file', 'image', 'system')),
    parent_id VARCHAR(36) REFERENCES messages(id) ON DELETE SET NULL,
    file_id VARCHAR(36),
    file_url VARCHAR(1000),
    file_name VARCHAR(255),
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    edited_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_dept_created
    ON messages(department_id, created_at DESC);

-- ─── MENTIONS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mentions (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    message_id VARCHAR(36) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    mentioned_user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mentioned_by_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── MESSAGE READ RECEIPTS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS message_read_receipts (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    message_id VARCHAR(36) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- ─── TYPING INDICATORS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS typing_indicators (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    department_id VARCHAR(36) NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(department_id, user_id)
);

-- ─── FILES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS files (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    department_id VARCHAR(36) NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    uploader_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    extension VARCHAR(20) NOT NULL,
    mime_type VARCHAR(100),
    size_bytes BIGINT NOT NULL DEFAULT 0,
    storage_key VARCHAR(1000) NOT NULL,
    storage_url VARCHAR(2000),
    storage_backend VARCHAR(20) NOT NULL DEFAULT 'local',
    version INT NOT NULL DEFAULT 1,
    current_version_id VARCHAR(36),
    checksum VARCHAR(64),
    description TEXT,
    folder_path VARCHAR(500) NOT NULL DEFAULT '/',
    tags TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    search_vector TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_dept_folder
    ON files(department_id, folder_path, is_deleted);
CREATE INDEX IF NOT EXISTS idx_files_search
    ON files USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- ─── FILE VERSIONS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS file_versions (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    file_id VARCHAR(36) NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    uploader_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    version_number INT NOT NULL,
    storage_key VARCHAR(1000) NOT NULL,
    storage_url VARCHAR(2000),
    size_bytes BIGINT NOT NULL,
    checksum VARCHAR(64),
    change_note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── TASKS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    department_id VARCHAR(36) NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    created_by_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'in_progress', 'review', 'completed')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_dept_status
    ON tasks(department_id, status, is_deleted);

-- ─── TASK ASSIGNMENTS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_assignments (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    task_id VARCHAR(36) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(task_id, user_id)
);

-- ─── TASK COMMENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_comments (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    task_id VARCHAR(36) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── TASK ATTACHMENTS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_attachments (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    task_id VARCHAR(36) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_id VARCHAR(36) NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    added_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── ANNOUNCEMENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    author_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department_id VARCHAR(36) REFERENCES departments(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_global BOOLEAN NOT NULL DEFAULT FALSE,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_dept_created
    ON announcements(department_id, is_deleted, created_at DESC);

-- ─── ANNOUNCEMENT READS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcement_reads (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    announcement_id VARCHAR(36) NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(announcement_id, user_id)
);

-- ─── NOTIFICATIONS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    notification_type VARCHAR(30) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    entity_type VARCHAR(30),
    entity_id VARCHAR(36),
    entity_url VARCHAR(500),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications(user_id, is_read, created_at DESC);

-- ─── ACTIVITY LOGS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    department_id VARCHAR(36) REFERENCES departments(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(30),
    resource_id VARCHAR(36),
    details TEXT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    device_type VARCHAR(30),
    browser VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created
    ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user
    ON activity_logs(user_id, created_at DESC);

-- ============================================================
-- SEED: Create super admin (password: Admin@PGurukul2024)
-- Change this password immediately after first login!
-- ============================================================
-- Password hash is generated for: Admin@PGurukul2024
-- You can generate a new one via: python database/seeds.py

COMMENT ON DATABASE current_database() IS 'PGURUKUL collaboration platform database';
