// src/lib/prompts/claudeTemplates.js
import { PLATFORMS, COMPLEXITY_LEVELS } from "@/lib/constants";

/**
 * Claude-optimized prompt templates and generation strategies
 */
export class ClaudePromptOptimizer {
  constructor() {
    this.modelCapabilities = {
      "claude-3-5-sonnet-20241022": {
        maxTokens: 8192,
        strengthJSON: 0.95,
        strengthLogic: 0.95,
        strengthCreativity: 0.85,
      },
      "claude-3-5-haiku-20241022": {
        maxTokens: 8192,
        strengthJSON: 0.9,
        strengthLogic: 0.85,
        strengthCreativity: 0.8,
      },
    };
  }

  /**
   * Generate optimized prompt for Claude with RAG enhancement
   */
  async generateOptimizedPrompt(
    platform,
    userInput,
    relevantDocs = [],
    options = {}
  ) {
    const {
      complexity = COMPLEXITY_LEVELS.MODERATE,
      errorHandling = true,
      optimization = 50,
      includeExamples = true,
    } = options;

    // Build structured prompt sections
    const sections = [];

    // 1. Task Definition
    sections.push(this.buildTaskDefinition(platform, complexity));

    // 2. Platform-specific context from RAG
    if (relevantDocs.length > 0) {
      sections.push(this.buildRAGContext(relevantDocs, platform));
    }

    // 3. Technical specifications
    sections.push(this.buildTechnicalSpecs(platform, options));

    // 4. Examples (if enabled)
    if (includeExamples) {
      sections.push(this.buildExamples(platform, complexity));
    }

    // 5. Output requirements
    sections.push(this.buildOutputRequirements(platform));

    // 6. User request
    sections.push(this.buildUserRequest(userInput, options));

    // 7. Critical instructions
    sections.push(this.buildCriticalInstructions());

    return sections.join("\n\n");
  }

  /**
   * Generate system prompt optimized for Claude
   */
  generateSystemPrompt(platform, complexity = COMPLEXITY_LEVELS.MODERATE) {
    const platformNames = {
      [PLATFORMS.N8N]: "n8n",
      [PLATFORMS.ZAPIER]: "Zapier",
      [PLATFORMS.MAKE]: "Make (Integromat)",
    };

    return `You are an expert ${platformNames[platform]} workflow automation specialist with deep knowledge of:
- JSON schema validation and generation
- Workflow automation best practices
- Integration patterns and error handling
- Platform-specific node configurations

Your responses must be:
1. Valid, executable JSON that exactly matches ${platform} specifications
2. Optimized for ${complexity} complexity workflows
3. Free of any explanatory text - only JSON output
4. Complete with all required parameters and configurations

Critical: You must respond with ONLY valid JSON. No markdown, no explanations, no commentary.`;
  }

  /**
   * Build task definition section
   */
  buildTaskDefinition(platform, complexity) {
    const complexityDescriptions = {
      [COMPLEXITY_LEVELS.SIMPLE]: "straightforward, linear",
      [COMPLEXITY_LEVELS.MODERATE]: "moderately complex with conditional logic",
      [COMPLEXITY_LEVELS.COMPLEX]:
        "highly complex with multiple branches and error handling",
    };

    return `## Task: Generate ${platform.toUpperCase()} Workflow JSON

You are creating a ${
      complexityDescriptions[complexity]
    } workflow for the ${platform} automation platform.

Key requirements:
- Generate ONLY valid JSON output
- Include all necessary configurations
- Ensure proper node/step connections
- Follow ${platform} best practices`;
  }

  /**
   * Build RAG context section
   */
  buildRAGContext(relevantDocs, platform) {
    let context = `## Platform Documentation Context

Based on ${platform} documentation, here are the relevant components and patterns for this workflow:

`;

    // Group docs by type for better organization
    const docsByType = this.groupDocsByType(relevantDocs);

    // Add node/action documentation
    if (docsByType.nodes.length > 0) {
      context += "### Available Nodes/Actions:\n";
      docsByType.nodes.forEach((doc) => {
        context += `- **${doc.title}**: ${doc.content.substring(0, 200)}...\n`;
        if (doc.metadata?.parameters) {
          context += `  Parameters: ${JSON.stringify(
            Object.keys(doc.metadata.parameters)
          )}\n`;
        }
      });
      context += "\n";
    }

    // Add examples
    if (docsByType.examples.length > 0) {
      context += "### Relevant Examples:\n";
      docsByType.examples.forEach((doc) => {
        context += `- ${doc.title}\n`;
        if (doc.metadata?.workflow) {
          context += "  ```json\n";
          context += `  ${JSON.stringify(doc.metadata.workflow, null, 2)
            .split("\n")
            .slice(0, 10)
            .join("\n")}\n`;
          context += "  ```\n";
        }
      });
      context += "\n";
    }

    // Add best practices
    if (docsByType.guides.length > 0) {
      context += "### Best Practices:\n";
      docsByType.guides.forEach((doc) => {
        const practices = this.extractBestPractices(doc.content);
        practices.forEach((practice) => {
          context += `- ${practice}\n`;
        });
      });
    }

    return context;
  }

  /**
   * Build technical specifications
   */
  buildTechnicalSpecs(platform, options) {
    const specs = {
      [PLATFORMS.N8N]: `### n8n Technical Specifications:
- Each node must have: id (string), name (string), type (string), typeVersion (number), position ([x,y])
- Connections format: { "NodeName": { "main": [[{ "node": "TargetNode", "type": "main", "index": 0 }]] }}
- Data references: {{$node["NodeName"].json.fieldName}}
- Credentials referenced by name only
- Boolean values must be actual booleans, not strings
- All node names must be unique
CRITICAL FORMAT RULES:
  - Schedule trigger intervals MUST be arrays: interval: [1] not interval: 1
  - IF node conditions MUST be wrapped in conditions object with array:
    conditions: { conditions: [{leftValue, rightValue, operation}] }
  - Google Drive folder IDs must be strings, not objects
  - All multi-value parameters must be arrays even with single values
  - Webhook paths must not contain spaces (use hyphens)
  - Email parameters must have fromEmail field``### n8n Technical Specifications:
  CRITICAL FORMAT REQUIREMENTS:
  
  1. GMAIL TRIGGER NODE:
     - labelIds must be an array at the root level: parameters.labelIds = ["INBOX"]
     - Do NOT put labelIds inside an options object
     - Remove any 'scope' parameter - it's not valid
     - Example:
       "parameters": {
         "labelIds": ["INBOX"],
         "includeAttachments": false
       }
  
  2. SLACK NODE:
     - Must have typeVersion: 2.2
     - Must have operation: "post" 
     - Must have authentication: "accessToken"
     - Do NOT include 'resource' parameter
     - Channel should start with # (e.g., "#general")
     - Include credentials object
     - Example:
       "parameters": {
         "operation": "post",
         "authentication": "accessToken", 
         "channel": "#general",
         "text": "Your message here",
         "otherOptions": {}
       }
  
  3. IF NODE CONDITIONS:
     - Must have conditions.conditions array structure
     - Each condition must have: leftValue, rightValue, operation
     - leftValue should use expressions: "={{$json[\\"field\\"]}}"
     - Do NOT leave leftValue or rightValue empty
     - Do NOT include 'combinator' field
     - Example:
       "parameters": {
         "conditions": {
           "conditions": [{
             "leftValue": "={{$json[\\"from\\"]}}",
             "rightValue": "vip@company.com",
             "operation": "contains"
           }]
         },
         "combineOperation": "all"
       }
  
  4. GOOGLE SHEETS NODE:
     - Do NOT use __rl wrapper objects
     - documentId and sheetName should be simple strings
     - columns.value should be a simple object, not mappingValues array
     - Example:
       "parameters": {
         "operation": "append",
         "documentId": "YOUR_SHEET_ID",
         "sheetName": "Sheet1",
         "columns": {
           "mappingMode": "defineBelow",
           "value": {
             "Timestamp": "={{new Date().toISOString()}}",
             "From": "={{$json[\\"from\\"]}}"
           }
         }
       }
  
  5. ALL NODES:
     - Must have unique id (lowercase alphanumeric, 6+ chars)
     - Must have position array: [x, y]
     - Must include credentials object for nodes that need auth
     - Node names must match exactly in connections
  
  6. CONNECTIONS:
     - Format: { "NodeName": { "main": [[{ "node": "TargetNode", "type": "main", "index": 0 }]] }}
     - main must be array of arrays
     - Each connection must have: node, type, index
  
  7. WORKFLOW STRUCTURE:
     - Must include: name, nodes, connections, settings, meta
     - settings must have executionOrder: "v1"
     - meta must have instanceId
     - Include versionId, pinData: {}, staticData: null, tags: []`,

      [PLATFORMS.ZAPIER]: `### Zapier Technical Specifications:
- Trigger must be first, followed by actions array
- Each step needs: app (string), event/action (string), configuration (object)
- Field references: {{trigger.fieldName}} or {{stepName.fieldName}}
- Filters use standard comparison operators
- Dynamic fields should use proper field mapping`,

      [PLATFORMS.MAKE]: `### Make Technical Specifications:
- Modules need: id (number), module (string), version (number), parameters (object)
- Data mapping format: {{moduleId.fieldName}}
- Connections array defines flow between modules
- Routers and filters use advanced conditional logic
- Each module must have unique numeric ID`,
    };

    let spec = specs[platform] || specs[PLATFORMS.N8N];

    // Add error handling specs if enabled
    if (options.errorHandling) {
      spec += `\n- Include error handling nodes/steps
- Add validation for critical operations
- Implement retry logic where appropriate`;
    }

    // Add optimization specs
    if (options.optimization > 50) {
      spec += `\n- Optimize for performance (parallel execution where possible)
- Minimize API calls through batching
- Use efficient data transformations`;
    }

    return spec;
  }

  /**
   * Build examples section
   */
  buildExamples(platform, complexity) {
    const examples = {
      [PLATFORMS.N8N]: {
        [COMPLEXITY_LEVELS.SIMPLE]: `### Example Structure:
\`\`\`json
{
  "name": "Simple Email to Slack",
  "nodes": [
    {
      "id": "1",
      "name": "Gmail Trigger",
      "type": "n8n-nodes-base.gmailTrigger",
      "typeVersion": 1,
      "position": [250, 300],
      "credentials": {
        "gmailOAuth2": {
          "id": "1",
          "name": "Gmail account"
        }
      },
      "parameters": {
        "label": "INBOX"
      }
    },
    {
      "id": "2",
      "name": "Slack",
      "type": "n8n-nodes-base.slack",
      "typeVersion": 1,
      "position": [450, 300],
      "parameters": {
        "operation": "post",
        "channel": "#notifications",
        "text": "={{$node[\\"Gmail Trigger\\"].json[\\"subject\\"]}}"
      }
    }
  ],
  "connections": {
    "Gmail Trigger": {
      "main": [[{"node": "Slack", "type": "main", "index": 0}]]
    }
  },
  "settings": {
    "executionOrder": "v1"
  }
}
\`\`\``,
        [COMPLEXITY_LEVELS.MODERATE]: `### Example with Conditional Logic:
Include IF nodes, data transformation, and multiple paths...`,
        [COMPLEXITY_LEVELS.COMPLEX]: `### Example with Error Handling and Loops:
Include error branches, iterators, and complex data processing...`,
      },
      // Add Zapier and Make examples...
    };

    return (
      examples[platform]?.[complexity] ||
      examples[PLATFORMS.N8N][COMPLEXITY_LEVELS.SIMPLE]
    );
  }

  /**
   * Build output requirements
   */
  buildOutputRequirements(platform) {
    return `## Output Requirements

1. MUST be valid JSON only - no text before or after
2. MUST include all required fields for ${platform}
3. MUST use proper data types (strings, numbers, booleans, arrays, objects)
4. MUST have valid connections/routes between nodes/steps
5. MUST use correct node/app names and types`;
  }

  /**
   * Build user request section
   */
  buildUserRequest(userInput, options) {
    let request = `## User Request
"${userInput}"`;

    // Add specific requirements based on options
    if (options.errorHandling) {
      request += `\n\nAdditional Requirements:
- Include comprehensive error handling
- Add fallback paths for failures`;
    }

    if (options.complexity === COMPLEXITY_LEVELS.COMPLEX) {
      request += `\n- Implement advanced logic and data processing
- Use loops/iterators where appropriate`;
    }

    return request;
  }

  /**
   * Build critical instructions
   */
  buildCriticalInstructions() {
    return `## CRITICAL INSTRUCTIONS

RESPOND WITH ONLY VALID JSON. 
No explanations.
No markdown.
No code blocks.
No comments.
Just the workflow JSON object.

Your entire response must be parseable by JSON.parse().`;
  }

  /**
   * Extract and validate JSON from Claude's response
   */
  extractAndValidateJSON(content) {
    // Remove any potential markdown or code blocks
    let cleaned = content.trim();

    // Common patterns to remove
    const patterns = [
      /^```json\s*/,
      /\s*```$/,
      /^```\s*/,
      /^json\s*/,
      /^JSON:\s*/i,
      /^Here's the JSON:\s*/i,
      /^Output:\s*/i,
    ];

    patterns.forEach((pattern) => {
      cleaned = cleaned.replace(pattern, "");
    });

    // Try to extract JSON object or array
    const jsonMatch = cleaned.match(
      /^[\s\n]*(\{[\s\S]*\}|\[[\s\S]*\])[\s\n]*$/
    );
    if (jsonMatch) {
      cleaned = jsonMatch[1];
    }

    try {
      // Attempt to parse
      const parsed = JSON.parse(cleaned);

      // Basic validation
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Response is not a valid JSON object or array");
      }

      return parsed;
    } catch (error) {
      // Try to fix common issues
      try {
        // Fix trailing commas
        cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");

        // Fix single quotes (carefully)
        cleaned = cleaned.replace(/'/g, '"');

        // Try parsing again
        return JSON.parse(cleaned);
      } catch (secondError) {
        // If still failing, try to extract the largest JSON-like structure
        const objectMatch = cleaned.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
        if (objectMatch) {
          try {
            return JSON.parse(objectMatch[0]);
          } catch (e) {
            // Give up and throw original error
          }
        }

        throw new Error(
          `Failed to parse JSON response: ${
            error.message
          }. Content preview: ${cleaned.substring(0, 200)}...`
        );
      }
    }
  }

  /**
   * Group documents by type
   */
  groupDocsByType(docs) {
    const grouped = {
      nodes: [],
      examples: [],
      guides: [],
      api: [],
      other: [],
    };

    docs.forEach((doc) => {
      const type = doc.doc_type || doc.metadata?.docType || "other";
      switch (type) {
        case "node":
        case "trigger":
        case "action":
          grouped.nodes.push(doc);
          break;
        case "example":
          grouped.examples.push(doc);
          break;
        case "guide":
        case "best-practice":
          grouped.guides.push(doc);
          break;
        case "api":
        case "schema":
          grouped.api.push(doc);
          break;
        default:
          grouped.other.push(doc);
      }
    });

    return grouped;
  }

  /**
   * Extract best practices from content
   */
  extractBestPractices(content) {
    const practices = [];
    const lines = content.split("\n");

    lines.forEach((line) => {
      if (
        line.match(/best practice|recommended|should|must|always|never/i) &&
        line.length > 20 &&
        line.length < 200
      ) {
        practices.push(line.trim());
      }
    });

    return practices.slice(0, 5); // Top 5 practices
  }

  /**
   * Calculate optimal model for complexity
   */
  getOptimalModel(complexity) {
    // Always use Sonnet for accuracy in JSON generation
    return "claude-3-5-sonnet-20241022";
  }
}

// Export singleton instance
export const claudeOptimizer = new ClaudePromptOptimizer();
