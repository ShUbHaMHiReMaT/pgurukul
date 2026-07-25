import { NextRequest, NextResponse } from "next/server";

// Protected routes that require authentication
const protectedRoutes = [
  "/dashboard",
  "/admin",
  "/api/protected",
  "/departments",
  "/files",
  "/chat",
  "/tasks",
  "/announcements",
];

// Public routes
const publicRoutes = ["/", "/login", "/signup", "/api/auth"];

export async function POST(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // If it's a protected route, check for authentication
  if (isProtectedRoute) {
    const sessionCookie = request.cookies.get("auth_session");

    if (!sessionCookie) {
      // Redirect to login if not authenticated
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}
