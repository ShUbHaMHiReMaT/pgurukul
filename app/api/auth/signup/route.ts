import { NextRequest, NextResponse } from "next/server";
import { isValidEmail } from "@/lib/auth-utils";
import { v4 as uuidv4 } from "uuid";
import { mockUsers } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, username, inviteCode } = body;

    // Validation
    if (!email || !password || !username) {
      return NextResponse.json(
        { error: "Email, password, and username are required" },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Basic password validation (min 6 chars)
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check if email already exists in mock data
    const existingUser = mockUsers.find(u => u.email === email);
    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }

    // For demo mode, just accept the signup and add to mock data
    const userId = uuidv4();
    const newUser = {
      id: userId,
      email,
      username,
      fullName: username,
      role: 'intern' as const,
      departmentId: 'dept-1',
      avatarUrl: '',
      password, // Store plaintext in demo mode
    };

    // Add to mock users (in memory - will be lost on server restart)
    mockUsers.push(newUser);

    console.log('[v0] User created:', { userId, email, username });

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully",
        userId,
        user: {
          id: userId,
          email,
          username,
          role: 'intern',
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[v0] Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
