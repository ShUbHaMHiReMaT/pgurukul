import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { messages, mentions, users } from "@/lib/schema";
import { eq, desc, and } from "drizzle-orm";
import { logActivity } from "@/lib/auth-utils";
import { v4 as uuidv4 } from "uuid";

/**
 * Get messages for a department
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
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!departmentId) {
      return NextResponse.json(
        { error: "Department ID is required" },
        { status: 400 }
      );
    }

    // Get messages
    const departmentMessages = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.departmentId, departmentId),
          eq(messages.isDeleted, false)
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);

    // Get sender information for each message
    const messageIds = departmentMessages.map((m) => m.id);

    let mentionData: any[] = [];
    if (messageIds.length > 0) {
      mentionData = await db
        .select()
        .from(mentions)
        .where(
          and(
            // mentions for these messages
          )
        );
    }

    return NextResponse.json({
      success: true,
      messages: departmentMessages.reverse(),
      total: departmentMessages.length,
    });
  } catch (error) {
    console.error("[v0] Get messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Send a message
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
    const { departmentId, content, parentMessageId } = body;

    if (!departmentId || !content) {
      return NextResponse.json(
        { error: "Department ID and content are required" },
        { status: 400 }
      );
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { error: "Message too long (max 5000 characters)" },
        { status: 400 }
      );
    }

    // Create message
    const messageId = uuidv4();
    await db.insert(messages).values({
      id: messageId,
      content,
      departmentId,
      senderId: userId,
      parentMessageId: parentMessageId || undefined,
      createdAt: new Date(),
    });

    // Extract and create mentions (@username)
    const mentionPattern = /@(\w+)/g;
    const mentionMatches = content.matchAll(mentionPattern);

    for (const match of mentionMatches) {
      const username = match[1];
      const mentionedUser = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (mentionedUser.length > 0) {
        await db.insert(mentions).values({
          id: uuidv4(),
          messageId,
          mentionedUserId: mentionedUser[0].id,
          createdAt: new Date(),
        });
      }
    }

    // Log activity
    await logActivity(
      userId,
      "send_message",
      "message",
      messageId,
      departmentId,
      { content: content.substring(0, 100) }
    );

    return NextResponse.json(
      {
        success: true,
        message: {
          id: messageId,
          content,
          departmentId,
          senderId: userId,
          parentMessageId,
          createdAt: new Date(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[v0] Send message error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
