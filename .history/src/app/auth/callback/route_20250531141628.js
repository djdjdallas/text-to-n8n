import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(req) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (code) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    try {
      // Exchange the code for a session
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("Error exchanging code for session:", error);
        return NextResponse.redirect(
          new URL(
            "/auth/error?message=" + encodeURIComponent(error.message),
            requestUrl.origin
          )
        );
      }

      // Get the user to ensure they're properly authenticated
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("Error getting user after code exchange:", userError);
        return NextResponse.redirect(
          new URL(
            "/auth/error?message=Failed to authenticate",
            requestUrl.origin
          )
        );
      }

      // Check if email is confirmed
      if (!user.email_confirmed_at) {
        return NextResponse.redirect(
          new URL(
            "/auth/confirm-email?message=Please confirm your email",
            requestUrl.origin
          )
        );
      }

      // Successful confirmation - redirect to dashboard or next URL
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    } catch (error) {
      console.error("Callback error:", error);
      return NextResponse.redirect(
        new URL("/auth/error?message=Authentication failed", requestUrl.origin)
      );
    }
  }

  // No code provided - redirect to home
  return NextResponse.redirect(new URL("/", requestUrl.origin));
}
