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

// src/lib/documentationStructure.js
/*
Documentation Structure:

/docs
  /n8n
    /nodes
      - trigger-nodes.json
      - action-nodes.json
      - transform-nodes.json
    /examples
      - email-workflows.json
      - api-workflows.json
      - database-workflows.json
    /schemas
      - workflow-schema.json
      - node-schemas.json
    /guides
      - best-practices.md
      - error-handling.md
      - performance.md
    
  /zapier
    /triggers
      - webhook-triggers.json
      - schedule-triggers.json
      - app-triggers.json
    /actions
      - create-actions.json
      - update-actions.json
      - search-actions.json
    /examples
      - marketing-zaps.json
      - sales-zaps.json
      - productivity-zaps.json
    /schemas
      - zap-schema.json
      - field-types.json
    
  /make
    /modules
      - http-modules.json
      - transform-modules.json
      - flow-modules.json
    /scenarios
      - basic-scenarios.json
      - advanced-scenarios.json
    /examples
      - data-processing.json
      - integration-patterns.json
    /schemas
      - scenario-schema.json
      - module-config.json
*/

// src/scripts/indexDocumentation.js
import { DocumentationLoader } from "@/lib/rag/documentationLoader";
import { DocumentationStore } from "@/lib/rag/documentationStore";

async function indexAllDocumentation() {
  const loader = new DocumentationLoader();
  const store = new DocumentationStore();

  await store.initializeStore();

  for (const platform of ["n8n", "zapier", "make"]) {
    console.log(`Indexing ${platform} documentation...`);

    const docs = await loader.loadPlatformDocs(platform);
    await store.indexDocumentation(platform, docs);

    console.log(`Indexed ${docs.length} documents for ${platform}`);
  }
}

// Run this script to index documentation
// npm run index-docs

// src/lib/validators/platformSchemas.js
export const platformSchemas = {
  n8n: {
    workflow: {
      type: "object",
      required: ["name", "nodes", "connections", "settings"],
      properties: {
        name: { type: "string" },
        nodes: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "name", "type", "typeVersion", "position"],
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              type: { type: "string" },
              typeVersion: { type: "number" },
              position: {
                type: "array",
                items: { type: "number" },
                minItems: 2,
                maxItems: 2,
              },
              parameters: { type: "object" },
              credentials: { type: "object" },
            },
          },
        },
        connections: {
          type: "object",
          patternProperties: {
            "^.*$": {
              type: "object",
              patternProperties: {
                "^.*$": {
                  type: "array",
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        node: { type: "string" },
                        type: { type: "string" },
                        index: { type: "number" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        settings: {
          type: "object",
          properties: {
            executionOrder: { type: "string" },
            saveManualExecutions: { type: "boolean" },
            callerPolicy: { type: "string" },
            errorWorkflow: { type: "string" },
          },
        },
      },
    },
  },
  zapier: {
    zap: {
      type: "object",
      required: ["trigger", "actions"],
      properties: {
        trigger: {
          type: "object",
          required: ["app", "event"],
          properties: {
            app: { type: "string" },
            event: { type: "string" },
            input: { type: "object" },
          },
        },
        actions: {
          type: "array",
          items: {
            type: "object",
            required: ["app", "action"],
            properties: {
              app: { type: "string" },
              action: { type: "string" },
              input: { type: "object" },
              conditions: { type: "array" },
            },
          },
        },
      },
    },
  },
  make: {
    scenario: {
      type: "object",
      required: ["name", "modules", "routes"],
      properties: {
        name: { type: "string" },
        modules: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "module", "version"],
            properties: {
              id: { type: "number" },
              module: { type: "string" },
              version: { type: "number" },
              parameters: { type: "object" },
              mapper: { type: "object" },
              metadata: { type: "object" },
            },
          },
        },
        routes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              flow: { type: "array" },
              filter: { type: "object" },
            },
          },
        },
      },
    },
  },
};
