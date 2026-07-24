import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  uuid,
  primaryKey,
  foreignKey,
  index,
  unique,
  jsonb,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

// Users Table
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    username: varchar("username", { length: 100 }).unique(),
    passwordHash: text("password_hash"),
    fullName: varchar("full_name", { length: 255 }),
    avatarUrl: text("avatar_url"),
    role: varchar("role", { length: 50 }).notNull().default("intern"), // super_admin, department_lead, intern
    departmentId: uuid("department_id"),
    isDisabled: boolean("is_disabled").default(false),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("users_email_idx").on(table.email),
    index("users_department_id_idx").on(table.departmentId),
    index("users_role_idx").on(table.role),
  ]
);

// Departments Table
export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    inviteCode: varchar("invite_code", { length: 50 }).notNull().unique(),
    departmentLeadId: uuid("department_lead_id"),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("departments_invite_code_idx").on(table.inviteCode),
    index("departments_lead_id_idx").on(table.departmentLeadId),
  ]
);

// Files Table
export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }),
    size: integer("size"),
    storageKey: text("storage_key").notNull(), // Path in storage
    departmentId: uuid("department_id").notNull(),
    uploaderId: uuid("uploader_id").notNull(),
    version: integer("version").default(1),
    fileHash: varchar("file_hash", { length: 255 }),
    checksum: varchar("checksum", { length: 255 }),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("files_department_id_idx").on(table.departmentId),
    index("files_uploader_id_idx").on(table.uploaderId),
    index("files_deleted_idx").on(table.isDeleted),
    foreignKey({
      columns: [table.departmentId],
      foreignColumns: [departments.id],
    }),
    foreignKey({
      columns: [table.uploaderId],
      foreignColumns: [users.id],
    }),
  ]
);

// File Versions Table
export const fileVersions = pgTable(
  "file_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fileId: uuid("file_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    storageKey: text("storage_key").notNull(),
    size: integer("size"),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  },
  (table) => [
    index("file_versions_file_id_idx").on(table.fileId),
    foreignKey({
      columns: [table.fileId],
      foreignColumns: [files.id],
    }),
  ]
);

// Messages Table
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    content: text("content").notNull(),
    departmentId: uuid("department_id").notNull(),
    senderId: uuid("sender_id").notNull(),
    parentMessageId: uuid("parent_message_id"), // For replies/threads
    isPinned: boolean("is_pinned").default(false),
    isDeleted: boolean("is_deleted").default(false),
    editedAt: timestamp("edited_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("messages_department_id_idx").on(table.departmentId),
    index("messages_sender_id_idx").on(table.senderId),
    index("messages_created_at_idx").on(table.createdAt),
    foreignKey({
      columns: [table.departmentId],
      foreignColumns: [departments.id],
    }),
    foreignKey({
      columns: [table.senderId],
      foreignColumns: [users.id],
    }),
  ]
);

// Mentions Table (for @mentions)
export const mentions = pgTable(
  "mentions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id").notNull(),
    mentionedUserId: uuid("mentioned_user_id").notNull(),
    isRead: boolean("is_read").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("mentions_message_id_idx").on(table.messageId),
    index("mentions_user_id_idx").on(table.mentionedUserId),
    foreignKey({
      columns: [table.messageId],
      foreignColumns: [messages.id],
    }),
    foreignKey({
      columns: [table.mentionedUserId],
      foreignColumns: [users.id],
    }),
  ]
);

// Tasks Table
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    departmentId: uuid("department_id").notNull(),
    createdById: uuid("created_by_id").notNull(),
    assigneeIds: text("assignee_ids").default("[]"), // JSON array of user IDs
    status: varchar("status", { length: 50 }).default("not_started"), // not_started, in_progress, review, completed
    priority: varchar("priority", { length: 50 }).default("medium"), // low, medium, high
    dueDate: timestamp("due_date"),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("tasks_department_id_idx").on(table.departmentId),
    index("tasks_status_idx").on(table.status),
    foreignKey({
      columns: [table.departmentId],
      foreignColumns: [departments.id],
    }),
    foreignKey({
      columns: [table.createdById],
      foreignColumns: [users.id],
    }),
  ]
);

// Announcements Table
export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    content: text("content").notNull(),
    departmentId: uuid("department_id"), // NULL for global announcements
    createdById: uuid("created_by_id").notNull(),
    isPinned: boolean("is_pinned").default(false),
    isGlobal: boolean("is_global").default(false),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("announcements_department_id_idx").on(table.departmentId),
    index("announcements_is_global_idx").on(table.isGlobal),
    foreignKey({
      columns: [table.createdById],
      foreignColumns: [users.id],
    }),
  ]
);

// Notifications Table
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    type: varchar("type", { length: 50 }).notNull(), // mention, task_assigned, announcement, file_shared, reply
    relatedId: uuid("related_id"), // ID of message, task, etc.
    content: text("content"),
    isRead: boolean("is_read").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notifications_user_id_idx").on(table.userId),
    index("notifications_is_read_idx").on(table.isRead),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
    }),
  ]
);

// Activity Logs Table
export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id"),
    action: varchar("action", { length: 100 }).notNull(), // login, file_upload, message_send, etc.
    entityType: varchar("entity_type", { length: 100 }), // user, file, message, task, etc.
    entityId: uuid("entity_id"),
    departmentId: uuid("department_id"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata"), // Additional context as JSON
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("activity_logs_user_id_idx").on(table.userId),
    index("activity_logs_action_idx").on(table.action),
    index("activity_logs_created_at_idx").on(table.createdAt),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
    }),
  ]
);

// Sessions Table (for Better Auth)
export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: uuid("user_id").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
    }),
  ]
);

// Type exports for use in the application
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;

export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
