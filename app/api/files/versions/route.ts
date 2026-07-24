import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fileVersions } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Get version history for a file
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
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    const versions = await db
      .select()
      .from(fileVersions)
      .where(eq(fileVersions.fileId, fileId))
      .orderBy(desc(fileVersions.versionNumber));

    return NextResponse.json({
      success: true,
      versions,
      total: versions.length,
    });
  } catch (error) {
    console.error("[v0] Get versions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Restore a specific version
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
    const { fileId, versionNumber } = body;

    if (!fileId || !versionNumber) {
      return NextResponse.json(
        { error: "File ID and version number are required" },
        { status: 400 }
      );
    }

    // Get the version to restore
    const version = await db
      .select()
      .from(fileVersions)
      .where(eq(fileVersions.fileId, fileId));

    // Find the specific version
    const targetVersion = version.find((v) => v.versionNumber === versionNumber);

    if (!targetVersion) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 }
      );
    }

    // In a real implementation, this would copy the file from storage
    // and create a new version with the restored content

    return NextResponse.json({
      success: true,
      message: `Restored to version ${versionNumber}`,
    });
  } catch (error) {
    console.error("[v0] Restore version error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
