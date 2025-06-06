// app/api/workflow-prompts/route.js
import { NextResponse } from "next/server";
import { Pool } from "pg";

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const complexity = searchParams.get("complexity");
    const search = searchParams.get("search");

    let query = "SELECT * FROM workflow_prompts WHERE 1=1";
    const params = [];

    // Add filters
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    if (complexity) {
      params.push(complexity);
      query += ` AND complexity_level = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (prompt_text ILIKE $${params.length} OR services_involved ILIKE $${params.length})`;
    }

    query += " ORDER BY category, id";

    const result = await pool.query(query, params);

    // Group prompts by category for easier display
    const groupedPrompts = result.rows.reduce((acc, prompt) => {
      if (!acc[prompt.category]) {
        acc[prompt.category] = [];
      }
      acc[prompt.category].push(prompt);
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      prompts: result.rows,
      groupedPrompts,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("Error fetching workflow prompts:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflow prompts" },
      { status: 500 }
    );
  }
}

// Track usage of a prompt
export async function POST(request) {
  try {
    const { promptId } = await request.json();

    if (!promptId) {
      return NextResponse.json(
        { error: "Prompt ID is required" },
        { status: 400 }
      );
    }

    // You can add a usage_count column to track popularity
    const query = `
      UPDATE workflow_prompts 
      SET usage_count = COALESCE(usage_count, 0) + 1 
      WHERE id = $1
    `;

    await pool.query(query, [promptId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error tracking prompt usage:", error);
    return NextResponse.json(
      { error: "Failed to track prompt usage" },
      { status: 500 }
    );
  }
}
