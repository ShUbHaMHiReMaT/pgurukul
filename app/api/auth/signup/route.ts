import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, departments } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { validatePassword, isValidEmail, logActivity } from "@/lib/auth-utils";
import { v4 as uuidv4 } from "uuid";
import bcryptjs from "bcryptjs";

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

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: "Password does not meet requirements", details: passwordValidation.errors },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }

    // If inviteCode is provided, validate it and get department
    let departmentId: string | undefined = undefined;

    if (inviteCode) {
      const department = await db
        .select()
        .from(departments)
        .where(eq(departments.inviteCode, inviteCode))
        .limit(1);

      if (department.length === 0) {
        return NextResponse.json(
          { error: "Invalid invite code" },
          { status: 400 }
        );
      }

      departmentId = department[0].id;
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 10);

    // Create user
    const userId = uuidv4();
    const newUser = {
      id: userId,
      email,
      username,
      passwordHash: hashedPassword,
      role: departmentId ? "intern" : "super_admin", // First user without code is super admin
      departmentId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(users).values(newUser);

    // Log activity
    await logActivity(userId, "signup", "user", userId, departmentId);

    return NextResponse.json(
      {
        success: true,
        message: "User created successfully",
        userId,
        role: newUser.role,
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
