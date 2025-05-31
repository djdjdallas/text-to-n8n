import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";

export async function middleware(req) {
  const res = NextResponse.next();

  // Create supabase client
  const supabase = createMiddlewareClient({ req, res });

  // Refresh session if expired
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  // Log for debugging
  console.log("Middleware session check:", {
    path: req.nextUrl.pathname,
    hasSession: !!session,
    sessionError: sessionError?.message,
  });

  // Define route types
  const protectedRoutes = ["/dashboard"];
  const authRoutes = ["/login", "/signup"];
  const authCallbackRoutes = [
    "/auth/callback",
    "/auth/confirm-email",
    "/auth/error",
  ];

  const isProtectedRoute = protectedRoutes.some((route) =>
    req.nextUrl.pathname.startsWith(route)
  );
  const isAuthRoute = authRoutes.some((route) =>
    req.nextUrl.pathname.startsWith(route)
  );
  const isAuthCallbackRoute = authCallbackRoutes.some((route) =>
    req.nextUrl.pathname.startsWith(route)
  );

  // Always allow access to auth callback routes
  if (isAuthCallbackRoute) {
    return res;
  }

  // Protected route logic
  if (isProtectedRoute) {
    if (!session) {
      // No session - redirect to login
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("redirectedFrom", req.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // We have a session - check if user data is available
    if (session.user) {
      // Check email confirmation
      if (!session.user.email_confirmed_at) {
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = "/auth/confirm-email";
        redirectUrl.searchParams.set(
          "message",
          "Please confirm your email to access this page"
        );
        return NextResponse.redirect(redirectUrl);
      }
    }

    // Session exists and user is confirmed (or still loading) - allow access
    return res;
  }

  // Redirect authenticated users away from auth routes
  if (isAuthRoute && session?.user?.email_confirmed_at) {
    const redirectedFrom = req.nextUrl.searchParams.get("redirectedFrom");
    const redirectUrl = req.nextUrl.clone();

    if (redirectedFrom) {
      redirectUrl.pathname = decodeURIComponent(redirectedFrom);
      redirectUrl.searchParams.delete("redirectedFrom");
    } else {
      redirectUrl.pathname = "/dashboard";
    }

    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public|api/generate|api/validate|api/deploy).*)",
  ],
};
