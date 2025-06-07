// src/app/api/generate/v2/route.js
import { NextResponse } from "next/server";
import { anthropicClient } from "@/lib/ai/anthropicClient";
import { claudeOptimizer } from "@/lib/prompts/claudeTemplates";
import { RAGSystem } from "@/lib/rag/ragSystem";
import { workflowValidator } from "@/lib/validation/workflowValidator";
import { workflowFixer } from "@/lib/workflow/formatFixer";
import { validateRequest } from "@/lib/validators/requestValidator";
import { N8nValidationLoop } from "@/lib/validation/n8nValidationLoop";
import { analytics } from "@/lib/monitoring/analytics";
import { promptEnhancer } from "@/lib/prompts/promptEnhancer";
import { logger } from "@/lib/utils/logger";

/**
 * Validate AI workflow structure before processing
 * Ensures the AI returned a complete workflow, not just parameters
 */
function validateAIWorkflowStructure(workflow) {
  const errors = [];
  const warnings = [];
  
  // Check for required top-level fields
  if (!workflow || typeof workflow !== 'object') {
    errors.push('Workflow must be an object');
    return { valid: false, errors, warnings };
  }
  
  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    errors.push('Workflow must have a nodes array');
  }
  
  if (!workflow.connections || typeof workflow.connections !== 'object') {
    warnings.push('Workflow should have a connections object');
  }
  
  // Check if AI returned node parameters instead of a workflow
  const topLevelKeys = Object.keys(workflow);
  const nodeParamIndicators = ['labelIds', 'parameters', 'includeAttachments', 'operation', 'resource'];
  const looksLikeNodeParams = nodeParamIndicators.some(key => topLevelKeys.includes(key));
  
  if (looksLikeNodeParams && !workflow.nodes) {
    errors.push('AI returned node parameters instead of a complete workflow structure');
    
    // Try to reconstruct
    const reconstructed = reconstructWorkflowFromParams(workflow);
    if (reconstructed) {
      return {
        valid: false,
        errors,
        warnings: ['Workflow was reconstructed from node parameters'],
        reconstructed
      };
    }
  }
  
  // Check node structure
  if (workflow.nodes && workflow.nodes.length > 0) {
    workflow.nodes.forEach((node, index) => {
      if (!node.id) warnings.push(`Node ${index} is missing an id`);
      if (!node.name) errors.push(`Node ${index} is missing a name`);
      if (!node.type) errors.push(`Node ${index} is missing a type`);
      if (!node.position) warnings.push(`Node ${index} is missing position`);
    });
  } else if (workflow.nodes) {
    errors.push('Workflow has no nodes');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    reconstructed: null
  };
}

/**
 * Attempt to reconstruct a workflow from node parameters
 */
function reconstructWorkflowFromParams(params) {
  console.log('🔧 Attempting to reconstruct workflow from parameters:', params);
  
  // Detect the type of node based on parameters
  let nodeType = 'n8n-nodes-base.noOp';
  let nodeName = 'Generated Node';
  
  if (params.labelIds || params.includeAttachments) {
    nodeType = 'n8n-nodes-base.gmailTrigger';
    nodeName = 'Gmail Trigger';
  } else if (params.webhookPath || params.httpMethod) {
    nodeType = 'n8n-nodes-base.webhook';
    nodeName = 'Webhook';
  } else if (params.channel || params.text) {
    nodeType = 'n8n-nodes-base.slack';
    nodeName = 'Slack';
  }
  
  return {
    name: "Reconstructed Workflow",
    nodes: [{
      id: workflowFixer.generateNodeId(),
      name: nodeName,
      type: nodeType,
      typeVersion: 1,
      position: [250, 300],
      parameters: params
    }],
    connections: {},
    settings: {
      executionOrder: "v1"
    }
  };
}

/**
 * Strict cleaning function for n8n validation
 * Only includes standard n8n fields, removes ALL extra fields
 */
function strictCleanForValidation(workflow) {
  // Only include fields that n8n API accepts during creation
  // Based on the error, n8n API is very strict about what it accepts
  const allowedWorkflowFields = ['name', 'nodes', 'connections', 'settings'];
  // All other fields (meta, versionId, pinData, staticData, tags, active, id, etc.) are read-only
  const cleaned = {};
  
  // Copy only allowed workflow-level fields
  allowedWorkflowFields.forEach(field => {
    if (workflow[field] !== undefined) {
      cleaned[field] = workflow[field];
    }
  });
  
  // Deep clean nodes - remove any non-standard fields
  if (cleaned.nodes) {
    const allowedNodeFields = ['id', 'name', 'type', 'typeVersion', 'position', 'parameters', 'credentials'];
    cleaned.nodes = cleaned.nodes.map(node => {
      const cleanedNode = {};
      allowedNodeFields.forEach(field => {
        if (node[field] !== undefined) {
          cleanedNode[field] = node[field];
        }
      });
      
      // CRITICAL: Preserve options field for Google Drive nodes
      if (cleanedNode.type === 'n8n-nodes-base.googleDrive' && 
          cleanedNode.parameters && 
          !cleanedNode.parameters.options) {
        cleanedNode.parameters.options = {};
        console.log(`✅ STRICT CLEAN: Added required options field to Google Drive node "${cleanedNode.name}"`);
      }
      
      // Specifically remove common problematic fields
      // Don't copy webhookId, suggestions, metadata, etc.
      
      return cleanedNode;
    });
  }
  
  // Deep clean connections - ensure proper structure
  if (cleaned.connections) {
    const cleanedConnections = {};
    Object.keys(cleaned.connections).forEach(sourceName => {
      const connection = cleaned.connections[sourceName];
      if (connection && typeof connection === 'object') {
        cleanedConnections[sourceName] = {
          main: connection.main || []
        };
      }
    });
    cleaned.connections = cleanedConnections;
  }
  
  // Ensure settings is clean
  if (cleaned.settings && typeof cleaned.settings === 'object') {
    const allowedSettingsFields = ['executionOrder', 'saveDataErrorExecution', 'saveDataSuccessExecution', 
                                  'saveExecutionProgress', 'saveManualExecutions', 'executionTimeout', 'timezone'];
    const cleanedSettings = {};
    allowedSettingsFields.forEach(field => {
      if (cleaned.settings[field] !== undefined) {
        cleanedSettings[field] = cleaned.settings[field];
      }
    });
    cleaned.settings = cleanedSettings;
  }
  
  console.log('🧹 Strict cleaning complete. Removed any non-standard fields.');
  return cleaned;
}

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
        // CRITICAL: Preserve n8n-specific fields
        if (key === "__rl") {
          // This is a resource locator field required by n8n - NEVER remove it
          continue;
        }
        
        // Only remove actual metadata fields
        if (
          (key.startsWith("_") && key !== "__rl") || // Preserve __rl even though it starts with _
          key === "metadata" ||
          key === "instructions" ||
          key === "validation" ||
          key === "webhookId" // This one we do want to remove
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
      // CRITICAL: Preserve n8n-specific fields
      if (key === "__rl") {
        // This is a resource locator field required by n8n - NEVER remove it
        continue;
      }
      
      // Only remove actual metadata fields
      if (
        (key.startsWith("_") && key !== "__rl") || // Preserve __rl even though it starts with _
        key === "metadata" ||
        key === "instructions" ||
        key === "validation" ||
        key === "webhookId" // This one we do want to remove
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

// Create n8n validator instance
const n8nValidator = new N8nValidationLoop();

export async function POST(req) {
  logger.info("🚀 [GENERATE V2] Request received");
  
  try {
    let body;
    try {
      body = await req.json();
      logger.info("📝 [GENERATE V2] Body parsed:", body);
    } catch (parseError) {
      logger.error("❌ [GENERATE V2] JSON parse error:", parseError);
      return NextResponse.json(
        { 
          error: "Invalid JSON in request body", 
          details: parseError.message 
        },
        { status: 400 }
      );
    }

    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      logger.error("❌ [GENERATE V2] Validation failed:", validation.errors);
      logger.error("❌ [GENERATE V2] Request body:", body);
      return NextResponse.json(
        { 
          error: "Invalid request", 
          details: validation.errors,
          receivedBody: body 
        },
        { status: 400 }
      );
    }
    logger.info("✅ [GENERATE V2] Request validated");

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
    console.log("🔍 [GENERATE V2] Starting RAG initialization...");
    let relevantDocs = [];
    let ragMetadata = {};

    if (useRAG) {
      const ragStart = Date.now();
      const ragSystem = new RAGSystem();
      console.log("📚 [GENERATE V2] RAG system created");
      
      await ragSystem.initialize();
      console.log("📚 [GENERATE V2] RAG system initialized:", ragSystem.initialized);

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
      console.log(`📚 [GENERATE V2] RAG search completed in ${timing.ragSearch}ms`);
    }

    // 2. Enhance the prompt for better structure
    console.log("🎯 [GENERATE V2] Enhancing prompt for better structure...");
    const enhancedPromptData = promptEnhancer.enhance(input, {
      platform,
      complexity,
      ragContext: relevantDocs
    });
    
    console.log("📊 [GENERATE V2] Enhanced prompt metadata:", enhancedPromptData.metadata);

    // 3. Generate with Claude using enhanced prompt
    console.log("🤖 [GENERATE V2] Calling Claude API with enhanced prompt...");
    const genStart = Date.now();
    const claudeResponse = await anthropicClient.generateWorkflow(
      enhancedPromptData, // Pass the full enhanced prompt data object
      {
        model: "claude-opus-4-20250514", // Use the specified model
        platform,
        complexity,
        temperature: 0.1,
        maxTokens: 4000,
      }
    );
    timing.generation = Date.now() - genStart;
    console.log("🤖 [GENERATE V2] Claude response received in", timing.generation, "ms");

    // 4. Parse JSON with detailed logging
    console.log("📋 [GENERATE V2] Extracting JSON from Claude response...");
    console.log("🔍 [DEBUG] Raw AI response preview:", claudeResponse.content.substring(0, 500));
    
    let workflow = claudeOptimizer.extractAndValidateJSON(
      claudeResponse.content
    );
    console.log("📋 [GENERATE V2] JSON extracted successfully");
    console.log("🔍 [DEBUG] Extracted workflow structure:", {
      hasNodes: !!workflow.nodes,
      nodeCount: workflow.nodes?.length || 0,
      hasConnections: !!workflow.connections,
      topLevelKeys: Object.keys(workflow)
    });

    // 5. Validate AI workflow structure
    const structureValidation = validateAIWorkflowStructure(workflow);
    console.log("🔍 [GENERATE V2] Structure validation:", structureValidation);
    
    if (!structureValidation.valid) {
      console.error("❌ Invalid workflow structure from AI:", structureValidation.errors);
      
      if (structureValidation.reconstructed) {
        console.log("🔧 Using reconstructed workflow");
        workflow = structureValidation.reconstructed;
      } else {
        // Try one more reconstruction attempt
        console.log("⚠️ Attempting final reconstruction...");
        workflow = reconstructWorkflowFromParams(workflow) || {
          name: "Fallback Workflow",
          nodes: [{
            id: workflowFixer.generateNodeId(),
            name: "Manual Task",
            type: "n8n-nodes-base.manualTrigger",
            typeVersion: 1,
            position: [250, 300],
            parameters: {}
          }],
          connections: {},
          settings: { executionOrder: "v1" }
        };
      }
    }

    // 6. Ensure workflow has all required fields
    if (!workflow.name) workflow.name = "Generated Workflow";
    if (!workflow.nodes) workflow.nodes = [];
    if (!workflow.connections) workflow.connections = {};
    if (!workflow.settings) workflow.settings = { executionOrder: "v1" };
    
    console.log("🔍 [DEBUG] Workflow after structure validation:", {
      name: workflow.name,
      nodeCount: workflow.nodes.length,
      nodes: workflow.nodes.map(n => ({ name: n.name, type: n.type }))
    });

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
    console.log("🔧 [GENERATE V2] Starting format fixes...");
    const fixStart = Date.now();
    let formatFixSuggestions = [];
    if (platform === "n8n") {
      console.log("🔧 Applying n8n format fixes...");
      
      // Track Google Drive nodes before fixes
      const driveNodesBefore = workflow.nodes?.filter(n => n.type === "n8n-nodes-base.googleDrive");
      if (driveNodesBefore?.length > 0) {
        console.log("🔍 Google Drive nodes BEFORE formatFixer:");
        driveNodesBefore.forEach(node => {
          console.log(`  - ${node.name}: parents = ${JSON.stringify(node.parameters?.parents)}`);
        });
      }
      
      const fixResult = workflowFixer.fixN8nWorkflow(workflow);
      workflow = fixResult.workflow;
      formatFixSuggestions = fixResult.suggestions || [];
      console.log("✅ Format fixes applied");
      
      // Track Google Drive nodes after fixes
      const driveNodesAfter = workflow.nodes?.filter(n => n.type === "n8n-nodes-base.googleDrive");
      if (driveNodesAfter?.length > 0) {
        console.log("🔍 Google Drive nodes AFTER formatFixer:");
        driveNodesAfter.forEach(node => {
          console.log(`  - ${node.name}: parents = ${JSON.stringify(node.parameters?.parents)}`);
        });
      }

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
    console.log("🔍 [GENERATE V2] Starting n8n validation...");
    let n8nValidationResult = null;
    if (
      validateWithN8n &&
      platform === "n8n" &&
      (process.env.N8N_API_KEY || process.env.N8N_WEBHOOK_URL)
    ) {
      const valStart = Date.now();
      console.log("🔍 Starting n8n validation and auto-fix loop...");

      try {
        // Create a strictly cleaned version for n8n validation
        const cleanedForValidation = strictCleanForValidation(workflow);
        console.log("🧹 Created strictly cleaned workflow for n8n validation");
        
        // Detailed logging to identify validation issues
        console.log('🔍 Workflow being sent to n8n validation:');
        console.log('📋 Top-level fields:', Object.keys(cleanedForValidation));
        console.log('📋 Node count:', cleanedForValidation.nodes?.length || 0);
        
        // Check for problematic fields in nodes
        cleanedForValidation.nodes?.forEach((node, index) => {
          const standardNodeFields = ['id', 'name', 'type', 'typeVersion', 'position', 'parameters', 'credentials'];
          const extraFields = Object.keys(node).filter(field => !standardNodeFields.includes(field));
          if (extraFields.length > 0) {
            console.log(`⚠️ Node ${index} (${node.name}) has extra fields:`, extraFields);
          }
          
          // Check for webhookId specifically
          if (node.webhookId) {
            console.log(`❌ Node ${index} (${node.name}) has webhookId field - this will cause validation failure`);
          }
          
          // Check Google Drive parents structure
          if (node.type === 'n8n-nodes-base.googleDrive' && node.parameters?.parents) {
            console.log(`🔍 Google Drive node ${node.name} parents structure:`, JSON.stringify(node.parameters.parents));
          }
        });
        
        // Removed basic structure test - proceed directly with validation
        // This allows the validation loop to handle errors and retry up to 5 times
        n8nValidationResult = await n8nValidator.validateAndFix(
          cleanedForValidation,
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
    console.log("🧹 [GENERATE V2] Cleaning workflow for export...");
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
    const inputTokens = anthropicClient.estimateTokens(enhancedPromptData.enhanced);
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
      formatFixSuggestions: formatFixSuggestions,
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
    console.log("📤 [GENERATE V2] Preparing response...");
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

        // CRITICAL: Validate Google Drive nodes have __rl structure
        if (node.type === "n8n-nodes-base.googleDrive") {
          // Ensure __rl fields are present
          if (!node.parameters?.driveId?.__rl || !node.parameters?.folderId?.__rl) {
            console.error(`❌ Google Drive node missing __rl structure!`);
            console.log(`Current structure:`, JSON.stringify(node.parameters, null, 2));
            
            // Emergency fix - add the structure back
            if (!node.parameters.driveId || !node.parameters.driveId.__rl) {
              node.parameters.driveId = {
                "__rl": true,
                "mode": "list",
                "value": "My Drive"
              };
            }
            
            if (!node.parameters.folderId || !node.parameters.folderId.__rl) {
              node.parameters.folderId = {
                "__rl": true,
                "mode": "list",
                "value": "root",
                "cachedResultName": "/ (Root folder)"
              };
            }

            console.log(`✅ Emergency fixed Google Drive node "${node.name}" __rl structure`);
          } else {
            console.log(`✅ Google Drive node "${node.name}" has valid __rl structure`);
          }
        }
      });

      // Deep copy the fixed cleanedWorkflow
      const importReadyWorkflow = JSON.parse(JSON.stringify(cleanedWorkflow));

      // CRITICAL: Final check to ensure Google Drive nodes have options field
      importReadyWorkflow.nodes?.forEach(node => {
        if (node.type === 'n8n-nodes-base.googleDrive') {
          if (!node.parameters) node.parameters = {};
          if (!node.parameters.options) {
            node.parameters.options = {};
            console.log(`✅ FINAL IMPORT CHECK: Added required options to Google Drive node "${node.name}"`);
          } else {
            console.log(`✅ FINAL IMPORT CHECK: Google Drive node "${node.name}" has options field`);
          }
        }
      });

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

    // Track analytics
    try {
      // Check if analytics and the method exist
      if (analytics && typeof analytics.trackGeneration === 'function') {
        await analytics.trackGeneration({
          userId: req.headers.get('x-user-id') || 'anonymous',
          platform,
          input,
          success: true,
          generationTime: timing.total,
          tokensUsed: inputTokens + outputTokens,
          complexity: complexity === 'simple' ? 30 : complexity === 'moderate' ? 60 : 90,
          workflowId: cleanedWorkflow.id || Date.now().toString(),
          n8nValidation: n8nValidationResult ? {
            tested: true,
            success: n8nValidationResult.success,
            attempts: n8nValidationResult.attempts,
            validationTime: timing.n8nValidation
          } : null
        });
      } else {
        console.log('Analytics tracking not available - trackGeneration method missing');
      }

      // Track n8n validation separately if it was performed
      if (n8nValidationResult && n8nValidationResult.validated && 
          analytics && typeof analytics.trackN8nValidation === 'function') {
        const lastError = n8nValidationResult.history?.find(h => !h.success);
        await analytics.trackN8nValidation({
          workflowId: cleanedWorkflow.id || Date.now().toString(),
          success: n8nValidationResult.success,
          attempts: n8nValidationResult.attempts,
          validationTime: timing.n8nValidation,
          errorType: lastError?.errorType || null,
          fixApplied: lastError?.errorType || null,
          fromCache: n8nValidationResult.fromCache || false,
          cacheHitRate: n8nValidationResult.cacheStats?.hitRate || null
        });
      }
    } catch (analyticsError) {
      console.error('Analytics tracking error:', analyticsError);
      // Don't fail the request due to analytics errors
    }

    console.log("✅ [GENERATE V2] Sending response");
    return NextResponse.json(response);
  } catch (error) {
    console.error("❌ [GENERATE V2] Error:", error);
    console.error("❌ [GENERATE V2] Stack:", error.stack);

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
