import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";

export async function middleware(req) {
  const res = NextResponse.next();

  // Create supabase client with async cookie handling
  const supabase = createMiddlewareClient({ req, res });

  // Always refresh the session to ensure we have the latest
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  // Log for debugging
  console.log("Middleware session check:", {
    path: req.nextUrl.pathname,
    hasSession: !!session,
    userId: session?.user?.id,
    emailConfirmed: session?.user?.email_confirmed_at ? true : false,
  });

  const url = req.nextUrl;
  const pathname = url.pathname;

  // Define route types
  const isProtectedRoute = pathname.startsWith("/dashboard");
  const isAuthRoute = pathname === "/login" || pathname === "/signup";
  const isAuthCallbackRoute = pathname.startsWith("/auth/");

  // Always allow auth callback routes
  if (isAuthCallbackRoute) {
    return res;
  }

  // Handle protected routes
  if (isProtectedRoute) {
    // No session at all - redirect to login
    if (!session) {
      url.pathname = "/login";
      url.searchParams.set("redirectedFrom", pathname);
      return NextResponse.redirect(url);
    }

    // Check email confirmation
    if (session.user && !session.user.email_confirmed_at) {
      url.pathname = "/auth/confirm-email";
      url.searchParams.set(
        "message",
        "Please confirm your email to access this page"
      );
      return NextResponse.redirect(url);
    }

    // User is authenticated and confirmed - allow access
    return res;
  }

  // Handle auth routes (login/signup)
  if (isAuthRoute) {
    // If user is fully authenticated and confirmed, redirect to dashboard
    if (session?.user?.email_confirmed_at) {
      const redirectedFrom = url.searchParams.get("redirectedFrom");

      if (redirectedFrom && !redirectedFrom.startsWith("/auth/")) {
        url.pathname = redirectedFrom;
        url.searchParams.delete("redirectedFrom");
      } else {
        url.pathname = "/dashboard";
      }

      return NextResponse.redirect(url);
    }
  }

  // For all other routes, allow access
  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes
     */
    "/((?!_next/static|_next/image|favicon.ico|public|api/).*)",
  ],
};
