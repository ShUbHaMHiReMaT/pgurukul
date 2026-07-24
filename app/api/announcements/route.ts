import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { announcements, users } from "@/lib/schema";
import { eq, or, and, desc } from "drizzle-orm";
import { logActivity, checkPermission } from "@/lib/auth-utils";
import { v4 as uuidv4 } from "uuid";

/**
 * Get announcements (department or global)
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

    const searchParams = request.nextUrl.searchParams;
    const departmentId = searchParams.get("departmentId");
    const includeGlobal = searchParams.get("includeGlobal") === "true";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = db
      .select()
      .from(announcements)
      .where(eq(announcements.isDeleted, false));

    if (departmentId && includeGlobal) {
      // Get department + global announcements
      query = query.where(
        or(
          eq(announcements.departmentId, departmentId),
          eq(announcements.isGlobal, true)
        )
      ) as any;
    } else if (departmentId) {
      // Only department announcements
      query = query.where(eq(announcements.departmentId, departmentId)) as any;
    } else if (includeGlobal) {
      // Only global
      query = query.where(eq(announcements.isGlobal, true)) as any;
    }

    const allAnnouncements = await query
      .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      success: true,
      announcements: allAnnouncements,
      total: allAnnouncements.length,
    });
  } catch (error) {
    console.error("[v0] Get announcements error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Create announcement (department leads and admins)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    let { content, departmentId, isGlobal } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Check if user can create announcements
    if (isGlobal) {
      // Only super admins can create global
      const hasPermission = await checkPermission(userId, "create_global_announcement");
      if (!hasPermission) {
        return NextResponse.json(
          { error: "Insufficient permissions for global announcements" },
          { status: 403 }
        );
      }
      departmentId = null;
    } else if (departmentId) {
      // Department leads and admins
      const hasPermission = await checkPermission(userId, "create_announcement", departmentId);
      if (!hasPermission) {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 }
        );
      }
    }

    const announcementId = uuidv4();
    await db.insert(announcements).values({
      id: announcementId,
      content,
      departmentId: departmentId || undefined,
      createdById: userId,
      isGlobal: isGlobal || false,
      isPinned: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Log activity
    await logActivity(
      userId,
      "create_announcement",
      "announcement",
      announcementId,
      departmentId || undefined,
      {
        isGlobal,
        content: content.substring(0, 100),
      }
    );

    return NextResponse.json(
      {
        success: true,
        announcement: {
          id: announcementId,
          content,
          departmentId,
          isGlobal,
          isPinned: false,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[v0] Create announcement error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
