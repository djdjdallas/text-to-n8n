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

// src/lib/ai/workflowOrchestrator.js
export class WorkflowOrchestrator {
  constructor() {
    this.agents = {
      parser: new IntentParserAgent(),
      planner: new WorkflowPlannerAgent(),
      generator: new JsonGeneratorAgent(),
      validator: new ValidationAgent(),
      optimizer: new OptimizationAgent(),
    };
    this.ragSystem = new RAGSystem();
  }

  async orchestrate(input, platform, options) {
    const context = {
      input,
      platform,
      options,
      ragDocs: [],
      errors: [],
      iterations: 0,
    };

    try {
      // Phase 1: Understanding
      context.intent = await this.agents.parser.parse(input);
      context.ragDocs = await this.ragSystem.getRelevantDocs(input, platform, {
        includeExamples: true,
      });

      // Phase 2: Planning
      context.plan = await this.agents.planner.plan(
        context.intent,
        context.ragDocs,
        platform
      );

      // Phase 3: Generation with retry logic
      let workflow = null;
      const maxRetries = 3;

      while (context.iterations < maxRetries) {
        workflow = await this.agents.generator.generate(
          context.plan,
          platform,
          context.ragDocs
        );

        const validation = await this.agents.validator.validate(
          workflow,
          platform
        );

        if (validation.valid) {
          break;
        }

        // Learn from errors and refine
        context.errors.push(validation.errors);
        context.plan = await this.refinePlan(context);
        context.iterations++;
      }

      // Phase 4: Optimization
      if (workflow && options.optimization > 0) {
        workflow = await this.agents.optimizer.optimize(
          workflow,
          platform,
          options.optimization
        );
      }

      return {
        workflow,
        metadata: this.buildMetadata(context),
        suggestions: this.generateSuggestions(context),
      };
    } catch (error) {
      console.error("Orchestration error:", error);
      throw new WorkflowGenerationError(error.message, context);
    }
  }

  async refinePlan(context) {
    // Use errors to improve the plan
    const errorAnalysis = this.analyzeErrors(context.errors);

    // Get more specific documentation
    const specificDocs = await this.ragSystem.getRelevantDocs(
      errorAnalysis.missingInfo,
      context.platform,
      { docTypes: errorAnalysis.neededDocTypes }
    );

    // Refine the plan with new information
    return this.agents.planner.refine(
      context.plan,
      errorAnalysis,
      specificDocs
    );
  }
}
