import { NextResponse } from "next/server";
import { mockMessages, mockUsers } from "@/lib/mock-data";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");

    if (!departmentId) {
      return NextResponse.json(
        { error: "departmentId is required" },
        { status: 400 }
      );
    }

    // Filter messages by department and include sender info
    const messages = mockMessages
      .filter(m => m.departmentId === departmentId)
      .map(msg => {
        const sender = mockUsers.find(u => u.id === msg.senderId);
        return {
          ...msg,
          sender: sender ? { id: sender.id, username: sender.username, fullName: sender.fullName } : null,
        };
      });

    return NextResponse.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("[v0] Get messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
