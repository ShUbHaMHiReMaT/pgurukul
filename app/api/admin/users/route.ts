import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, departments } from "@/lib/schema";
import { eq, like, ilike } from "drizzle-orm";
import { logActivity, checkPermission } from "@/lib/auth-utils";

/**
 * Get all users (admin only) with optional filtering and search
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is super admin
    const hasPermission = await checkPermission(userId, "view_all_users");
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const role = searchParams.get("role");
    const departmentId = searchParams.get("departmentId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = db.select().from(users);

    // Apply filters
    if (search) {
      query = query.where(
        ilike(users.email, `%${search}%`)
      ) as any;
    }

    if (role) {
      query = query.where(eq(users.role, role)) as any;
    }

    if (departmentId) {
      query = query.where(eq(users.departmentId, departmentId)) as any;
    }

    // Get total count
    const allUsers = await query;
    const total = allUsers.length;

    // Apply pagination
    const paginatedUsers = allUsers.slice(offset, offset + limit);

    // Remove sensitive data
    const sanitizedUsers = paginatedUsers.map((user) => ({
      ...user,
      passwordHash: undefined,
    }));

    return NextResponse.json({
      success: true,
      users: sanitizedUsers,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[v0] Get users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Update user (admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is super admin
    const hasPermission = await checkPermission(userId, "manage_users");
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId: targetUserId, ...updates } = body;

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Target user ID is required" },
        { status: 400 }
      );
    }

    // Update user
    await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUserId));

    // Log activity
    await logActivity(
      userId,
      "update_user",
      "user",
      targetUserId,
      undefined,
      { changes: updates }
    );

    return NextResponse.json(
      { success: true, message: "User updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[v0] Update user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Delete user (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is super admin
    const hasPermission = await checkPermission(userId, "delete_users");
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const targetUserId = searchParams.get("id");

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Target user ID is required" },
        { status: 400 }
      );
    }

    // Prevent deleting yourself
    if (userId === targetUserId) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    // Soft delete
    await db
      .update(users)
      .set({
        isDisabled: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUserId));

    // Log activity
    await logActivity(
      userId,
      "delete_user",
      "user",
      targetUserId
    );

    return NextResponse.json(
      { success: true, message: "User deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[v0] Delete user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
