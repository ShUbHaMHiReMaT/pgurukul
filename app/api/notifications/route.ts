import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

/**
 * Get notifications for current user
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
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId));

    if (unreadOnly) {
      query = query.where(eq(notifications.isRead, false)) as any;
    }

    const userNotifications = await query
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    // Count unread
    const unreadCount = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      );

    return NextResponse.json({
      success: true,
      notifications: userNotifications,
      unreadCount: unreadCount.length,
      total: userNotifications.length,
    });
  } catch (error) {
    console.error("[v0] Get notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Create notification (called internally)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, type, relatedId, content } = body;

    if (!userId || !type) {
      return NextResponse.json(
        { error: "User ID and type are required" },
        { status: 400 }
      );
    }

    const notificationId = uuidv4();
    await db.insert(notifications).values({
      id: notificationId,
      userId,
      type,
      relatedId: relatedId || undefined,
      content: content || undefined,
      isRead: false,
      createdAt: new Date(),
    });

    return NextResponse.json(
      {
        success: true,
        notification: {
          id: notificationId,
          userId,
          type,
          isRead: false,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[v0] Create notification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
