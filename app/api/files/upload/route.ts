import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { files, fileVersions } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { logActivity } from "@/lib/auth-utils";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

// Max file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/zip",
  "text/csv",
  "text/plain",
];

/**
 * Upload a file
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

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const departmentId = formData.get("departmentId") as string;

    if (!file || !departmentId) {
      return NextResponse.json(
        { error: "File and department ID are required" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large (max 50MB)" },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 }
      );
    }

    // Read file content
    const fileBuffer = await file.arrayBuffer();
    const fileHash = crypto
      .createHash("sha256")
      .update(Buffer.from(fileBuffer))
      .digest("hex");

    // Check for duplicate file (same hash in department)
    const existingFile = await db
      .select()
      .from(files)
      .where(eq(files.fileHash, fileHash));

    let fileId: string;
    let version = 1;

    if (existingFile.length > 0 && existingFile[0].departmentId === departmentId) {
      // Update existing file with new version
      fileId = existingFile[0].id;
      version = (existingFile[0].version || 1) + 1;

      // Create version entry
      await db.insert(fileVersions).values({
        id: uuidv4(),
        fileId,
        versionNumber: version,
        storageKey: `${departmentId}/${fileId}/v${version}/${file.name}`,
        size: file.size,
        uploadedAt: new Date(),
      });

      // Update file record
      await db
        .update(files)
        .set({
          version,
          size: file.size,
          updatedAt: new Date(),
        })
        .where(eq(files.id, fileId));
    } else {
      // Create new file
      fileId = uuidv4();
      const storageKey = `${departmentId}/${fileId}/v1/${file.name}`;

      await db.insert(files).values({
        id: fileId,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        storageKey,
        departmentId,
        uploaderId: userId,
        version: 1,
        fileHash,
        checksum: fileHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create first version
      await db.insert(fileVersions).values({
        id: uuidv4(),
        fileId,
        versionNumber: 1,
        storageKey,
        size: file.size,
        uploadedAt: new Date(),
      });
    }

    // Log activity
    await logActivity(
      userId,
      version > 1 ? "file_version_upload" : "file_upload",
      "file",
      fileId,
      departmentId,
      {
        filename: file.name,
        size: file.size,
        version,
      }
    );

    return NextResponse.json(
      {
        success: true,
        file: {
          id: fileId,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          version,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[v0] File upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Get files for a department
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
    const search = searchParams.get("search");

    if (!departmentId) {
      return NextResponse.json(
        { error: "Department ID is required" },
        { status: 400 }
      );
    }

    let query = db
      .select()
      .from(files)
      .where(eq(files.departmentId, departmentId));

    if (search) {
      query = query.where(eq(files.name, search)) as any;
    }

    const departmentFiles = await query;

    return NextResponse.json({
      success: true,
      files: departmentFiles,
      total: departmentFiles.length,
    });
  } catch (error) {
    console.error("[v0] Get files error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
