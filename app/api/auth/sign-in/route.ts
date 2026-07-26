import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mockUsers } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    let { email, password } = await request.json();
    email = email?.trim() || '';
    password = password?.trim() || '';
    console.log('[v0] Sign-in attempt:', { email });

    if (!email || !password) {
      console.log('[v0] Missing email or password');
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Find user by email (case-insensitive)
    const user = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      console.log('[v0] User not found:', email);
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Verify password (in development, just check if it matches)
    console.log('[v0] Password check - stored:', user.password, 'provided:', password, 'match:', user.password === password);
    if (user.password !== password) {
      console.log('[v0] Password mismatch for:', email);
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Set cookie with user ID
    const cookieStore = await cookies();
    cookieStore.set('user_id', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    console.log('[v0] Sign-in successful:', { userId: user.id, email });
    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("[v0] Sign-in error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
