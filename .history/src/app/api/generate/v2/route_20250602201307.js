// src/app/api/generate/v2/route.js
import { NextResponse } from "next/server";
import { anthropicClient } from "@/lib/ai/anthropicClient";
import { claudeOptimizer } from "@/lib/prompts/claudeTemplates";
import { RAGSystem } from "@/lib/rag/ragSystem";
import { workflowValidator } from "@/lib/validation/workflowValidator";
import { workflowFixer } from "@/lib/workflow/formatFixer";
import { validateRequest } from "@/lib/validators/requestValidator";

/**
 * Clean workflow object by removing non-standard fields
 */
function cleanWorkflowForExport(workflow, platform = "n8n") {
  if (platform === "n8n") {
    // Create a clean copy with only n8n-standard fields
    const cleanWorkflow = {
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings || { executionOrder: "v1" },
      meta: workflow.meta || { instanceId: "workflow_instance_id" },
    };

    // Add optional fields only if they exist
    if (workflow.versionId !== undefined) {
      cleanWorkflow.versionId = workflow.versionId;
    }
    if (workflow.pinData !== undefined) {
      cleanWorkflow.pinData = workflow.pinData || {};
    }
    if (workflow.staticData !== undefined) {
      cleanWorkflow.staticData = workflow.staticData || null;
    }
    if (workflow.tags !== undefined) {
      cleanWorkflow.tags = workflow.tags || [];
    }

    // Remove any fields that start with underscore or any non-standard fields
    const allowedFields = [
      "name",
      "nodes",
      "connections",
      "settings",
      "meta",
      "versionId",
      "pinData",
      "staticData",
      "tags",
    ];

    Object.keys(cleanWorkflow).forEach((key) => {
      if (!allowedFields.includes(key)) {
        delete cleanWorkflow[key];
      }
    });

    return cleanWorkflow;
  }

  // For other platforms, just remove underscore-prefixed fields
  const cleaned = { ...workflow };
  Object.keys(cleaned).forEach((key) => {
    if (key.startsWith("_")) {
      delete cleaned[key];
    }
  });

  return cleaned;
}

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

    // 6. IMPORTANT: Clean the workflow to remove any metadata or non-standard fields
    const cleanedWorkflow = cleanWorkflowForExport(workflow, platform);

    // 7. Validate if requested (use cleaned workflow)
    let validationResult = null;
    if (validateOutput) {
      validationResult = await workflowValidator.validateWorkflow(
        platform,
        cleanedWorkflow,
        { errorHandling, complexity }
      );
    }

    // 8. Extract any metadata that was in the original workflow for our response
    const extractedMetadata = {};
    if (workflow._metadata) {
      extractedMetadata.aiMetadata = workflow._metadata;
    }

    // 9. Calculate metadata
    const generationTime = Date.now() - startTime;
    const inputTokens = anthropicClient.estimateTokens(optimizedPrompt);
    const outputTokens = anthropicClient.estimateTokens(claudeResponse.content);
    const cost = anthropicClient.calculateCost(
      inputTokens,
      outputTokens,
      claudeResponse.model
    );

    // 10. Create response
    const response = {
      success: true,
      workflow: cleanedWorkflow, // Return the CLEANED workflow
      validation: validationResult,
      metadata: {
        provider,
        model: claudeResponse.model || extractedMetadata.aiMetadata?.model,
        generationTime,
        inputTokens,
        outputTokens,
        cost: cost.totalCost,
        platform,
        complexity,
        ragEnhanced: useRAG,
        ...ragMetadata,
        ...extractedMetadata,
      },
    };

    // 11. Add helpful copy instructions for n8n
    if (platform === "n8n") {
      response.instructions = [
        "To import this workflow into n8n:",
        "1. Copy the entire 'workflow' object below",
        "2. In n8n, click the menu (three dots) and select 'Import from File'",
        "3. Or press Ctrl+Shift+V (or Cmd+Shift+V on Mac) in the n8n editor",
        "4. Paste the JSON and click 'Import'",
        "Note: You'll need to set up your own credentials for each service",
      ];

      // Provide clean JSON for copying
      response.copyableJSON = JSON.stringify(cleanedWorkflow, null, 2);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.details || undefined,
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
    version: "2.0",
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
      workflowCleaner: true,
      providers: ["claude", "openai"],
      platforms: ["n8n", "zapier", "make"],
    },
  });
}
