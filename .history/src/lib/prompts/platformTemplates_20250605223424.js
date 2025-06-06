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
