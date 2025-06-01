// src/app/api/generate/route.js (Enhanced with Claude)
import { NextResponse } from "next/server";
import { WorkflowGenerator } from "@/lib/ai/workflowGenerator";
import { RAGSystem } from "@/lib/rag/ragSystem";
import { validateRequest } from "@/lib/validators/requestValidator";
import { cacheManager } from "@/lib/cache/cacheManager";
import { anthropicClient } from "@/lib/ai/anthropicClient";
import { claudeOptimizer } from "@/lib/prompts/claudeTemplates";
import { workflowValidator } from "@/lib/validation/workflowValidator";

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

    const {
      input,
      platform,
      complexity,
      errorHandling,
      optimization,
      provider = "claude", // Default to Claude
      useRAG = true,
      validateOutput = true,
    } = body;

    // Enhanced cache key including provider
    const cacheKey = cacheManager.generateKey(
      input,
      platform,
      complexity,
      provider
    );
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      return NextResponse.json({
        ...cached,
        metadata: { ...cached.metadata, fromCache: true },
      });
    }

    // Initialize RAG system if needed
    await ragSystem.initialize();

    // Generate workflow with Claude enhancements
    const result = await generateEnhancedWorkflow(input, platform, {
      complexity,
      errorHandling,
      optimization,
      provider,
      useRAG,
      validateOutput,
      ragSystem,
      generator,
    });

    // Cache the result with extended metadata
    await cacheManager.set(cacheKey, result, 3600); // 1 hour TTL

    // Track generation for analytics
    await trackGeneration({
      platform,
      input,
      success: true,
      provider,
      ...result.metadata,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Workflow generation error:", error);

    // Track failed generation
    await trackGeneration({
      platform: body?.platform,
      input: body?.input,
      success: false,
      provider: body?.provider || "claude",
      error: error.message,
    });

    // Return enhanced error response
    return NextResponse.json(
      {
        error: "Failed to generate workflow",
        message: error.message,
        suggestions: getEnhancedErrorSuggestions(error),
        metadata: {
          provider: body?.provider || "claude",
          errorType: classifyError(error),
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Enhanced workflow generation with Claude integration
 */
async function generateEnhancedWorkflow(input, platform, options) {
  const {
    complexity,
    errorHandling,
    optimization,
    provider,
    useRAG,
    validateOutput,
    ragSystem,
    generator,
  } = options;

  const startTime = Date.now();

  try {
    // Choose generation strategy based on provider
    let result;

    if (provider === "claude") {
      result = await generateWithClaude(input, platform, options);
    } else {
      // Fallback to existing generator for other providers
      result = await generator.generateWorkflow(input, platform, {
        complexity,
        errorHandling,
        optimization,
        ragSystem,
      });
    }

    const generationTime = Date.now() - startTime;

    // Add enhanced metadata
    result.metadata = {
      ...result.metadata,
      provider,
      generationTime,
      ragEnhanced: useRAG,
      validated: validateOutput,
      timestamp: new Date().toISOString(),
    };

    return result;
  } catch (error) {
    // Try fallback if Claude fails
    if (provider === "claude" && process.env.OPENAI_API_KEY) {
      console.warn(
        "Claude failed, falling back to existing generator:",
        error.message
      );

      const fallbackResult = await generator.generateWorkflow(input, platform, {
        complexity,
        errorHandling,
        optimization,
        ragSystem,
      });

      fallbackResult.metadata = {
        ...fallbackResult.metadata,
        provider: "fallback",
        originalProvider: "claude",
        fallbackReason: error.message,
        generationTime: Date.now() - startTime,
      };

      return fallbackResult;
    }

    throw error;
  }
}

/**
 * Generate workflow using Claude with RAG enhancement
 */
async function generateWithClaude(input, platform, options) {
  const {
    complexity,
    errorHandling,
    optimization,
    useRAG,
    validateOutput,
    ragSystem,
  } = options;

  // 1. Get RAG-enhanced context if enabled
  let relevantDocs = [];
  let ragMetadata = {};

  if (useRAG && ragSystem) {
    try {
      const ragResult = await ragSystem.getRelevantContext(input, platform, {
        maxDocuments: 5,
        minRelevance: 0.7,
      });

      relevantDocs = ragResult.documents || [];
      ragMetadata = {
        docsRetrieved: relevantDocs.length,
        avgRelevance: ragResult.avgRelevance || 0,
        searchQueries: ragResult.searchQueries || [],
      };
    } catch (ragError) {
      console.warn("RAG enhancement failed:", ragError.message);
      // Continue without RAG
    }
  }

  // 2. Generate Claude-optimized prompt
  const promptResult = await claudeOptimizer.generateOptimizedPrompt(
    platform,
    input,
    relevantDocs,
    { complexity, errorHandling, optimization, includeExamples: true }
  );

  const systemPrompt = claudeOptimizer.generateSystemPrompt(
    platform,
    complexity
  );

  // 3. Generate with Claude
  const claudeResponse = await anthropicClient.generateWorkflow(promptResult, {
    platform,
    complexity,
    maxTokens: getOptimalTokenLimit(complexity, input.length),
    temperature: getOptimalTemperature(complexity),
    systemPrompt,
  });

  // 4. Parse and clean response
  const workflowJson = claudeOptimizer.extractAndValidateJSON(
    claudeResponse.content
  );

  // 5. Validate output if requested
  let validation = null;
  if (validateOutput) {
    try {
      validation = await workflowValidator.validateWorkflow(
        platform,
        workflowJson,
        {
          errorHandling,
          complexity,
          requiredApps: extractAppsFromInput(input),
        }
      );
    } catch (validationError) {
      console.warn("Validation failed:", validationError.message);
      validation = {
        isValid: false,
        errors: [
          { type: "VALIDATION_ERROR", message: validationError.message },
        ],
        warnings: [],
        suggestions: [],
        score: 0,
      };
    }
  }

  // 6. Calculate costs and usage
  const inputTokens = anthropicClient.estimateTokens(promptResult);
  const outputTokens =
    claudeResponse.usage?.output_tokens ||
    anthropicClient.estimateTokens(claudeResponse.content);

  const cost = anthropicClient.calculateCost(
    inputTokens,
    outputTokens,
    claudeResponse.model
  );

  return {
    workflow: workflowJson,
    validation,
    metadata: {
      provider: "claude",
      model: claudeResponse.model,
      inputTokens,
      outputTokens,
      cost: cost.totalCost,
      complexity: validation?.score || calculateComplexityScore(workflowJson),
      promptLength: promptResult.length,
      ...ragMetadata,
    },
  };
}

/**
 * Get optimal token limit based on complexity and input length
 */
function getOptimalTokenLimit(complexity, inputLength) {
  const baseLimits = {
    simple: 2000,
    moderate: 4000,
    complex: 6000,
  };

  let limit = baseLimits[complexity] || baseLimits.moderate;

  // Adjust based on input length
  if (inputLength > 2000) {
    limit += 1000;
  }

  return Math.min(limit, 8000); // Claude's max output tokens
}

/**
 * Get optimal temperature based on complexity
 */
function getOptimalTemperature(complexity) {
  const temperatures = {
    simple: 0.1, // More deterministic
    moderate: 0.1, // Balanced
    complex: 0.05, // Very deterministic for complex logic
  };

  return temperatures[complexity] || temperatures.moderate;
}

/**
 * Extract mentioned apps from user input for validation
 */
function extractAppsFromInput(input) {
  const apps = [];
  const appPatterns = {
    gmail: /gmail|google mail/gi,
    slack: /slack/gi,
    "google-drive": /google drive|gdrive/gi,
    salesforce: /salesforce|sfdc/gi,
    hubspot: /hubspot/gi,
    trello: /trello/gi,
    asana: /asana/gi,
    notion: /notion/gi,
    discord: /discord/gi,
    shopify: /shopify/gi,
    stripe: /stripe/gi,
    mailchimp: /mailchimp/gi,
  };

  Object.entries(appPatterns).forEach(([app, pattern]) => {
    if (pattern.test(input)) {
      apps.push(app);
    }
  });

  return apps;
}

/**
 * Calculate basic complexity score for workflow
 */
function calculateComplexityScore(workflow) {
  let score = 0;

  // Count main components
  const componentCount =
    workflow.nodes?.length ||
    workflow.steps?.length ||
    workflow.flow?.length ||
    0;
  score += componentCount * 5;

  // Count connections/relationships
  const connectionCount =
    Object.keys(workflow.connections || {}).length ||
    workflow.connections?.length ||
    0;
  score += connectionCount * 3;

  // Check for conditional logic
  const workflowString = JSON.stringify(workflow).toLowerCase();
  const conditionalKeywords = ["if", "condition", "filter", "router", "path"];
  conditionalKeywords.forEach((keyword) => {
    const matches = (workflowString.match(new RegExp(keyword, "g")) || [])
      .length;
    score += matches * 10;
  });

  return Math.min(score, 100);
}

/**
 * Enhanced error suggestions with Claude-specific guidance
 */
function getEnhancedErrorSuggestions(error) {
  const suggestions = [];
  const errorMessage = error.message.toLowerCase();

  // Claude-specific errors
  if (errorMessage.includes("anthropic") || errorMessage.includes("claude")) {
    if (errorMessage.includes("rate limit")) {
      suggestions.push(
        "Claude API rate limit reached - try again in a few moments"
      );
      suggestions.push(
        "Consider upgrading your Anthropic plan for higher limits"
      );
    } else if (errorMessage.includes("invalid")) {
      suggestions.push("Check your Anthropic API key configuration");
      suggestions.push("Ensure ANTHROPIC_API_KEY is set correctly");
    } else if (errorMessage.includes("context")) {
      suggestions.push(
        "Try reducing the complexity or length of your description"
      );
      suggestions.push("Break down complex workflows into simpler steps");
    }
  }

  // JSON parsing errors
  if (errorMessage.includes("json") || errorMessage.includes("parse")) {
    suggestions.push("The AI had trouble generating valid JSON - try again");
    suggestions.push("Try simplifying your workflow description");
  }

  // Platform-specific errors
  if (errorMessage.includes("platform")) {
    suggestions.push("Supported platforms: n8n, zapier, make");
    suggestions.push("Check that your platform selection is correct");
  }

  // RAG errors
  if (errorMessage.includes("rag") || errorMessage.includes("context")) {
    suggestions.push(
      "Documentation search failed - continuing without enhanced context"
    );
    suggestions.push(
      "Your workflow will still be generated using base knowledge"
    );
  }

  // Validation errors
  if (errorMessage.includes("validation")) {
    suggestions.push("The generated workflow had validation issues");
    suggestions.push(
      "Try being more specific about the apps and actions you want"
    );
  }

  // Generic fallbacks
  if (suggestions.length === 0) {
    suggestions.push("Try rephrasing your workflow description");
    suggestions.push("Ensure all app names are spelled correctly");
    suggestions.push("Break complex workflows into simpler steps");
  }

  return suggestions;
}

/**
 * Classify error type for better tracking
 */
function classifyError(error) {
  const message = error.message.toLowerCase();

  if (message.includes("rate limit")) return "RATE_LIMIT";
  if (message.includes("anthropic") || message.includes("claude"))
    return "CLAUDE_API";
  if (message.includes("json") || message.includes("parse"))
    return "JSON_PARSING";
  if (message.includes("validation")) return "VALIDATION";
  if (message.includes("rag") || message.includes("context"))
    return "RAG_ERROR";
  if (message.includes("platform")) return "PLATFORM_ERROR";
  if (message.includes("timeout")) return "TIMEOUT";

  return "UNKNOWN";
}

/**
 * Track generation for analytics
 */
async function trackGeneration(data) {
  try {
    const { supabase } = await import("@/lib/supabase/client");

    await supabase.from("workflow_generations").insert({
      platform: data.platform,
      input_text: data.input,
      workflow_json: data.workflow,
      success: data.success,
      error_details: data.error
        ? {
            message: data.error,
            type: data.errorType || "UNKNOWN",
          }
        : null,
      generation_time_ms: data.generationTime,
      tokens_used: (data.inputTokens || 0) + (data.outputTokens || 0),
      model_used: data.model || `${data.provider}-unknown`,
      complexity_score: data.complexity || null,
      feedback_score: null, // Can be updated later by user
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to track generation:", error);
    // Don't throw - analytics failure shouldn't break generation
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  try {
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      providers: {
        claude: {
          configured: !!process.env.ANTHROPIC_API_KEY,
          available: true,
        },
        openai: {
          configured: !!process.env.OPENAI_API_KEY,
          available: true,
        },
      },
      features: {
        rag: true,
        validation: true,
        caching: true,
        analytics: true,
      },
    };

    // Test Claude connection if configured
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const models = anthropicClient.getAvailableModels();
        health.providers.claude.models = Object.keys(models);
        health.providers.claude.recommended = "claude-3-5-sonnet-20241022";
      } catch (error) {
        health.providers.claude.available = false;
        health.providers.claude.error = error.message;
      }
    }

    return NextResponse.json(health);
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
