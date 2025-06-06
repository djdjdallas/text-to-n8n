// src/app/api/generate/v2/route.js
import { NextResponse } from "next/server";
import { anthropicClient } from "@/lib/ai/anthropicClient";
import { claudeOptimizer } from "@/lib/prompts/claudeTemplates";
import { RAGSystem } from "@/lib/rag/ragSystem";
import { workflowValidator } from "@/lib/validation/workflowValidator";
import { workflowFixer } from "@/lib/workflow/formatFixer";
import { validateRequest } from "@/lib/validators/requestValidator";
import { n8nValidator } from "@/lib/validation/n8nValidationLoop";

/**
 * Clean workflow object by removing non-standard fields
 * This is VERY strict to ensure only allowed fields are included
 */
function cleanWorkflowForExport(workflow, platform = "n8n") {
  if (platform === "n8n") {
    console.log("🧹 Starting cleanWorkflowForExport for n8n workflow");

    // STRICT APPROACH: Create a completely new object with ONLY the allowed fields
    // This ensures no metadata or unexpected fields can possibly remain
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
      "active",
      "id",
      "triggerCount",
      "createdAt",
      "updatedAt",
    ];

    // CRITICAL FIX: Use the complete fixed workflow as the starting point
    // This preserves ALL the fixes that were applied by the formatFixer
    const cleanWorkflow = JSON.parse(JSON.stringify(workflow));

    // Check the nodes before continuing
    console.log("🔍 cleanWorkflowForExport - nodes check:");
    cleanWorkflow.nodes?.forEach((node) => {
      if (node.type === "n8n-nodes-base.slack") {
        // Ensure Slack nodes don't have otherOptions
        if (node.parameters?.otherOptions) {
          delete node.parameters.otherOptions;
          console.log(
            `  * Slack node ${node.name}: removed otherOptions field`
          );
        } else {
          console.log(
            `  * Slack node ${node.name}: no otherOptions field found (good)`
          );
        }
      }
      if (
        node.type === "n8n-nodes-base.gmailTrigger" ||
        node.type === "n8n-nodes-base.gmail"
      ) {
        console.log(
          `  * Gmail node ${node.name}: credentials =`,
          JSON.stringify(node.credentials)
        );
      }
    });

    // Ensure required fields exist (they should already be set by formatFixer, but double-check)
    if (!cleanWorkflow.name) cleanWorkflow.name = "Generated Workflow";
    if (!cleanWorkflow.versionId)
      cleanWorkflow.versionId = workflowFixer.generateVersionId();
    if (!cleanWorkflow.pinData) cleanWorkflow.pinData = {};
    if (cleanWorkflow.staticData === undefined) cleanWorkflow.staticData = null;
    if (!cleanWorkflow.tags) cleanWorkflow.tags = [];
    if (cleanWorkflow.active === undefined) cleanWorkflow.active = false;
    if (!cleanWorkflow.settings)
      cleanWorkflow.settings = { executionOrder: "v1" };
    if (!cleanWorkflow.meta)
      cleanWorkflow.meta = { instanceId: workflowFixer.generateInstanceId() };

    // Optional fields are already copied from the original workflow above
    // Just ensure numeric fields are proper types
    if (cleanWorkflow.triggerCount !== undefined) {
      cleanWorkflow.triggerCount = Number(cleanWorkflow.triggerCount) || 0;
    }

    // Double-check: remove any fields that might have snuck in
    for (const key in cleanWorkflow) {
      if (!allowedFields.includes(key)) {
        console.log(`⚠️ Removing non-allowed field from workflow: ${key}`);
        delete cleanWorkflow[key];
      }
    }

    // Deep clean: ONLY remove metadata-related fields
    // DO NOT modify any other properties
    const deepClean = (obj) => {
      if (!obj || typeof obj !== "object") return;

      // Clean current level - ONLY removing specific metadata fields
      for (const key in obj) {
        if (
          key.startsWith("_") ||
          key === "metadata" ||
          key === "instructions" ||
          key === "validation"
        ) {
          console.log(`⚠️ Removing metadata field from nested object: ${key}`);
          delete obj[key];
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
          // Recursively clean nested objects and arrays
          deepClean(obj[key]);
        }
      }
    };

    // Apply deep cleaning to the entire workflow - but only for metadata fields
    deepClean(cleanWorkflow);

    // Log the status of crucial fields
    console.log("🔍 After cleanWorkflowForExport processing:");
    console.log("  - Has versionId:", !!cleanWorkflow.versionId);
    console.log("  - Has pinData:", !!cleanWorkflow.pinData);
    console.log("  - Has staticData:", cleanWorkflow.staticData !== undefined);
    console.log("  - Has tags:", !!cleanWorkflow.tags);
    console.log("  - Has active:", cleanWorkflow.active !== undefined);

    return cleanWorkflow;
  }

  // For other platforms, create a clean copy without metadata
  const cleaned = JSON.parse(JSON.stringify(workflow)); // Deep clone

  // Remove metadata at all levels
  const deepClean = (obj) => {
    if (!obj || typeof obj !== "object") return;

    for (const key in obj) {
      if (
        key.startsWith("_") ||
        key === "metadata" ||
        key === "instructions" ||
        key === "validation"
      ) {
        delete obj[key];
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        deepClean(obj[key]);
      }
    }
  };

  deepClean(cleaned);
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
      // New n8n validation options
      validateWithN8n = process.env.N8N_API_KEY || process.env.N8N_WEBHOOK_URL
        ? true
        : false,
      maxValidationAttempts = 3,
    } = body;

    // Track timing
    const startTime = Date.now();
    const timing = {
      ragSearch: 0,
      generation: 0,
      formatFixing: 0,
      n8nValidation: 0,
      total: 0,
    };

    // 1. Initialize RAG if needed
    let relevantDocs = [];
    let ragMetadata = {};

    if (useRAG) {
      const ragStart = Date.now();
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
      timing.ragSearch = Date.now() - ragStart;
    }

    // 2. Generate optimized prompt
    const optimizedPrompt = await claudeOptimizer.generateOptimizedPrompt(
      platform,
      input,
      relevantDocs,
      { complexity, errorHandling, optimization, includeExamples: true }
    );

    // 3. Generate with Claude
    const genStart = Date.now();
    const claudeResponse = await anthropicClient.generateWorkflow(
      optimizedPrompt,
      {
        model: "claude-opus-4-20250514", // Use the specified model
        platform,
        complexity,
        temperature: 0.1,
        maxTokens: 4000,
      }
    );
    timing.generation = Date.now() - genStart;

    // 4. Parse JSON
    let workflow = claudeOptimizer.extractAndValidateJSON(
      claudeResponse.content
    );

    // Debug logging before any fixes
    if (platform === "n8n") {
      console.log("📊 BEFORE formatFixer - Initial state:");
      console.log("  - Slack nodes check:");
      workflow.nodes?.forEach((node) => {
        if (node.type === "n8n-nodes-base.slack") {
          console.log(
            `    * ${node.name}: has otherOptions =`,
            !!node.parameters?.otherOptions
          );
        }
      });
      console.log("  - Gmail nodes check:");
      workflow.nodes?.forEach((node) => {
        if (
          node.type === "n8n-nodes-base.gmailTrigger" ||
          node.type === "n8n-nodes-base.gmail"
        ) {
          console.log(
            `    * ${node.name}: credentials =`,
            JSON.stringify(node.credentials)
          );
        }
      });
      console.log(
        "  - Top-level workflow fields:",
        Object.keys(workflow).join(", ")
      );
    }

    // 5. Fix platform-specific format issues
    const fixStart = Date.now();
    if (platform === "n8n") {
      console.log("🔧 Applying n8n format fixes...");
      workflow = workflowFixer.fixN8nWorkflow(workflow);
      console.log("✅ Format fixes applied");

      // Debug logging after fixes
      console.log("📊 AFTER formatFixer - Fixed state:");
      console.log("  - Slack nodes check:");
      workflow.nodes?.forEach((node) => {
        if (node.type === "n8n-nodes-base.slack") {
          console.log(
            `    * ${node.name}: has otherOptions =`,
            !!node.parameters?.otherOptions
          );
          if (node.parameters?.otherOptions) {
            console.log(
              `      * otherOptions content:`,
              JSON.stringify(node.parameters.otherOptions)
            );
          }
        }
      });
      console.log("  - Gmail nodes check:");
      workflow.nodes?.forEach((node) => {
        if (
          node.type === "n8n-nodes-base.gmailTrigger" ||
          node.type === "n8n-nodes-base.gmail"
        ) {
          console.log(
            `    * ${node.name}: credentials =`,
            JSON.stringify(node.credentials)
          );
        }
      });
      console.log(
        "  - Top-level workflow fields:",
        Object.keys(workflow).join(", ")
      );
    }
    timing.formatFixing = Date.now() - fixStart;

    // 6. NEW: Validate with n8n instance if enabled
    let n8nValidationResult = null;
    if (
      validateWithN8n &&
      platform === "n8n" &&
      (process.env.N8N_API_KEY || process.env.N8N_WEBHOOK_URL)
    ) {
      const valStart = Date.now();
      console.log("🔍 Starting n8n validation and auto-fix loop...");

      try {
        n8nValidationResult = await n8nValidator.validateAndFix(
          workflow,
          input,
          {
            platform,
            maxAttempts: maxValidationAttempts,
          }
        );

        if (n8nValidationResult.success) {
          // Use the validated and fixed workflow
          workflow = n8nValidationResult.workflow;
          console.log(
            `✅ Workflow validated and fixed after ${n8nValidationResult.attempts} attempts`
          );
        } else {
          console.log(
            `⚠️ Validation failed after ${n8nValidationResult.attempts} attempts`
          );
          console.log(`Last error: ${n8nValidationResult.lastError}`);
        }
      } catch (validationError) {
        console.error("❌ n8n validation error:", validationError);
        n8nValidationResult = {
          success: false,
          error: validationError.message,
          attempts: 0,
        };
      } finally {
        // Always cleanup test workflows
        await n8nValidator.cleanup();
      }

      timing.n8nValidation = Date.now() - valStart;
    } else if (validateWithN8n && platform === "n8n") {
      console.log(
        "⚠️ n8n validation requested but not configured. Set N8N_API_KEY or N8N_WEBHOOK_URL"
      );
    }

    // 6.5. Debug: Check if expressions were fixed before cleaning
    if (platform === "n8n") {
      console.log("🔍 Sample expression check BEFORE cleaning:");
      const ifNode = workflow.nodes?.find(
        (n) => n.type === "n8n-nodes-base.if"
      );
      if (ifNode) {
        console.log(
          "IF node leftValue:",
          ifNode.parameters?.conditions?.conditions?.[0]?.leftValue
        );
      }
    }

    // 7. IMPORTANT: Clean the workflow to remove any metadata or non-standard fields
    const cleanedWorkflow = cleanWorkflowForExport(workflow, platform);

    // Verify the cleaned workflow still has the fixes
    if (platform === "n8n") {
      console.log("🔍 After cleaning - expression check:");
      const cleanedIfNode = cleanedWorkflow.nodes?.find(
        (n) => n.type === "n8n-nodes-base.if"
      );
      if (cleanedIfNode) {
        console.log(
          "IF node leftValue:",
          cleanedIfNode.parameters?.conditions?.conditions?.[0]?.leftValue
        );
      }
    }

    // Detailed debug logging after cleaning
    if (platform === "n8n") {
      console.log("📊 AFTER cleaning - Sanitized state:");
      console.log("  - Slack nodes check:");
      cleanedWorkflow.nodes?.forEach((node) => {
        if (node.type === "n8n-nodes-base.slack") {
          console.log(
            `    * ${node.name}: has otherOptions =`,
            !!node.parameters?.otherOptions
          );
          if (node.parameters?.otherOptions) {
            console.log(
              `      * otherOptions content:`,
              JSON.stringify(node.parameters.otherOptions)
            );
          }
        }
      });
      console.log("  - Gmail nodes check:");
      cleanedWorkflow.nodes?.forEach((node) => {
        if (
          node.type === "n8n-nodes-base.gmailTrigger" ||
          node.type === "n8n-nodes-base.gmail"
        ) {
          console.log(
            `    * ${node.name}: credentials =`,
            JSON.stringify(node.credentials)
          );
        }
      });
      console.log(
        "  - Top-level workflow fields:",
        Object.keys(cleanedWorkflow).join(", ")
      );
    }

    // 8. Validate if requested (use cleaned workflow)
    let validationResult = null;
    if (validateOutput) {
      validationResult = await workflowValidator.validateWorkflow(
        platform,
        cleanedWorkflow,
        { errorHandling, complexity }
      );
    }

    // 9. Extract any metadata that was in the original workflow for our response
    const extractedMetadata = {};
    if (workflow._metadata) {
      extractedMetadata.aiMetadata = workflow._metadata;
    }

    // 10. Calculate metadata and timing
    timing.total = Date.now() - startTime;
    const inputTokens = anthropicClient.estimateTokens(optimizedPrompt);
    const outputTokens = anthropicClient.estimateTokens(claudeResponse.content);
    const cost = anthropicClient.calculateCost(
      inputTokens,
      outputTokens,
      claudeResponse.model
    );

    // 11. Create response with metadata separate from workflow
    const metadataObject = {
      provider,
      model: claudeResponse.model || extractedMetadata.aiMetadata?.model,
      generationTime: timing.generation,
      inputTokens,
      outputTokens,
      cost: cost.totalCost,
      platform,
      complexity,
      ragEnhanced: useRAG,
      timing,
      ...ragMetadata,
    };

    // Only add any extracted AI metadata to the metadata, not to the workflow
    if (extractedMetadata.aiMetadata) {
      metadataObject.aiMetadata = extractedMetadata.aiMetadata;
    }

    // 12. Add helpful copy instructions
    const instructions = [];
    if (platform === "n8n") {
      instructions.push(
        "To import this workflow into n8n:",
        "1. Copy the JSON workflow below",
        "2. In n8n, click the menu (three dots) and select 'Import from File'",
        "3. Or press Ctrl+Shift+V (or Cmd+Shift+V on Mac) in the n8n editor",
        "4. Paste the JSON and click 'Import'",
        "Note: You'll need to set up your own credentials for each service"
      );
    }

    // Add n8n validation results to response
    const validationInfo = {
      ...validationResult,
      n8nValidation: n8nValidationResult
        ? {
            tested: true,
            success: n8nValidationResult.success,
            attempts: n8nValidationResult.attempts,
            history: n8nValidationResult.history,
            lastError: n8nValidationResult.lastError,
            suggestions: n8nValidationResult.suggestions,
          }
        : {
            tested: false,
            reason: validateWithN8n ? "Not configured" : "Not requested",
          },
    };

    // Separate response structure for API metadata vs. the actual workflow
    const response = {
      success: true,
      instructions,
      metadata: metadataObject,
      validation: validationInfo,
      // For client rendering/information purposes
      workflow: cleanedWorkflow,
    };

    // Add warnings if n8n validation failed
    if (n8nValidationResult && !n8nValidationResult.success) {
      response.warnings = [
        `⚠️ Workflow failed n8n validation: ${n8nValidationResult.lastError}`,
        `Attempted ${n8nValidationResult.attempts} times to fix automatically`,
        ...(n8nValidationResult.suggestions || []),
      ];
    }

    // EMERGENCY FIX: Create a separate endpoint for copy functionality
    if (platform === "n8n") {
      console.log("🔧 Creating final importReadyWorkflow for client");

      // CRITICAL: Final check to ensure proper node configurations
      console.log("🔧 Final fixup: Checking for issues in nodes");
      cleanedWorkflow.nodes?.forEach((node) => {
        // Make sure Slack nodes don't have otherOptions
        if (node.type === "n8n-nodes-base.slack") {
          if (node.parameters?.otherOptions) {
            delete node.parameters.otherOptions;
            console.log(
              `✅ Removed otherOptions from Slack node "${node.name}" in final workflow`
            );
          }
        }

        // Fix Gmail credentials if needed
        if (
          (node.type === "n8n-nodes-base.gmailTrigger" ||
            node.type === "n8n-nodes-base.gmail") &&
          node.credentials?.gmailOAuth2Api
        ) {
          node.credentials.gmailOAuth2 = {
            id: node.credentials.gmailOAuth2Api.id || "1",
            name: node.credentials.gmailOAuth2Api.name || "Gmail account",
          };
          delete node.credentials.gmailOAuth2Api;
          console.log(
            `✅ Fixed Gmail credentials for node "${node.name}" in final workflow`
          );
        }
      });

      // Deep copy the fixed cleanedWorkflow
      const importReadyWorkflow = JSON.parse(JSON.stringify(cleanedWorkflow));

      // ENSURE these critical fields are ALWAYS included (even with default values)
      // This is belt-and-suspenders to make absolutely sure they're present
      importReadyWorkflow.versionId =
        importReadyWorkflow.versionId || workflowFixer.generateVersionId();
      importReadyWorkflow.pinData = importReadyWorkflow.pinData || {};
      importReadyWorkflow.staticData =
        importReadyWorkflow.staticData !== undefined
          ? importReadyWorkflow.staticData
          : null;
      importReadyWorkflow.tags = importReadyWorkflow.tags || [];
      importReadyWorkflow.active =
        importReadyWorkflow.active !== undefined
          ? importReadyWorkflow.active
          : false;

      // Set directly as a string to avoid any chance of mutation
      response.copyableJSON = JSON.stringify(importReadyWorkflow, null, 2);

      // Also provide a direct import endpoint for copying
      response.directImportUrl = `/api/workflow/export/${Date.now()}`;

      // Final detailed debug logs to verify what's being returned
      console.log("📊 FINAL WORKFLOW - Import-ready state:");
      console.log("  - Slack nodes check:");
      importReadyWorkflow.nodes?.forEach((node) => {
        if (node.type === "n8n-nodes-base.slack") {
          console.log(
            `    * ${node.name}: has otherOptions =`,
            !!node.parameters?.otherOptions
          );
          if (node.parameters?.otherOptions) {
            console.log(
              `      * otherOptions content:`,
              JSON.stringify(node.parameters.otherOptions)
            );
          }
        }
      });
      console.log("  - Gmail nodes check:");
      importReadyWorkflow.nodes?.forEach((node) => {
        if (
          node.type === "n8n-nodes-base.gmailTrigger" ||
          node.type === "n8n-nodes-base.gmail"
        ) {
          console.log(
            `    * ${node.name}: credentials =`,
            JSON.stringify(node.credentials)
          );
        }
      });
      console.log(
        "  - Top-level workflow fields:",
        Object.keys(importReadyWorkflow).join(", ")
      );
      console.log(
        "🔄 FINAL WORKFLOW (first 200 chars):",
        JSON.stringify(importReadyWorkflow, null, 2).substring(0, 200) + "..."
      );
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Generation error:", error);

    // Cleanup any test workflows if there was an error
    try {
      await n8nValidator.cleanup();
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
    }

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
  const hasN8nValidation = !!(
    process.env.N8N_API_KEY || process.env.N8N_WEBHOOK_URL
  );

  return NextResponse.json({
    status: "healthy",
    version: "2.0",
    endpoints: {
      generate: "/api/generate/v2",
      debug: "/api/generate/debug",
      test: {
        rag: "/api/test/rag",
        n8nFormat: "/api/test/n8n-format",
        n8nValidation: "/api/test/n8n-validation",
      },
    },
    features: {
      rag: true,
      validation: true,
      formatFixer: true,
      workflowCleaner: true,
      n8nValidation: hasN8nValidation,
      providers: ["claude", "openai"],
      platforms: ["n8n", "zapier", "make"],
    },
    n8nConnection: {
      configured: hasN8nValidation,
      method: process.env.N8N_API_KEY
        ? "api"
        : process.env.N8N_WEBHOOK_URL
        ? "webhook"
        : "none",
      url: process.env.N8N_API_URL ? "configured" : "not configured",
    },
  });
}
