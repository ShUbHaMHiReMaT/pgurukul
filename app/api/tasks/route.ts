import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, users } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { logActivity, checkPermission } from "@/lib/auth-utils";
import { v4 as uuidv4 } from "uuid";

/**
 * Get tasks for a department with filters
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
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const assignedTo = searchParams.get("assignedTo");

    if (!departmentId) {
      return NextResponse.json(
        { error: "Department ID is required" },
        { status: 400 }
      );
    }

    let query = db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.departmentId, departmentId),
          eq(tasks.isDeleted, false)
        )
      );

    if (status) {
      query = query.where(eq(tasks.status, status)) as any;
    }

    if (priority) {
      query = query.where(eq(tasks.priority, priority)) as any;
    }

    const allTasks = await query;

    // Filter by assignee if specified
    let filtered = allTasks;
    if (assignedTo) {
      filtered = allTasks.filter((t) => {
        const assignees = JSON.parse(t.assigneeIds || "[]");
        return assignees.includes(assignedTo);
      });
    }

    return NextResponse.json({
      success: true,
      tasks: filtered,
      total: filtered.length,
    });
  } catch (error) {
    console.error("[v0] Get tasks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Create a new task (department leads and admins only)
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
    const { title, description, departmentId, assigneeIds, priority, dueDate } = body;

    if (!title || !departmentId) {
      return NextResponse.json(
        { error: "Title and department ID are required" },
        { status: 400 }
      );
    }

    // Check permission (only department leads and admins)
    const hasPermission = await checkPermission(userId, "create_task", departmentId);
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const taskId = uuidv4();
    await db.insert(tasks).values({
      id: taskId,
      title,
      description: description || undefined,
      departmentId,
      createdById: userId,
      assigneeIds: JSON.stringify(assigneeIds || []),
      priority: priority || "medium",
      dueDate: dueDate ? new Date(dueDate) : undefined,
      status: "not_started",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Log activity
    await logActivity(
      userId,
      "create_task",
      "task",
      taskId,
      departmentId,
      { title }
    );

    return NextResponse.json(
      {
        success: true,
        task: {
          id: taskId,
          title,
          departmentId,
          status: "not_started",
          priority,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[v0] Create task error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
