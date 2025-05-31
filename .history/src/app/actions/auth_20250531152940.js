"use server";

import { createServerActionClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function signInWithEmailAction(formData) {
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectTo = formData.get("redirectTo") || "/dashboard";

  // Await cookies() for Next.js 15+
  const cookieStore = await cookies();
  const supabase = createServerActionClient({ cookies: () => cookieStore });

  try {
    // Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        error: error.message || "Invalid login credentials",
        showResend: false,
      };
    }

    // Check if email is confirmed
    if (data.user && !data.user.email_confirmed_at) {
      return {
        error:
          "Your email address has not been confirmed yet. Please check your inbox for the confirmation link.",
        showResend: true,
        email: email,
      };
    }

    // Ensure the session is properly set
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return {
        error: "Failed to establish session. Please try again.",
        showResend: false,
      };
    }

    // Create or update user profile
    if (data.user) {
      // Pass the authorization token in headers for RLS
      const authToken = sessionData.session?.access_token;

      await fetch(
        `${
          process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
        }/api/user/profile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            id: data.user.id,
            email: data.user.email,
            full_name: data.user.user_metadata?.full_name || "",
          }),
        }
      );
    }

    // Revalidate the layout to ensure fresh data
    revalidatePath("/dashboard", "layout");
  } catch (error) {
    console.error("Sign in error:", error);
    return {
      error: "An unexpected error occurred. Please try again.",
      showResend: false,
    };
  }

  // Redirect happens outside the try-catch to avoid Next.js errors
  redirect(redirectTo);
}

export async function resendConfirmationAction(email) {
  if (!email) {
    return { error: "Email is required" };
  }

  try {
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
      }/api/auth/resend-confirmation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      }
    );

    if (response.ok) {
      return { success: true };
    } else {
      const data = await response.json();
      return { error: data.error || "Failed to resend confirmation email" };
    }
  } catch (error) {
    console.error("Resend confirmation error:", error);
    return {
      error: "An error occurred while resending the confirmation email",
    };
  }
}

export async function signOutAction() {
  const cookieStore = await cookies();
  const supabase = createServerActionClient({ cookies: () => cookieStore });

  await supabase.auth.signOut();

  redirect("/");
}
