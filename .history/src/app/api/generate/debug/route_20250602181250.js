// src/app/api/generate/debug/route.js
import { NextResponse } from "next/server";
import { anthropicClient } from "@/lib/ai/anthropicClient";
import { claudeOptimizer } from "@/lib/prompts/claudeTemplates";
import { RAGSystem } from "@/lib/rag/ragSystem";
import { workflowValidator } from "@/lib/validation/workflowValidator";

export async function POST(req) {
  const debugInfo = {
    request: {},
    rag: {},
    claude: {},
    validation: {},
    finalWorkflow: null,
  };

  try {
    const body = await req.json();
    debugInfo.request = { ...body };

    const { input, platform = "n8n", useRAG = true } = body;

    // 1. Test RAG
    if (useRAG) {
      const ragSystem = new RAGSystem();
      await ragSystem.initialize();

      debugInfo.rag.initialized = ragSystem.initialized;

      const ragResult = await ragSystem.getRelevantContext(input, platform, {
        maxDocuments: 5,
        minRelevance: 0.5,
      });

      debugInfo.rag.documentsFound = ragResult.documents.length;
      debugInfo.rag.avgRelevance = ragResult.avgRelevance;
      debugInfo.rag.topDocs = ragResult.documents.slice(0, 3).map((doc) => ({
        title: doc.metadata?.title,
        type: doc.metadata?.docType,
        score: doc.score,
        preview: doc.content.substring(0, 150) + "...",
      }));
    }

    // 2. Generate prompt
    const relevantDocs =
      debugInfo.rag.documentsFound > 0
        ? (await new RAGSystem().getRelevantContext(input, platform)).documents
        : [];

    const optimizedPrompt = await claudeOptimizer.generateOptimizedPrompt(
      platform,
      input,
      relevantDocs,
      {
        complexity: "simple",
        errorHandling: true,
        includeExamples: true,
      }
    );

    debugInfo.claude.promptLength = optimizedPrompt.length;
    debugInfo.claude.promptPreview = optimizedPrompt.substring(0, 500) + "...";

    // 3. Generate with Claude
    const claudeResponse = await anthropicClient.generateWorkflow(
      optimizedPrompt,
      {
        platform,
        complexity: "simple",
        temperature: 0.1,
      }
    );

    debugInfo.claude.responseLength = claudeResponse.content.length;
    debugInfo.claude.model = claudeResponse.model;

    // 4. Parse JSON
    let workflow;
    try {
      workflow = claudeOptimizer.extractAndValidateJSON(claudeResponse.content);
      debugInfo.claude.jsonParsed = true;
    } catch (parseError) {
      debugInfo.claude.jsonParsed = false;
      debugInfo.claude.parseError = parseError.message;
      debugInfo.claude.rawResponse = claudeResponse.content.substring(0, 1000);
      throw parseError;
    }

    // 5. Validate
    const validation = await workflowValidator.validateWorkflow(
      platform,
      workflow,
      {
        errorHandling: true,
      }
    );

    debugInfo.validation = {
      isValid: validation.isValid,
      score: validation.score,
      errors: validation.errors,
      warnings: validation.warnings,
      suggestions: validation.suggestions,
    };

    // 6. Fix common n8n issues
    if (platform === "n8n") {
      // Ensure proper structure
      if (!workflow.name) workflow.name = "Generated Workflow";
      if (!workflow.active) workflow.active = false;
      if (!workflow.settings) workflow.settings = { executionOrder: "v1" };
      if (!workflow.tags) workflow.tags = [];

      // Fix node IDs to be UUID-like
      if (workflow.nodes) {
        workflow.nodes.forEach((node, index) => {
          if (!node.id || node.id.length < 10) {
            node.id = generateUUID();
          }
          // Ensure position is array of numbers
          if (!Array.isArray(node.position) || node.position.length !== 2) {
            node.position = [250 + index * 200, 300];
          }
        });
      }
    }

    debugInfo.finalWorkflow = workflow;

    return NextResponse.json({
      success: true,
      workflow,
      debugInfo,
      copyReadyJSON: JSON.stringify(workflow, null, 2),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        debugInfo,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
