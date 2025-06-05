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
 * This is VERY strict to ensure only allowed fields are included
 */
function cleanWorkflowForExport(workflow, platform = "n8n") {
  if (platform === "n8n") {
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
    
    // Initialize the clean workflow with required fields
    const cleanWorkflow = {
      name: workflow.name || "Generated Workflow",
      // Deep copy nodes to preserve all parameters and nested objects
      nodes: Array.isArray(workflow.nodes) ? workflow.nodes.map(node => JSON.parse(JSON.stringify(node))) : [],
      connections: workflow.connections ? JSON.parse(JSON.stringify(workflow.connections)) : {},
      settings: workflow.settings ? {...workflow.settings} : { executionOrder: "v1" },
      meta: workflow.meta ? {...workflow.meta} : { instanceId: "workflow_instance_id" },
    };
    
    // Only add optional fields if they exist in the original and are in the allowed list
    if (workflow.versionId !== undefined) {
      cleanWorkflow.versionId = workflow.versionId;
    }
    if (workflow.pinData !== undefined) {
      cleanWorkflow.pinData = typeof workflow.pinData === 'object' ? {...workflow.pinData} : {};
    }
    if (workflow.staticData !== undefined) {
      cleanWorkflow.staticData = workflow.staticData === null ? null : 
        (typeof workflow.staticData === 'object' ? {...workflow.staticData} : null);
    }
    if (workflow.tags !== undefined) {
      cleanWorkflow.tags = Array.isArray(workflow.tags) ? [...workflow.tags] : [];
    }
    if (workflow.active !== undefined) {
      cleanWorkflow.active = Boolean(workflow.active);
    }
    if (workflow.id !== undefined) {
      cleanWorkflow.id = workflow.id;
    }
    if (workflow.triggerCount !== undefined) {
      cleanWorkflow.triggerCount = Number(workflow.triggerCount) || 0;
    }
    if (workflow.createdAt !== undefined) {
      cleanWorkflow.createdAt = workflow.createdAt;
    }
    if (workflow.updatedAt !== undefined) {
      cleanWorkflow.updatedAt = workflow.updatedAt;
    }
    
    // Double-check: remove any fields that might have snuck in
    for (const key in cleanWorkflow) {
      if (!allowedFields.includes(key)) {
        delete cleanWorkflow[key];
      }
    }
    
    // Deep clean: ensure no _metadata in nested objects
    const deepClean = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      // Clean current level
      for (const key in obj) {
        if (key.startsWith('_') || key === 'metadata' || key === 'instructions' || key === 'validation') {
          delete obj[key];
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          // Recursively clean nested objects and arrays
          deepClean(obj[key]);
        }
      }
    };
    
    // Apply deep cleaning to the entire workflow
    deepClean(cleanWorkflow);
    
    return cleanWorkflow;
  }

  // For other platforms, create a clean copy without metadata
  const cleaned = JSON.parse(JSON.stringify(workflow)); // Deep clone
  
  // Remove metadata at all levels
  const deepClean = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    
    for (const key in obj) {
      if (key.startsWith('_') || key === 'metadata' || key === 'instructions' || key === 'validation') {
        delete obj[key];
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
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
        model: "claude-3-7-sonnet-20250219", // Use the specified model
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
      console.log("🔍 After workflowFixer: Slack nodes have otherOptions:", 
        workflow.nodes?.some(n => n.type === 'n8n-nodes-base.slack' && n.parameters?.otherOptions));
      console.log("🔍 After workflowFixer: Top-level fields:", Object.keys(workflow).join(', '));
    }

    // 6. IMPORTANT: Clean the workflow to remove any metadata or non-standard fields
    const cleanedWorkflow = cleanWorkflowForExport(workflow, platform);
    
    // Debug logging to verify the cleaning didn't remove critical fixes
    if (platform === "n8n") {
      console.log("🔍 After cleaning: Slack nodes have otherOptions:", 
        cleanedWorkflow.nodes?.some(n => n.type === 'n8n-nodes-base.slack' && n.parameters?.otherOptions));
      console.log("🔍 After cleaning: Top-level fields:", Object.keys(cleanedWorkflow).join(', '));
    }

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

    // 10. Create response with metadata separate from workflow
    const metadataObject = {
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
    };
    
    // Only add any extracted AI metadata to the metadata, not to the workflow
    if (extractedMetadata.aiMetadata) {
      metadataObject.aiMetadata = extractedMetadata.aiMetadata;
    }

    // 11. Add helpful copy instructions 
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
    
    // Separate response structure for API metadata vs. the actual workflow
    const response = {
      success: true,
      instructions,
      metadata: metadataObject,
      validation: validationResult,
      // For client rendering/information purposes
      workflow: cleanedWorkflow,
    };
    
    // EMERGENCY FIX: Create a separate endpoint for copy functionality
    if (platform === "n8n") {
      // Create a completely separate workflow JSON with absolutely nothing but the allowed fields
      // Using deep copies to ensure all nested properties are preserved
      const importReadyWorkflow = {
        name: cleanedWorkflow.name || "Generated Workflow",
        nodes: cleanedWorkflow.nodes ? JSON.parse(JSON.stringify(cleanedWorkflow.nodes)) : [],
        connections: cleanedWorkflow.connections ? JSON.parse(JSON.stringify(cleanedWorkflow.connections)) : {},
        settings: cleanedWorkflow.settings ? JSON.parse(JSON.stringify(cleanedWorkflow.settings)) : { executionOrder: "v1" },
        meta: cleanedWorkflow.meta ? JSON.parse(JSON.stringify(cleanedWorkflow.meta)) : { instanceId: "workflow_instance_id" },
      };
      
      // ENSURE these critical fields are ALWAYS included (even with default values)
      importReadyWorkflow.versionId = cleanedWorkflow.versionId || workflowFixer.generateVersionId();
      importReadyWorkflow.pinData = cleanedWorkflow.pinData || {};
      importReadyWorkflow.staticData = cleanedWorkflow.staticData !== undefined ? cleanedWorkflow.staticData : null;
      importReadyWorkflow.tags = cleanedWorkflow.tags || [];
      importReadyWorkflow.active = cleanedWorkflow.active !== undefined ? cleanedWorkflow.active : false;
      
      // Add these optional fields only if they exist
      if (cleanedWorkflow.id) importReadyWorkflow.id = cleanedWorkflow.id;
      if (cleanedWorkflow.triggerCount !== undefined) importReadyWorkflow.triggerCount = cleanedWorkflow.triggerCount;
      if (cleanedWorkflow.createdAt) importReadyWorkflow.createdAt = cleanedWorkflow.createdAt;
      if (cleanedWorkflow.updatedAt) importReadyWorkflow.updatedAt = cleanedWorkflow.updatedAt;
      
      // Set directly as a string to avoid any chance of mutation
      response.copyableJSON = JSON.stringify(importReadyWorkflow, null, 2);
      
      // Also provide a direct import endpoint for copying
      response.directImportUrl = `/api/workflow/export/${Date.now()}`;
      
      // Final debug log to verify what's being returned
      console.log("🔄 FINAL WORKFLOW:", JSON.stringify(importReadyWorkflow, null, 2).substring(0, 200) + "...");
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
