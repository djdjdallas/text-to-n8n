import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Refresh session if expired - required for Server Components
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Define protected routes
  const protectedRoutes = ["/dashboard"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    req.nextUrl.pathname.startsWith(route)
  );

  // Define auth routes
  const authRoutes = ["/login", "/signup"];
  const isAuthRoute = authRoutes.some(
    (route) =>
      req.nextUrl.pathname === route || req.nextUrl.pathname.startsWith(route)
  );

  // Allow access to auth callback and confirmation pages
  const authCallbackRoutes = [
    "/auth/callback",
    "/auth/confirm-email",
    "/auth/error",
  ];
  const isAuthCallbackRoute = authCallbackRoutes.some((route) =>
    req.nextUrl.pathname.startsWith(route)
  );

  // Always allow access to auth callback routes
  if (isAuthCallbackRoute) {
    return res;
  }

  // Redirect logic for protected routes
  if (isProtectedRoute) {
    // No user at all - redirect to login
    if (!user) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("redirectedFrom", req.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // User exists but email not confirmed - redirect to confirmation page
    if (user && !user.email_confirmed_at) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/auth/confirm-email";
      redirectUrl.searchParams.set(
        "message",
        "Please confirm your email to access this page"
      );
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Redirect authenticated and confirmed users away from auth routes
  if (isAuthRoute && user && user.email_confirmed_at) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (unless you want to protect them)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|api/generate|api/validate|api/deploy).*)",
  ],
};
