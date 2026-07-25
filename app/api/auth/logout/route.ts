import { NextRequest, NextResponse } from "next/server";

/**
 * Logout the current user
 */
export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json(
      {
        success: true,
        message: "Logged out successfully",
      }
    );

    // Clear user_id cookie
    response.cookies.set("user_id", "", {
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[v0] Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
