import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { files } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { logActivity } from "@/lib/auth-utils";

/**
 * Get a specific file
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

    const fileId = params.id;

    const file = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (file.length === 0) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      file: file[0],
    });
  } catch (error) {
    console.error("[v0] Get file error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Update file metadata (rename, etc.)
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

    const fileId = params.id;
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: "File name is required" },
        { status: 400 }
      );
    }

    // Update file
    await db
      .update(files)
      .set({
        name,
        updatedAt: new Date(),
      })
      .where(eq(files.id, fileId));

    // Log activity
    const file = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (file.length > 0) {
      await logActivity(
        userId,
        "rename_file",
        "file",
        fileId,
        file[0].departmentId,
        { newName: name }
      );
    }

    return NextResponse.json({
      success: true,
      message: "File updated successfully",
    });
  } catch (error) {
    console.error("[v0] Update file error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Delete a file (soft delete)
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

    const fileId = params.id;

    // Soft delete
    const file = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (file.length === 0) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    await db
      .update(files)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(files.id, fileId));

    // Log activity
    await logActivity(
      userId,
      "delete_file",
      "file",
      fileId,
      file[0].departmentId,
      { filename: file[0].name }
    );

    return NextResponse.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("[v0] Delete file error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
