import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { departments, users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { generateInviteCode, logActivity } from "@/lib/auth-utils";
import { v4 as uuidv4 } from "uuid";

/**
 * Create a new department with invite code
 * Only super admins can create departments
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, departmentLeadEmail } = body;
    const createdBy = request.headers.get("x-user-id");

    if (!name) {
      return NextResponse.json(
        { error: "Department name is required" },
        { status: 400 }
      );
    }

    if (!createdBy) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify creator is super admin
    const creator = await db
      .select()
      .from(users)
      .where(eq(users.id, createdBy))
      .limit(1);

    if (creator.length === 0 || creator[0].role !== "super_admin") {
      return NextResponse.json(
        { error: "Only super admins can create departments" },
        { status: 403 }
      );
    }

    // Generate unique invite code
    let inviteCode = generateInviteCode();
    let isUnique = false;

    while (!isUnique) {
      const existing = await db
        .select()
        .from(departments)
        .where(eq(departments.inviteCode, inviteCode))
        .limit(1);

      if (existing.length === 0) {
        isUnique = true;
      } else {
        inviteCode = generateInviteCode();
      }
    }

    // Find department lead if provided
    let departmentLeadId: string | undefined = undefined;

    if (departmentLeadEmail) {
      const lead = await db
        .select()
        .from(users)
        .where(eq(users.email, departmentLeadEmail))
        .limit(1);

      if (lead.length > 0) {
        departmentLeadId = lead[0].id;
      }
    }

    // Create department
    const departmentId = uuidv4();
    await db.insert(departments).values({
      id: departmentId,
      name,
      inviteCode,
      departmentLeadId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Log activity
    await logActivity(
      createdBy,
      "create_department",
      "department",
      departmentId
    );

    return NextResponse.json(
      {
        success: true,
        department: {
          id: departmentId,
          name,
          inviteCode,
          departmentLeadId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[v0] Create department error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Get all departments (admin only)
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

    // Verify user is super admin
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0 || user[0].role !== "super_admin") {
      return NextResponse.json(
        { error: "Only super admins can view all departments" },
        { status: 403 }
      );
    }

    const allDepartments = await db.select().from(departments);

    return NextResponse.json({
      success: true,
      departments: allDepartments,
    });
  } catch (error) {
    console.error("[v0] Get departments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
