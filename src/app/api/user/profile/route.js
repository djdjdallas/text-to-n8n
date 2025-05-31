import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Create a Supabase client with the service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

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

    // Check if profile already exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", id)
      .single();

    if (existingProfile) {
      // Profile already exists, update it
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .update({ full_name, email })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ profile: data });
    }

    // Create new profile
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .insert([{ id, email, full_name }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error("Error creating/updating user profile:", error);
    return NextResponse.json(
      { error: "Failed to create user profile" },
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
