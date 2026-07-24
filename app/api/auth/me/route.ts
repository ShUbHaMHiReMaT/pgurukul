import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

/**
 * Get the current authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // For now, this is a placeholder. Better Auth middleware would populate the user
    // In production, this would use Better Auth's session to get the current user
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        role: users.role,
        departmentId: users.departmentId,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: user[0],
    });
  } catch (error) {
    console.error("[v0] Get current user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
