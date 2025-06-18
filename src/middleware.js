import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";

export async function middleware(req) {
  const res = NextResponse.next();

  try {
    // Create supabase client with async cookie handling
    const supabase = createMiddlewareClient({ req, res });

    // Always refresh the session to ensure we have the latest
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    
    // If we have a session but need to verify user attributes, get the latest user data
    if (session) {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        // Make sure we're using the most up-to-date user data
        session.user = userData.user;
      }
    }

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
  } catch (error) {
    // Log the error but don't crash the middleware
    console.error("Middleware error:", error);
    
    // If Supabase is down, allow access to non-protected routes
    const url = req.nextUrl;
    const pathname = url.pathname;
    const isProtectedRoute = pathname.startsWith("/dashboard");
    
    if (isProtectedRoute) {
      // If we can't verify auth and it's a protected route, redirect to login
      url.pathname = "/login";
      url.searchParams.set("redirectedFrom", pathname);
      return NextResponse.redirect(url);
    }
    
    // For non-protected routes, allow access
    return res;
  }
}

export const config = {
  matcher: [
    /*
     * Temporarily disable middleware to isolate Supabase connection issues
     * Uncomment the matcher below to re-enable middleware
     */
    // "/((?!_next/static|_next/image|favicon.ico|public|api/).*)",
  ],
};
