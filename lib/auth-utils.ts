import { headers } from "next/headers";
import { db } from "./db";
import { users, activityLogs } from "./schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export interface AuthenticatedUser {
  id: string;
  email: string;
  username?: string;
  role: string;
  departmentId?: string;
  fullName?: string;
  avatarUrl?: string;
}

/**
 * Get the current user from session cookie
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const headersList = await headers();
    const cookie = headersList.get("cookie");

    if (!cookie) {
      return null;
    }

    // Parse the session cookie (would be handled by Better Auth middleware)
    // For now, return null - Better Auth middleware will populate this
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if user has permission for an action
 */
export async function checkPermission(
  userId: string,
  action: string,
  resourceDepartmentId?: string
): Promise<boolean> {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.length === 0) {
    return false;
  }

  const userRecord = user[0];

  // Super admin can do everything
  if (userRecord.role === "super_admin") {
    return true;
  }

  // Check department access
  if (resourceDepartmentId && userRecord.departmentId !== resourceDepartmentId) {
    // Super admin can access any department
    if (userRecord.role !== "super_admin") {
      return false;
    }
  }

  // Role-based permissions
  const permissions: Record<string, string[]> = {
    super_admin: ["*"], // All permissions
    department_lead: [
      "create_announcement",
      "create_task",
      "manage_department",
      "invite_user",
    ],
    intern: ["send_message", "upload_file", "update_task_status"],
  };

  const userPermissions = permissions[userRecord.role] || [];

  return userPermissions.includes("*") || userPermissions.includes(action);
}

/**
 * Log user activity
 */
export async function logActivity(
  userId: string,
  action: string,
  entityType?: string,
  entityId?: string,
  departmentId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const headersList = await headers();
    const ipAddress = headersList.get("x-forwarded-for") ||
      headersList.get("x-real-ip") || "unknown";
    const userAgent = headersList.get("user-agent") || "unknown";

    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId,
      action,
      entityType,
      entityId,
      departmentId,
      ipAddress,
      userAgent,
      metadata: metadata || {},
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("[v0] Failed to log activity:", error);
  }
}

/**
 * Generate invite code for department
 */
export function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push("Password must contain at least one special character (!@#$%^&*)");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if email is valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
