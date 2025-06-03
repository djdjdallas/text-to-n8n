// src/app/api/generate/v2/route.js
import { NextResponse } from "next/server";
import { anthropicClient } from "@/lib/ai/anthropicClient";
import { claudeOptimizer } from "@/lib/prompts/claudeTemplates";
import { RAGSystem } from "@/lib/rag/ragSystem";
import { workflowValidator } from "@/lib/validation/workflowValidator";
import { workflowFixer } from "@/lib/workflow/formatFixer";
import { validateRequest } from "@/lib/validators/requestValidator";

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

    const {
      input,
      platform = "n8n",
      complexity = "simple",
      errorHandling = true,
      optimization = 50,
      provider = "claude",
      useRAG = true,
      validateOutput = true,
    } = body;

    // 1. Initialize RAG if needed
    let relevantDocs = [];
    let ragMetadata = {};

    if (useRAG) {
      const ragSystem = new RAGSystem();
      await ragSystem.initialize();

      if (ragSystem.initialized) {
        const ragResult = await ragSystem.getRelevantContext(input, platform, {
          maxDocuments: 10,
          minRelevance: 0.7,
        });

        relevantDocs = ragResult.documents || [];
        ragMetadata = {
          docsFound: relevantDocs.length,
          avgRelevance: ragResult.avgRelevance || 0,
          initialized: true,
        };
      }
    }

    // 2. Generate optimized prompt
    const optimizedPrompt = await claudeOptimizer.generateOptimizedPrompt(
      platform,
      input,
      relevantDocs,
      { complexity, errorHandling, optimization, includeExamples: true }
    );

    // 3. Generate with Claude
    const startTime = Date.now();
    const claudeResponse = await anthropicClient.generateWorkflow(
      optimizedPrompt,
      {
        platform,
        complexity,
        temperature: 0.1,
        maxTokens: 4000,
      }
    );

    // 4. Parse JSON
    let workflow = claudeOptimizer.extractAndValidateJSON(
      claudeResponse.content
    );

    // 5. Fix platform-specific format issues
    if (platform === "n8n") {
      workflow = workflowFixer.fixN8nWorkflow(workflow);
    }

    // 6. Validate if requested
    let validationResult = null;
    if (validateOutput) {
      validationResult = await workflowValidator.validateWorkflow(
        platform,
        workflow,
        { errorHandling, complexity }
      );
    }

    // 7. Calculate metadata
    const generationTime = Date.now() - startTime;
    const inputTokens = anthropicClient.estimateTokens(optimizedPrompt);
    const outputTokens = anthropicClient.estimateTokens(claudeResponse.content);
    const cost = anthropicClient.calculateCost(
      inputTokens,
      outputTokens,
      claudeResponse.model
    );

    // 8. Create response
    const response = {
      success: true,
      workflow,
      validation: validationResult,
      metadata: {
        provider,
        model: claudeResponse.model,
        generationTime,
        inputTokens,
        outputTokens,
        cost: cost.totalCost,
        platform,
        complexity,
        ragEnhanced: useRAG,
        ...ragMetadata,
      },
    };

    // 9. Add helpful copy instructions for n8n
    if (platform === "n8n") {
      response.instructions = [
        "To import this workflow into n8n:",
        "1. Copy the entire 'workflow' object below",
        "2. In n8n, click the menu (three dots) and select 'Import from File'",
        "3. Or press Ctrl+Shift+V (or Cmd+Shift+V on Mac) in the n8n editor",
        "4. Paste the JSON and click 'Import'",
        "Note: You'll need to set up your own credentials for Gmail and Slack",
      ];
      response.copyableJSON = JSON.stringify(workflow, null, 2);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    endpoints: {
      generate: "/api/generate/v2",
      debug: "/api/generate/debug",
      test: {
        rag: "/api/test/rag",
        n8nFormat: "/api/test/n8n-format",
      },
    },
    features: {
      rag: true,
      validation: true,
      formatFixer: true,
      providers: ["claude", "openai"],
    },
  });
}
