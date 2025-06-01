// src/lib/prompts/platformTemplates.js
import { docProcessor } from "@/lib/documentation/processor";
import { PLATFORMS, COMPLEXITY_LEVELS } from "@/lib/constants";

/**
 * Platform-Specific Generation Prompt Templates
 * Uses RAG to enhance prompts with relevant documentation
 */

export class PlatformPromptGenerator {
  constructor() {
    this.maxContextLength = 8000; // characters
    this.relevanceThreshold = 0.75;
  }

  /**
   * Generate enhanced prompt for workflow creation
   */
  async generatePrompt(platform, userInput, options = {}) {
    const {
      complexity = COMPLEXITY_LEVELS.MODERATE,
      errorHandling = true,
      optimization = 50,
      includeExamples = true,
    } = options;

    // Get relevant documentation
    const relevantDocs = await this.getRelevantDocumentation(
      platform,
      userInput
    );

    // Build platform-specific prompt
    const prompt = await this.buildPlatformPrompt(
      platform,
      userInput,
      relevantDocs,
      { complexity, errorHandling, optimization, includeExamples }
    );

    return prompt;
  }

  /**
   * Get relevant documentation using RAG
   */
  async getRelevantDocumentation(platform, userInput) {
    try {
      // Extract key terms and concepts from user input
      const searchQueries = this.extractSearchQueries(userInput);

      const allDocs = [];

      // Search for each query
      for (const query of searchQueries) {
        const docs = await docProcessor.searchSimilarDocs(query, platform, {
          matchThreshold: this.relevanceThreshold,
          matchCount: 5,
        });
        allDocs.push(...docs);
      }

      // Deduplicate and rank by relevance
      const uniqueDocs = this.deduplicateAndRank(allDocs);

      // Limit context size
      return this.limitContextSize(uniqueDocs);
    } catch (error) {
      console.error("Error fetching relevant documentation:", error);
      return [];
    }
  }

  /**
   * Extract search queries from user input
   */
  extractSearchQueries(userInput) {
    const queries = [];

    // Main query
    queries.push(userInput);

    // Extract app/service names (basic regex patterns)
    const appPatterns = [
      /gmail|google mail/gi,
      /slack/gi,
      /google drive|gdrive/gi,
      /salesforce|sfdc/gi,
      /hubspot/gi,
      /mailchimp/gi,
      /trello/gi,
      /asana/gi,
      /discord/gi,
      /shopify/gi,
      /stripe/gi,
      /zoom/gi,
      /teams|microsoft teams/gi,
      /dropbox/gi,
      /notion/gi,
      /airtable/gi,
    ];

    appPatterns.forEach((pattern) => {
      const matches = userInput.match(pattern);
      if (matches) {
        queries.push(...matches.map((match) => `${match} integration`));
      }
    });

    // Extract action verbs
    const actionPatterns = [
      /send|email|notify/gi,
      /create|add|insert/gi,
      /update|modify|change/gi,
      /delete|remove/gi,
      /sync|synchronize/gi,
      /trigger|when|if/gi,
      /filter|condition/gi,
      /transform|format|convert/gi,
    ];

    actionPatterns.forEach((pattern) => {
      const matches = userInput.match(pattern);
      if (matches) {
        queries.push(...matches.map((match) => `${match} action`));
      }
    });

    return [...new Set(queries)]; // Remove duplicates
  }

  /**
   * Deduplicate and rank documents by relevance
   */
  deduplicateAndRank(docs) {
    const seen = new Set();
    const unique = [];

    // Sort by similarity score first
    docs.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    for (const doc of docs) {
      const key = `${doc.title}-${doc.chunk_index || 0}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(doc);
      }
    }

    return unique;
  }

  /**
   * Limit context size to fit within token limits
   */
  limitContextSize(docs) {
    let totalLength = 0;
    const limited = [];

    for (const doc of docs) {
      const docLength = doc.content.length;
      if (totalLength + docLength <= this.maxContextLength) {
        limited.push(doc);
        totalLength += docLength;
      } else {
        break;
      }
    }

    return limited;
  }

  /**
   * Build platform-specific prompt
   */
  async buildPlatformPrompt(platform, userInput, relevantDocs, options) {
    const basePrompt = this.getBasePlatformPrompt(platform);
    const contextSection = this.buildContextSection(relevantDocs);
    const examplesSection = await this.getExamplesSection(
      platform,
      options.includeExamples
    );
    const constraintsSection = this.buildConstraintsSection(platform, options);

    return `${basePrompt}

${contextSection}

${examplesSection}

${constraintsSection}

## User Request
${userInput}

## Instructions
Generate a valid ${platform} workflow JSON that accomplishes the user's request. Use the provided documentation context to ensure accuracy and include all necessary configuration parameters.

Response format: Valid JSON only, no explanations or markdown.`;
  }

  /**
   * Get base platform-specific prompt
   */
  getBasePlatformPrompt(platform) {
    const prompts = {
      [PLATFORMS.N8N]: `You are an expert n8n workflow automation specialist. Generate valid n8n workflow JSON based on user requirements.

## n8n Workflow Structure
- Workflows contain nodes (triggers, actions, conditionals)
- Nodes connect via input/output relationships
- Each node has a unique ID, type, name, and parameters
- Data flows between nodes using expressions like {{$node["NodeName"].json.field}}
- Credentials are referenced by name, not included in the workflow`,

      [PLATFORMS.ZAPIER]: `You are an expert Zapier automation specialist. Generate valid Zap JSON based on user requirements.

## Zapier Zap Structure  
- Zaps contain steps (triggers and actions)
- Steps execute sequentially with data mapping
- Each step has configuration fields and authentication
- Dynamic fields use {{field_name}} syntax
- Filters and formatters can be added between steps`,

      [PLATFORMS.MAKE]: `You are an expert Make (Integromat) scenario specialist. Generate valid Make scenario JSON based on user requirements.

## Make Scenario Structure
- Scenarios contain modules (triggers, actions, aggregators, iterators)
- Modules connect via routes and data mapping
- Each module has configuration parameters and filters
- Data is processed in bundles with mapping between modules
- Error handling uses error routes and rollback mechanisms`,
    };

    return prompts[platform] || prompts[PLATFORMS.N8N];
  }

  /**
   * Build documentation context section
   */
  buildContextSection(relevantDocs) {
    if (!relevantDocs || relevantDocs.length === 0) {
      return "## Documentation Context\nNo specific documentation found for this request.";
    }

    let context =
      "## Documentation Context\nRelevant documentation for your request:\n\n";

    relevantDocs.forEach((doc, index) => {
      context += `### ${doc.title}\n`;
      context += `${doc.content}\n\n`;

      if (doc.metadata?.parameters) {
        context += `**Parameters:** ${JSON.stringify(
          doc.metadata.parameters,
          null,
          2
        )}\n\n`;
      }
    });

    return context;
  }

  /**
   * Get platform-specific examples
   */
  async getExamplesSection(platform, includeExamples) {
    if (!includeExamples) return "";

    const examples = {
      [PLATFORMS.N8N]: `## n8n Example Structure
\`\`\`json
{
  "name": "Example Workflow",
  "nodes": [
    {
      "id": "1",
      "name": "Trigger",
      "type": "n8n-nodes-base.trigger",
      "position": [240, 300],
      "parameters": {}
    },
    {
      "id": "2", 
      "name": "Action",
      "type": "n8n-nodes-base.action",
      "position": [460, 300],
      "parameters": {
        "values": {
          "string": [
            {
              "name": "field",
              "value": "={{$node[\\"Trigger\\"].json[\\"data\\"]}}"
            }
          ]
        }
      }
    }
  ],
  "connections": {
    "Trigger": {
      "main": [
        [
          {
            "node": "Action",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
\`\`\``,

      [PLATFORMS.ZAPIER]: `## Zapier Example Structure
\`\`\`json
{
  "name": "Example Zap",
  "steps": [
    {
      "id": "trigger",
      "type": "trigger",
      "app": "gmail",
      "event": "new_email",
      "configuration": {
        "label": "New Email in Gmail"
      }
    },
    {
      "id": "action",
      "type": "action", 
      "app": "slack",
      "event": "send_message",
      "configuration": {
        "channel": "#general",
        "message": "New email: {{trigger.subject}}"
      }
    }
  ]
}
\`\`\``,

      [PLATFORMS.MAKE]: `## Make Example Structure
\`\`\`json
{
  "name": "Example Scenario",
  "flow": [
    {
      "id": 1,
      "module": "gmail:trigger",
      "version": 1,
      "parameters": {
        "watch": "inbox"
      },
      "mapper": {},
      "metadata": {
        "designer": {
          "x": 0,
          "y": 0
        }
      }
    },
    {
      "id": 2,
      "module": "slack:sendMessage", 
      "version": 1,
      "parameters": {
        "channel": "#general"
      },
      "mapper": {
        "text": "{{1.subject}}"
      },
      "metadata": {
        "designer": {
          "x": 300,
          "y": 0
        }
      }
    }
  ],
  "connections": [
    {
      "id": 1,
      "srcModuleId": 1,
      "srcIndex": 0,
      "dstModuleId": 2,
      "dstIndex": 0
    }
  ]
}
\`\`\``,
    };

    return examples[platform] || "";
  }

  /**
   * Build constraints section based on options
   */
  buildConstraintsSection(platform, options) {
    let constraints = "## Generation Constraints\n";

    constraints += `- Platform: ${platform}\n`;
    constraints += `- Complexity Level: ${options.complexity}\n`;

    if (options.errorHandling) {
      constraints += "- Include error handling and validation\n";
    }

    constraints += `- Optimization Level: ${options.optimization}%\n`;

    // Platform-specific constraints
    const platformConstraints = {
      [PLATFORMS.N8N]: [
        "- Use proper n8n node types and parameters",
        "- Include position coordinates for visual layout",
        '- Use expressions for data mapping: {{$node["Name"].json.field}}',
        "- Reference credentials by name only",
        "- Ensure all connections are properly defined",
      ],
      [PLATFORMS.ZAPIER]: [
        "- Use valid Zapier app names and trigger/action events",
        "- Include proper field mapping with {{field}} syntax",
        "- Add filters where appropriate for conditional logic",
        "- Use formatters for data transformation",
        "- Ensure authentication is properly configured",
      ],
      [PLATFORMS.MAKE]: [
        "- Use correct Make module names and versions",
        "- Include proper data mapping between modules",
        "- Add aggregators/iterators for batch processing",
        "- Use error routes for error handling",
        "- Include designer metadata for visual positioning",
      ],
    };

    if (platformConstraints[platform]) {
      constraints += platformConstraints[platform].join("\n") + "\n";
    }

    return constraints;
  }
}

// Export generator instance
export const promptGenerator = new PlatformPromptGenerator();

// Enhanced generation API route
// src/app/api/generate/enhanced/route.js
import { NextResponse } from "next/server";
import { promptGenerator } from "@/lib/prompts/platformTemplates";

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      input,
      platform,
      complexity,
      errorHandling,
      optimization,
      modelConfig = {},
    } = body;

    if (!input || !platform) {
      return NextResponse.json(
        { error: "Input and platform are required" },
        { status: 400 }
      );
    }

    // Generate enhanced prompt with RAG
    const enhancedPrompt = await promptGenerator.generatePrompt(
      platform,
      input,
      {
        complexity,
        errorHandling,
        optimization,
        includeExamples: true,
      }
    );

    // Call your preferred LLM API with the enhanced prompt
    const workflow = await generateWithLLM(enhancedPrompt, modelConfig);

    // Parse and validate the response
    let workflowJson;
    try {
      workflowJson =
        typeof workflow === "string" ? JSON.parse(workflow) : workflow;
    } catch (parseError) {
      throw new Error("Generated response is not valid JSON");
    }

    // Track generation for analytics
    await trackGeneration({
      platform,
      input,
      success: true,
      workflowJson,
      promptLength: enhancedPrompt.length,
    });

    return NextResponse.json({
      workflow: workflowJson,
      metadata: {
        platform,
        promptLength: enhancedPrompt.length,
        generationTime: Date.now(),
        enhancedWithRAG: true,
      },
    });
  } catch (error) {
    console.error("Enhanced generation error:", error);

    // Track failed generation
    await trackGeneration({
      platform: body?.platform,
      input: body?.input,
      success: false,
      error: error.message,
    });

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// LLM Integration - Claude + OpenAI Hybrid Approach
async function generateWithLLM(prompt, config) {
  const provider = config.provider || "claude"; // Default to Claude for generation

  if (provider === "claude") {
    return await generateWithClaude(prompt, config);
  } else if (provider === "openai") {
    return await generateWithOpenAI(prompt, config);
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

// Claude generation (RECOMMENDED for workflow JSON)
async function generateWithClaude(prompt, config) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model || "claude-3-5-sonnet-20241022",
      max_tokens: config.maxTokens || 4000,
      temperature: config.temperature || 0.1,
      messages: [
        {
          role: "user",
          content: `${prompt}

CRITICAL: Respond with ONLY valid JSON. No explanations, no markdown, no additional text. Just the workflow JSON.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Claude API error: ${error.error?.message || response.statusText}`
    );
  }

  const data = await response.json();
  return data.content[0].text;
}

// OpenAI generation (fallback option)
async function generateWithOpenAI(prompt, config) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model || "gpt-4-1106-preview",
      messages: [
        {
          role: "system",
          content:
            "You are a workflow automation expert. Generate ONLY valid JSON. No explanations or markdown.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: config.temperature || 0.1,
      max_tokens: config.maxTokens || 4000,
      response_format: { type: "json_object" }, // Force JSON mode
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `OpenAI API error: ${error.error?.message || response.statusText}`
    );
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Track generation for analytics
async function trackGeneration(data) {
  try {
    const { supabase } = await import("@/lib/supabase/client");

    await supabase.from("workflow_generations").insert({
      platform: data.platform,
      input_text: data.input,
      workflow_json: data.workflowJson,
      success: data.success,
      error_details: data.error ? { message: data.error } : null,
      generation_time_ms: data.generationTime,
      tokens_used: data.tokensUsed || null,
      model_used: data.model || "unknown",
    });
  } catch (error) {
    console.error("Failed to track generation:", error);
  }
}
