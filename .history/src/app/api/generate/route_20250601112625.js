// src/app/api/generate/route.js (Updated)
import { NextResponse } from "next/server";
import { WorkflowGenerator } from "@/lib/ai/workflowGenerator";
import { RAGSystem } from "@/lib/rag/ragSystem";
import { validateRequest } from "@/lib/validators/requestValidator";
import { cacheManager } from "@/lib/cache/cacheManager";

const generator = new WorkflowGenerator();
const ragSystem = new RAGSystem();

export async function POST(req) {
  try {
    const body = await req.json();

    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.errors },
        { status: 400 }
      );
    }

    const { input, platform, complexity, errorHandling, optimization } = body;

    // Check cache for similar requests
    const cacheKey = cacheManager.generateKey(input, platform, complexity);
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      return NextResponse.json({
        ...cached,
        metadata: { ...cached.metadata, fromCache: true },
      });
    }

    // Initialize RAG system if needed
    await ragSystem.initialize();

    // Generate workflow with extended thinking
    const result = await generator.generateWorkflow(input, platform, {
      complexity,
      errorHandling,
      optimization,
      ragSystem,
    });

    // Cache the result
    await cacheManager.set(cacheKey, result, 3600); // 1 hour TTL

    return NextResponse.json(result);
  } catch (error) {
    console.error("Workflow generation error:", error);

    // Return user-friendly error
    return NextResponse.json(
      {
        error: "Failed to generate workflow",
        message: error.message,
        suggestions: getErrorSuggestions(error),
      },
      { status: 500 }
    );
  }
}

function getErrorSuggestions(error) {
  // Provide helpful suggestions based on error type
  if (error.message.includes("rate limit")) {
    return ["Try again in a few moments", "Consider upgrading your plan"];
  }
  if (error.message.includes("invalid platform")) {
    return ["Supported platforms: n8n, zapier, make"];
  }
  return ["Try simplifying your description", "Check your input for typos"];
}
