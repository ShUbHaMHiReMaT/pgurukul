import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { logActivity } from "@/lib/auth-utils";

/**
 * Get a specific task
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const taskId = params.id;

    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (task.length === 0) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      task: task[0],
    });
  } catch (error) {
    console.error("[v0] Get task error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Update task (status, priority, assignees, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const taskId = params.id;
    const body = await request.json();
    const { status, priority, assigneeIds, dueDate, title, description } = body;

    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (task.length === 0) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Update task
    await db
      .update(tasks)
      .set({
        ...(status && { status }),
        ...(priority && { priority }),
        ...(assigneeIds && { assigneeIds: JSON.stringify(assigneeIds) }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(title && { title }),
        ...(description !== undefined && { description }),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    // Log activity
    await logActivity(
      userId,
      "update_task",
      "task",
      taskId,
      task[0].departmentId,
      {
        changes: {
          status: status || task[0].status,
          priority: priority || task[0].priority,
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: "Task updated successfully",
    });
  } catch (error) {
    console.error("[v0] Update task error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Delete a task (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const taskId = params.id;

    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (task.length === 0) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Soft delete
    await db
      .update(tasks)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    // Log activity
    await logActivity(
      userId,
      "delete_task",
      "task",
      taskId,
      task[0].departmentId,
      { title: task[0].title }
    );

    return NextResponse.json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("[v0] Delete task error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
