// src/app/api/test/vector-search/route.js
import { VectorStore } from "@/lib/rag/documentationStore";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { query, platform = "n8n" } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const vectorStore = new VectorStore();

    // Search for similar documents
    const results = await vectorStore.searchSimilar(query, platform, {
      limit: 5,
      threshold: 0.5,
    });

    return NextResponse.json({
      query,
      platform,
      resultsCount: results.length,
      results: results.map((doc) => ({
        title: doc.title,
        content: doc.content.substring(0, 200) + "...",
        docType: doc.doc_type,
        similarity: doc.similarity,
        metadata: doc.metadata,
      })),
    });
  } catch (error) {
    console.error("Vector search error:", error);
    return NextResponse.json(
      { error: "Search failed", details: error.message },
      { status: 500 }
    );
  }
}

// Test this endpoint with:
// curl -X POST http://localhost:3000/api/test/vector-search \
//   -H "Content-Type: application/json" \
//   -d '{"query": "email to slack notification", "platform": "n8n"}'
