import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req) {
  try {
    const { id, email, full_name } = await req.json();

    // Validate required fields
    if (!id || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get auth token from headers or cookies
    const authorization = req.headers.get("authorization");
    const cookieStore = await cookies();

    // Create Supabase client - use service role key to bypass RLS for profile creation
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseServiceKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is not set");
      // Fall back to anon key with RLS
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // Try with user's auth token
      if (authorization) {
        const token = authorization.replace("Bearer ", "");
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser(token);

        if (authError || !user || user.id !== id) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
      }
    }

    // Use service role key for admin operations (bypasses RLS)
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Check if profile already exists
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", id)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking profile:", checkError);
      throw checkError;
    }

    if (existingProfile) {
      // Profile already exists, update it
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .update({
          full_name: full_name || null,
          email,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating profile:", error);
        throw error;
      }

      return NextResponse.json({ profile: data });
    }

    // Create new profile
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .insert([
        {
          id,
          email,
          full_name: full_name || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating profile:", error);
      throw error;
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error("Error creating/updating user profile:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create user profile" },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    // Get the user ID from the session
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Use service role key to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Profile not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 }
    );
  }
}
