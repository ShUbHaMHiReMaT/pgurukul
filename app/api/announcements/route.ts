import { NextRequest, NextResponse } from "next/server";

// Mark as dynamic for development/demo mode
export const dynamic = "force-dynamic";

/**
 * Get announcements (demo mode)
 */
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      announcements: [
        {
          id: "ann-1",
          title: "Welcome to PGURUKUL",
          content: "Welcome to the new collaboration platform.",
          scope: "global",
          isPinned: true,
          createdAt: new Date("2024-01-01"),
        },
        {
          id: "ann-2",
          title: "Department Meeting",
          content: "Team meeting tomorrow at 2 PM.",
          scope: "department",
          isPinned: false,
          createdAt: new Date("2024-01-15"),
        },
      ],
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
 * Create announcement (demo mode)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, scope } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        announcement: {
          id: `ann-${Date.now()}`,
          content,
          scope: scope || "department",
          isPinned: false,
          createdAt: new Date(),
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
