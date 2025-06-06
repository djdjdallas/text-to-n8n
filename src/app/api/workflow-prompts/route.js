// app/api/workflow-prompts/route.js
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const complexity = searchParams.get("complexity");
    const search = searchParams.get("search");

    // Build Supabase query
    let query = supabase.from("workflow_prompts").select("*");

    // Add filters
    if (category) {
      query = query.eq("category", category);
    }

    if (complexity) {
      query = query.eq("complexity_level", complexity);
    }

    if (search) {
      query = query.or(`prompt_text.ilike.%${search}%,services_involved.ilike.%${search}%`);
    }

    query = query.order("category").order("id");

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Group prompts by category for easier display
    const groupedPrompts = data.reduce((acc, prompt) => {
      if (!acc[prompt.category]) {
        acc[prompt.category] = [];
      }
      acc[prompt.category].push(prompt);
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      prompts: data,
      groupedPrompts,
      total: data.length,
    });
  } catch (error) {
    console.error("Error fetching workflow prompts:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflow prompts" },
      { status: 500 }
    );
  }
}

// Track usage of a prompt (placeholder for now)
export async function POST(request) {
  try {
    const { promptId } = await request.json();

    if (!promptId) {
      return NextResponse.json(
        { error: "Prompt ID is required" },
        { status: 400 }
      );
    }

    // For now, just return success since usage_count might not exist
    // You can implement tracking later if needed
    console.log(`Prompt ${promptId} was used`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error tracking prompt usage:", error);
    return NextResponse.json(
      { error: "Failed to track prompt usage" },
      { status: 500 }
    );
  }
}
