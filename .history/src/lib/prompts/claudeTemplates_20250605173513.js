// src/lib/prompts/claudeTemplates.js
import { PLATFORMS, COMPLEXITY_LEVELS } from "@/lib/constants";

/**
 * Claude-optimized prompt templates and generation strategies
 */
export class ClaudePromptOptimizer {
  constructor() {
    this.modelCapabilities = {
      "claude-opus-4-20250514": {
        maxTokens: 8192,
        strengthJSON: 0.98,
        strengthLogic: 0.98,
        strengthCreativity: 0.9,
      },
      "claude-opus-4-20250514": {
        maxTokens: 8192,
        strengthJSON: 0.95,
        strengthLogic: 0.95,
        strengthCreativity: 0.85,
      },
      "claude-opus-4-20250514": {
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
      includeExamples = false, // Default to false to prevent example-based errors
    } = options;

    // Build structured prompt sections
    const sections = [];

    // 0. Critical Field Restrictions (Pre-instruction)
    sections.push(`## 🚨 CRITICAL WORKFLOW FORMAT RESTRICTION
    
Your output MUST be a valid ${platform} workflow JSON containing ONLY these fields:
- name, nodes, connections, settings, meta (REQUIRED)
- versionId, pinData, staticData, tags, active, id, triggerCount, createdAt, updatedAt (OPTIONAL)

❌ STRICTLY FORBIDDEN: Never include _metadata or any underscore-prefixed fields!
These will cause the workflow to fail when imported into ${platform}.`);

    // 1. Task Definition
    sections.push(this.buildTaskDefinition(platform, complexity));

    // 2. Platform-specific context from RAG
    if (relevantDocs.length > 0) {
      sections.push(this.buildRAGContext(relevantDocs, platform));
    }

    // 3. Technical specifications with schema emphasis
    sections.push(this.buildTechnicalSpecsWithSchema(platform, options));

    // 4. Examples (if enabled) - we're defaulting to false now
    if (includeExamples) {
      sections.push(this.buildExamples(platform, complexity));
    }

    // 5. Output requirements
    sections.push(this.buildOutputRequirements(platform));

    // 6. User request
    sections.push(this.buildUserRequest(userInput, options));

    // 7. Critical instructions
    sections.push(this.buildCriticalInstructions());

    // 8. Final reminder about metadata
    sections.push(`## 🚨 FINAL REMINDER - VALIDATE BEFORE SUBMITTING
    
BEFORE submitting your response, verify your workflow JSON contains ONLY these fields:
- name, nodes, connections, settings, meta, [versionId], [pinData], [staticData], [tags], [active], [id], [triggerCount], [createdAt], [updatedAt]

❌ REMOVE ALL non-standard fields, especially:
- _metadata (WILL CAUSE IMPORT FAILURE)
- instructions (WILL CAUSE IMPORT FAILURE)
- validation (WILL CAUSE IMPORT FAILURE)
- Any field starting with underscore "_" (WILL CAUSE IMPORT FAILURE)
- webhookId (WILL CAUSE IMPORT FAILURE)

Your ENTIRE response must be ONLY the JSON object with ONLY standard fields.`);

    // If we're using the simplified prompt style, use that instead
    if (options.useSimplifiedPrompt) {
      return this.buildFocusedPrompt(platform, userInput);
    }

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
   * Build technical specifications with schema emphasis
   */
  buildTechnicalSpecsWithSchema(platform, options) {
    if (platform === PLATFORMS.N8N) {
      // Add schema reference with emphasis on structure
      let spec = `### n8n Technical Specifications:
    
SCHEMA COMPLIANCE:
You MUST generate JSON that validates against this exact schema structure:
- nodes array with objects containing: id, name, type, typeVersion, position, parameters
- connections object with format: { "NodeName": { "main": [[{ "node": "Target", "type": "main", "index": 0 }]] }}
- Required top-level fields: name, nodes, connections, settings, meta
- Optional fields: versionId, pinData, staticData, tags, active, id, triggerCount, createdAt, updatedAt

CRITICAL BUGS TO AVOID:

1. IF NODE CONDITIONS:
   - NEVER use "number" field in conditions
   - Use ONLY this structure:
     "conditions": {
       "conditions": [{
         "leftValue": "={{expression}}",
         "rightValue": "value",
         "operation": "equal"
       }]
     }

2. NOOP NODES:
   - NEVER use n8n-nodes-base.noOp nodes
   - They serve no purpose and cause import errors
   - Use Set node or simply skip to next action

3. WEBHOOK RESPONSE:
   - For webhook responses, use n8n-nodes-base.respondToWebhook
   - responseData should be a simple JSON string or expression

4. CHECKING ARRAY LENGTH:
   - WRONG way (causes import errors):
     "leftValue": "={{$json.length > 0}}",
     "rightValue": "{{true}}",
     "operation": "equal"
   - CORRECT way:
     "leftValue": "={{$json.length}}",
     "rightValue": 0,
     "operation": "largerThan"
   - OR for specific arrays:
     "leftValue": "={{$json[\"items\"].length}}",
     "rightValue": 0,
     "operation": "largerThan"
     
5. GOOGLE SHEETS (append operation):
   - NO options field at all for ANY Google Sheets operations
   - NO valueInputMode parameter
   - Structure must be:
     "parameters": {
       "operation": "append",
       "documentId": "YOUR_SHEET_ID",
       "sheetName": "SheetName",
       "columns": {
         "mappingMode": "defineBelow",
         "value": { /* column mappings */ }
       }
     }

6. HTTP REQUEST NODE:
   - NO options field at any level
   - For query parameters, use flat object structure:
     "queryParameters": {
       "key1": "value1",
       "key2": "value2"
     }
   - NOT this:
     "queryParameters": {
       "parameters": [...]  // WRONG
     }
   - Basic structure:
     "parameters": {
       "url": "https://example.com",
       "method": "GET",
       "authentication": "none",
       "timeout": 5000,    // Optional timeout in ms
       "followRedirects": true  // Optional, directly at root level
     }
   
7. OPENAI NODE:
   - Model, temperature, and maxTokens should be at root parameter level
   - NO options field
   - Structure:
     "parameters": {
       "authentication": "apiKey",
       "resource": "chat",
       "model": "gpt-3.5-turbo",
       "temperature": 0.7,
       "maxTokens": 500,
       "prompt": {
         "messages": [
           {
             "role": "system",
             "content": "You are a helpful assistant."
           }
         ]
       }
     }

CRITICAL FORMAT REQUIREMENTS:
  
  1. GMAIL TRIGGER NODE:
   - CORRECT node type is "n8n-nodes-base.gmailTrigger" (camelCase with capital T)
   - NEVER use lowercase "n8n-nodes-base.gmailtrigger" - it causes import errors
   - labelIds must be an array at root level: parameters.labelIds = ["INBOX"]
   - DO NOT use label: "INBOX" - this is INCORRECT
   - includeAttachments: true only provides metadata, not binary data
   - To filter by subject, use a separate IF node after the trigger
   - To download attachments, use Gmail node with "getAttachment" operation
   - CORRECT structure:
     "parameters": {
       "labelIds": ["INBOX"],
       "includeAttachments": true
     }
   
   CRITICAL - GMAIL FIELD REFERENCES:
   - Gmail trigger returns nested field structure, NOT simple field names
   - CORRECT field references:
     * From address: {{$json["headers"]["from"]}}
     * Subject: {{$json["headers"]["subject"]}}
     * Email body text: {{$json["textPlain"]}}
     * Email body HTML: {{$json["textHtml"]}}
   - WRONG field references:
     * {{$json.from}} or {{$json["from"]}} (will be undefined)
     * {{$json.subject}} or {{$json["subject"]}} (will be undefined)
     * {{$json.text}} or {{$json["text"]}} (will be undefined)
  
  2. SLACK NODE:
     - Must have typeVersion: 2.2
     - Must have operation: "post" 
     - Must have authentication: "accessToken"
     - Do NOT include 'resource' parameter
     - Channel should start with # (e.g., "#general")
     - Include credentials object
     - NEVER include otherOptions field
     - NEVER include options field
     - ⚠️ CRITICAL: Do NOT add any 'options' or 'otherOptions' fields - they cause import errors
     - ⚠️ CRITICAL: NEVER add '=' prefix to ANY fields - particularly text, blocks, or attachments
     - WRONG: "text": "=**VIP Email**" (will cause errors)
     - CORRECT: "text": "**VIP Email**" (no equal sign prefix)
     - WRONG: "channel": "#={{$json.channel}}" (will cause errors)
     - CORRECT: "channel": "={{$json.channel}}" (no # in front of expression)
     - WRONG: "channel": "=#{{$json.channel}}" (will cause errors)
     - For static channels: "channel": "#general" (# prefix required)
     - For dynamic channels: "channel": "={{$json.channel}}" (no # prefix for expressions)
     - CORRECT structure:
       "parameters": {
         "operation": "post",
         "authentication": "accessToken", 
         "channel": "#channel-name",
         "text": "Your message here"
       }
     - NO OTHER FIELDS in parameters
  
  3. IF NODE CONDITIONS:
     - Must have conditions.conditions array structure
     - Each condition must have: leftValue, rightValue, operation
     - leftValue should use expressions: "={{$json[\\"field\\"]}}"
     - For exists operation, use empty rightValue
     - Do NOT include 'combinator' field
     - NEVER use JavaScript methods like .includes() in leftValue - this causes import errors
     - NEVER use complex boolean expressions in leftValue - this causes import errors
     - NEVER write "leftValue": "={{$json[\\"from\\"].includes(\\"vip@company.com\\")}}", "rightValue": "{{true}}"
     - INSTEAD use n8n's built-in operations:
     - CORRECT structure:
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
     - For checking array length:
       "leftValue": "={{$json[\\"items\\"].length}}",
       "rightValue": 5,
       "operation": "largerThan"
     - For checking if field exists:
       "leftValue": "={{$json[\\"field\\"]}}",
       "rightValue": "",
       "operation": "exists"
  
  4. GOOGLE SHEETS NODE:
     - Do NOT use __rl wrapper objects
     - documentId and sheetName should be simple strings
     - For "getAll" operation:
       * Use only these parameters: operation, documentId, sheetName, returnAllMatches
       * Do NOT include "options" field
       * returnAllMatches should be boolean (true/false)
     - For "append" operation:
       * columns.value should be a simple object, not mappingValues array
     - Example for getAll:
       "parameters": {
         "operation": "getAll",
         "documentId": "YOUR_SHEET_ID",
         "sheetName": "Sheet1",
         "returnAllMatches": true
       }
  
  5. SET NODE:
     - values.string must be an array of objects with name and value
     - NEVER include an "options" field in Set node parameters
     - NEVER include "keepOnlySet" or any other options
     - Set node typeVersion should be 1, not 2
     - CORRECT structure:
       "parameters": {
         "values": {
           "string": [
             {"name": "status", "value": "success"},
             {"name": "message", "value": "Operation completed"}
           ]
         }
       }
  
  6. SWITCH NODE:
     - Preferred over IF for binary conditions
     - Must have dataType, value1, rules.rules array
     - CORRECT structure:
       "parameters": {
         "dataType": "string",
         "value1": "={{$json[\\"fieldName\\"]}}",
         "rules": {
           "rules": [{
             "value2": "value",
             "operation": "equal"
           }]
         },
         "fallbackOutput": 1
       }
  
  7. WEBHOOK NODE:
     - Valid options: responseHeaders, rawBody only
     - Do NOT include responseData in options
     - Do NOT include webhookId field at node level
     - CORRECT structure:
       "parameters": {
         "httpMethod": "POST",
         "path": "webhook-path",
         "responseMode": "onReceived",
         "options": {
           "responseHeaders": {}
         }
       }
  
  8. RESPONDTOWEBHOOK NODE:
     - responseCode must be a number at parameters level, not in options
     - Do NOT use expressions for responseCode
     - NEVER use complex expressions like: "responseData": "={{JSON.stringify({success: true})}}" 
     - CORRECT structure - use simple format:
       "parameters": {
         "respondWith": "json",
         "responseCode": 200,
         "options": {
           "responseData": "firstEntryJson"
         }
       }
     - Or for basic text responses:
       "parameters": {
         "respondWith": "text",
         "responseCode": 200,
         "responseData": "Success"
       }
  
  9. ALL NODES:
     - Must have unique id (lowercase alphanumeric, 6+ chars)
     - Must have position array: [x, y]
     - Must include credentials object for nodes that need auth
     - Node names must match exactly in connections
     - Each node must have: id (string), name (string), type (string), typeVersion (number), position ([x,y])
  
  10. CONNECTIONS:
     - CORRECT format: { "NodeName": { "main": [[{ "node": "TargetNode", "type": "main", "index": 0 }]] }}
     - main must be array of arrays
     - Each connection must have: node, type, index
  
  11. WORKFLOW STRUCTURE:
   - Must include ONLY these fields: name, nodes, connections, settings, meta, versionId, pinData, staticData, tags
   - Do NOT include any fields like _metadata, instructions, or validation
   - settings must have executionOrder: "v1"
   - meta must have instanceId
   - Include versionId, pinData: {}, staticData: null, tags: []
  
  12. NODE SELECTION RULES:
     - For simple email validation: Webhook → Switch → Set nodes
     - AVOID: emailSend for non-email-sending tasks
     - AVOID: function nodes for simple data creation
     - AVOID: noOp nodes (they do nothing)
     - Prefer Switch over IF for binary conditions
     - Use Set node for data creation instead of function
     
  13. FILTER NODE STRUCTURE:
     - CORRECT format for Filter node:
       "parameters": {
         "dataType": "boolean",
         "conditions": {
           "boolean": [{
             "value1": "={{$json[\"active\"]}}",
             "operation": "equal",
             "value2": true
           }]
         },
         "combineOperation": "AND"
       }
     - NEVER use conditions.string format - always use conditions.boolean
     - combineOperation must be uppercase "AND" or "OR"`;

      // Add error handling specs if enabled
      if (options.errorHandling) {
        spec += `\n
  12. ERROR HANDLING:
     - Include error handling nodes/steps
     - Add validation for critical operations
     - Implement retry logic where appropriate`;
      }

      return spec;
    } else {
      // For other platforms, fall back to the original implementation
      return this.buildTechnicalSpecs(platform, options);
    }
  }

  /**
   * Build technical specifications (original implementation)
   */
  buildTechnicalSpecs(platform, options) {
    const specs = {
      [PLATFORMS.N8N]: `### n8n Technical Specifications:
  CRITICAL FORMAT REQUIREMENTS:
  
  1. GMAIL TRIGGER NODE:
   - Type MUST be: "n8n-nodes-base.gmailTrigger" (with capital T)
   - CORRECT node type is "n8n-nodes-base.gmailTrigger" (camelCase with capital T)
   - NEVER use lowercase "n8n-nodes-base.gmailtrigger" - it causes import errors
   - labelIds must be an array at root level: parameters.labelIds = ["INBOX"]
   - DO NOT use label: "INBOX" - this is INCORRECT
   - Credentials MUST use gmailOAuth2 (NOT gmailOAuth2Api):
     "credentials": {
       "gmailOAuth2": {
         "id": "1",
         "name": "Gmail account"
       }
     }
   - includeAttachments: true only provides metadata, not binary data
   - To filter by subject, use a separate IF node after the trigger
   - To download attachments, use Gmail node with "getAttachment" operation
   - CORRECT structure:
     "parameters": {
       "labelIds": ["INBOX"],
       "includeAttachments": true
     }
  
  2. SLACK NODE:
     - Must have typeVersion: 2.2
     - Must have operation: "post" 
     - Must have authentication: "accessToken"
     - Do NOT include 'resource' parameter
     - Channel should start with # (e.g., "#general")
     - text field should NOT start with = sign
     - ⚠️ IMPORTANT: NEVER include otherOptions field - it causes import errors
     - ⚠️ IMPORTANT: NEVER include options field - it causes import errors
     - ⚠️ IMPORTANT: NEVER add '=' prefix to text field
     - WRONG: "text": "=**VIP Email**" (will cause errors)
     - CORRECT: "text": "**VIP Email**" (no equal sign prefix)
     - Include credentials object
     - CORRECT structure:
       "parameters": {
         "operation": "post",
         "authentication": "accessToken", 
         "channel": "#general",
         "text": "Your message here"
       }
     - NO additional fields like options or otherOptions - they cause import errors
  
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
     - For "getAll" operation:
       * Use only these parameters: operation, documentId, sheetName, returnAllMatches
       * Do NOT include "options" field
       * returnAllMatches should be boolean (true/false)
     - For "append" operation:
       * columns.value should be a simple object, not mappingValues array
     - Example for getAll:
       "parameters": {
         "operation": "getAll",
         "documentId": "YOUR_SHEET_ID",
         "sheetName": "Sheet1",
         "returnAllMatches": true
       }
     - Example for append:
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
     - Each node must have: id (string), name (string), type (string), typeVersion (number), position ([x,y])
  
  6. CONNECTIONS:
     - Format: { "NodeName": { "main": [[{ "node": "TargetNode", "type": "main", "index": 0 }]] }}
     - main must be array of arrays
     - Each connection must have: node, type, index
  
  7. WORKFLOW STRUCTURE:
   - Must include ONLY these fields: name, nodes, connections, settings, meta, versionId, pinData, staticData, tags, active
   - Do NOT include any other fields like _metadata, instructions, or validation
   - settings must have executionOrder: "v1"
   - meta must have instanceId
   - ALWAYS include these fields at the end of the workflow:
     "versionId": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
     "pinData": {},
     "staticData": null,
     "tags": [],
     "active": false
  
  8. DATA REFERENCES AND EXPRESSIONS:
   - Use single quotes in expressions to avoid escaping issues
   - CORRECT: {{$json['fieldName']}} or {{$json.fieldName}}
   - WRONG: {{$json[\"fieldName\"]}} (escaped quotes cause parser errors)
   - For IF nodes, always use single quotes: {{$json['from']}}
   - For text interpolation, use: "Text {{$json.fieldName}}" (no quotes needed around field)
   
   CRITICAL EXPRESSION RULES:
   - Never use escaped quotes (\") in expressions
   - Always prefer dot notation when possible: {{$json.from}}
   - Use bracket notation with single quotes for special chars: {{$json['field-name']}}
   - Don't mix expression syntaxes in the same value
   
   EXAMPLES:
   - CORRECT: "text": "Email from {{$json.from}} - {{$json.subject}}"
   - CORRECT: "leftValue": "={{$json['from']}}"
   - WRONG: "text": "Email from {{$json[\"from\"]}} - {{$json[\"subject\"]}}"
   - WRONG: "leftValue": "={{$json[\\\"from\\\"]}}"
     
  9. RESPONSE PATTERNS:
     - For webhook responses, use a Set node to create response data, then respondToWebhook node
     - Pattern: Webhook → Process → Set (create response) → respondToWebhook
     - The Set node should have values like:
       {
         "values": {
           "string": [
             {"name": "success", "value": "true"},
             {"name": "message", "value": "Data processed"}
           ]
         }
       }
     HANDLING EMAIL ATTACHMENTS IN N8N:
1. Gmail Trigger provides attachment metadata only
2. To download attachment content, use Gmail node with "getAttachment"
3. Workflow pattern:
   - Gmail Trigger (gets email with attachment info)
   - IF node (check if has attachments)
   - Code/Function node (extract attachment IDs)
   - Gmail node (download each attachment)
   - Google Drive node (upload binary data)
   
Binary data reference: {{$binary.data}} 

SCHEDULE TRIGGER WEEKLY SETUP:
- To schedule weekly on a specific day/time, use cron expression:
  "parameters": {
    "mode": "cronExpression",
    "cronExpression": "0 8 * * 1"
  }
- Cron format: minute hour * * day-of-week (0=Sunday, 1=Monday)
- Example above runs every Monday at 8:00 AM

WEBHOOK + RESPOND PATTERN:
- Use this pattern for creating webhook APIs:
  - Webhook (path="api/data", httpMethod="POST", responseMode="responseNode")
  - Process data with Function or Set node
  - respondToWebhook (respondWith="json", responseCode=200, options={responseData:"firstEntryJson"})

GOOGLE DRIVE NODE:
  - For folder search use:
    "parameters": {
      "operation": "search",
      "resource": "folder", 
      "searchMethod": "name",
      "searchText": "Folder Name"
    }
  
  - For file upload use:
    "parameters": {
      "operation": "upload",
      "resource": "file",
      "name": "={{$json[\\"filename\\"]}}",
      "parents": {
        "__rl": true,
        "value": "={{$node[\\"Get Folder\\"].json[\\"id\\"]}}",
        "mode": "id"
      },
      "binaryPropertyName": "data"
    }
  
  - Binary data is referenced by property name, not path
  - Use parents instead of folderId for upload`,

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
      spec += `\n
  9. ERROR HANDLING:
     - Include error handling nodes/steps
     - Add validation for critical operations
     - Implement retry logic where appropriate
     
  10. SWITCH NODE (PREFERRED FOR SIMPLE CONDITIONS):
     - Use switch instead of IF for binary conditions
     - Structure:
       "parameters": {
         "dataType": "string",
         "value1": "={{$json[\\"fieldName\"]}}",
         "rules": {
           "rules": [{
             "value2": "",
             "operation": "notEqual"  // or "equal", "contains", etc.
           }]
         },
         "fallbackOutput": 1  // 0-based index for fallback output
       }

  11. SET NODE (FOR CREATING RESPONSE DATA):
     - Use for creating structured responses instead of emailSend/function
     - Structure:
       "parameters": {
         "values": {
           "string": [
             {"name": "fieldName", "value": "fieldValue"}
           ]
         }
       }
     - NEVER include an "options" field in Set node parameters
     - NEVER include "keepOnlySet" or any other options
     - Set node typeVersion should be 1, not 2
     - Keep the structure simple with just values
     
     - CRITICAL: For expressions in Set node values:
       * DO NOT mix = prefix with {{}} syntax
       * Either use a plain template string: "Hello {{$json.name}}"
       * Or use full expression syntax with = but NO {{}}: "='Hello ' + $json.name"
       * WRONG: "=Text with {{$json.field}}" (mixing syntaxes)
       * RIGHT: "Text with {{$json.field}}" (template only)
       * RIGHT: "='Text with ' + $json.field" (expression only)

  12. NODE SELECTION RULES:
     - For simple email validation: Webhook → Switch → Set nodes
     - AVOID: emailSend for non-email-sending tasks
     - AVOID: function nodes for simple data creation
     - AVOID: noOp nodes (they do nothing)
     - Prefer Switch over IF for binary conditions
     
  13. SET NODE STRUCTURE:
     - NEVER include options field in Set node parameters
     - NEVER use keepOnlySet or dotNotation options - they cause import failures
     - Keep Set node simple with only values
     - Structure:
       "parameters": {
         "values": {
           "string": [
             {"name": "status", "value": "success"}
           ]
         }
       }
       
  14. IF NODE FIELD EXISTENCE CHECK:
     - To check if field exists, use "exists" operation
     - Structure:
       "conditions": {
         "conditions": [{
           "leftValue": "={{$json[\\"email\"]}}",
           "rightValue": "",
           "operation": "exists"  // or "notExists"
         }]
       }
       
  15. SET NODE TYPE VERSION:
     - ALWAYS use typeVersion: 1 for Set nodes
     - typeVersion: 2 causes validation errors
       
  16. WEBHOOK NODE CONFIGURATION:
     - Valid options: responseHeaders, rawBody
     - Do NOT include 'responseData' in options
     - When using responseMode: "responseNode", you MUST use respondToWebhook nodes
     - When using responseMode: "lastNode", do NOT use respondToWebhook nodes

  17. RESPONDTOWEBHOOK NODE:
     - responseCode must be a number at parameters level, not in options
     - Structure:
       "parameters": {
         "responseCode": 200,  // NOT in options!
         "responseData": "={{JSON.stringify($json)}}"
       }
     - Do NOT use expressions for responseCode`;
    }

    // Add optimization specs
    if (options.optimization > 50) {
      spec += `\n
  10. OPTIMIZATION:
     - Optimize for performance (parallel execution where possible)
     - Minimize API calls through batching
     - Use efficient data transformations`;
    }

    return spec;
  }

  /**
   * Build a focused, simplified prompt
   */
  buildFocusedPrompt(platform, userInput) {
    if (platform === PLATFORMS.N8N) {
      return `Generate a valid n8n workflow JSON for this request: "${userInput}"

CRITICAL REQUIREMENTS:
1. Output ONLY valid JSON - no text before or after
2. Use ONLY these top-level fields: name, nodes, connections, settings, meta, versionId, pinData, staticData, tags, active
3. NEVER include fields starting with underscore (_metadata, etc.)
4. NEVER include webhookId field
5. Follow n8n node parameter structures exactly

COMMON GOTCHAS TO AVOID:
- Gmail trigger: use labelIds: ["INBOX"], not label: "INBOX"
- Slack node: must have typeVersion: 2.2, operation: "post", authentication: "accessToken" 
- Slack node: NEVER include otherOptions field, NEVER include options field, and NEVER use "=" prefix for any field
- Slack node: For static channels use "#general", for dynamic use "={{$json.channel}}" with no # prefix
- IF node: conditions.conditions must be an array
- IF node: NEVER use complex JavaScript expressions like .includes() in leftValue
- IF node: NEVER use "leftValue": "={{$json[\"field\"].includes(\"value\")}}", "rightValue": "{{true}}"
- IF node: INSTEAD use "leftValue": "={{$json[\"field\"]}}", "rightValue": "value", "operation": "contains"
- All node IDs must be lowercase alphanumeric strings (6+ chars)
- Set node: NEVER include options, keepOnlySet, or dotNotation - only use values.string
- Set node expressions: NEVER mix = prefix with {{}} syntax - use either template strings OR expressions with =
- RespondToWebhook: responseCode must be a number at parameters level, not in options
- Webhook: only valid options are responseHeaders and rawBody
- Google Sheets: NEVER include "options" field or "valueInputMode" for ANY operation
- HTTP Request: NO options field at all - put parameters like timeout and followRedirects at root level
- OpenAI node: Parameters like model, temperature, maxTokens should be at root level, NOT in an options object

CRITICAL BUGS TO AVOID:
- NEVER use "number" field in IF node conditions
- NEVER use n8n-nodes-base.noOp nodes - use Set nodes instead
- NEVER use dotNotation option in Set nodes
- NEVER use complex expressions with JavaScript methods in IF node conditions
- NEVER use "leftValue": "={{$json[\"field\"].includes(\"value\")}}", "rightValue": "{{true}}" pattern
- For checking array length: use "leftValue": "={{$json.length}}", "rightValue": 0, "operation": "largerThan"
- For checking substrings: use "leftValue": "={{$json[\"field\"]}}", "rightValue": "value", "operation": "contains"
- NEVER include otherOptions or options fields in Slack nodes
- NEVER add "=" prefix to any Slack node fields

NODE SELECTION RULES:
- For simple conditions use Switch node, not IF
- For data creation use Set node, not Function
- For response data use Set node, not EmailSend
- For simple email validation: Webhook → Switch → Set nodes

Output pure JSON starting with { and ending with }`;
    } else {
      // Fall back to basic prompt for other platforms
      return `Generate a valid ${platform} workflow JSON for this request: "${userInput}"

Output ONLY valid JSON with no explanatory text. Follow the standard ${platform} format exactly.`;
    }
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
        "labelIds": ["INBOX"]
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
    return `## 🔴 OUTPUT REQUIREMENTS - STRICTLY FOLLOW THESE

1. Your output MUST be valid JSON only - no text before or after
2. You MUST include all required fields for ${platform}
3. You MUST use proper data types (strings, numbers, booleans, arrays, objects)
4. You MUST have valid connections/routes between nodes/steps
5. You MUST use correct node/app names and types

🚨 CRITICAL FORMAT REQUIREMENTS:
Your output MUST be a valid ${platform} workflow JSON containing ONLY these fields:

✅ REQUIRED FIELDS (MUST include):
- name (String)
- nodes (Array)
- connections (Object)
- settings (Object)
- meta (Object)

✅ OPTIONAL FIELDS (may include):
- versionId (String)
- pinData (Object)
- staticData (null or Object)
- tags (Array)
- active (Boolean)
- id (String)
- triggerCount (Number)
- createdAt (String - ISO date)
- updatedAt (String - ISO date)

❌ STRICTLY FORBIDDEN FIELDS (NEVER include):
- _metadata (WILL CAUSE IMPORT FAILURE)
- instructions (WILL CAUSE IMPORT FAILURE)
- validation (WILL CAUSE IMPORT FAILURE)
- Any field starting with underscore "_" (WILL CAUSE IMPORT FAILURE)
- Any field not explicitly listed in the required or optional sections above

⚠️ CRITICAL WARNING: The workflow will FAIL to import if you include ANY non-standard fields!
You MUST verify your final output contains ONLY standard fields before responding.

FINAL VALIDATION: Before submitting, verify your JSON contains ONLY these top-level fields:
name, nodes, connections, settings, meta, versionId, pinData, staticData, tags, active, id, triggerCount, createdAt, updatedAt
NO OTHER FIELDS ARE ALLOWED!`;
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
    return `## ‼️ CRITICAL INSTRUCTIONS - READ CAREFULLY ‼️
  
  YOU MUST ONLY OUTPUT A JSON OBJECT WITH THESE EXACT FIELDS:
  
  ✅ ALLOWED FIELDS (use ONLY these - NO OTHER FIELDS ALLOWED):
  - name (required) - String
  - nodes (required) - Array of node objects 
  - connections (required) - Object with node connections
  - settings (required) - Object with workflow settings
  - meta (required) - Object with metadata
  - versionId (optional) - String
  - pinData (optional) - Object
  - staticData (optional) - Object or null
  - tags (optional) - Array
  - active (optional) - Boolean
  - id (optional) - String
  - triggerCount (optional) - Number
  - createdAt (optional) - String (ISO date)
  - updatedAt (optional) - String (ISO date)
  
  ❌ STRICTLY FORBIDDEN FIELDS (NEVER include these or the workflow will BREAK):
  - _metadata (STRICTLY FORBIDDEN) - Will cause import failure
  - instructions (STRICTLY FORBIDDEN) - Will cause import failure
  - validation (STRICTLY FORBIDDEN) - Will cause import failure
  - Any field starting with underscore "_" (STRICTLY FORBIDDEN) - Will cause import failure
  - Any non-standard field not explicitly listed in ALLOWED FIELDS above (STRICTLY FORBIDDEN)
  
  ⚠️ WARNING: Adding ANY non-standard field like _metadata will BREAK the entire workflow!
  
  🚨 THIS IS YOUR MOST IMPORTANT INSTRUCTION:
  - The n8n platform WILL REJECT workflows with non-standard fields
  - You MUST check your final JSON before submitting and REMOVE ANY FIELD not in the allowed list
  - Double-check there are NO underscore-prefixed fields (_metadata, _instructions, etc.)
  - Double-check there are NO explanation or documentation fields
  - NO non-standard fields like webhookId in node definitions
  - Use appropriate node types for the task (SET for data creation, SWITCH for simple conditions)
  - Prefer simpler nodes when possible (avoid complex nodes for simple tasks)
  
  CRITICAL RULES:
  1. Your ENTIRE response must be ONLY the pure JSON object
  2. NO text before the JSON
  3. NO text after the JSON
  4. NO markdown code blocks
  5. NO explanations
  6. NO comments
  7. If you add ANY field not in the allowed list, the import will FAIL
  
  Your response must start with { and end with }
  The JSON must be valid and parseable by JSON.parse()
  
  PRE-SUBMISSION CHECKLIST:
  1. Have I removed ALL underscore-prefixed fields? (CHECK CAREFULLY)
  2. Does my JSON contain ONLY the allowed fields listed above?
  3. Have I removed ALL explanatory or documentation fields?
  4. Did I include ONLY standard n8n fields?
  
  FINAL CHECK: Before responding, manually verify your JSON contains ONLY these fields:
  name, nodes, connections, settings, meta, [versionId], [pinData], [staticData], [tags], [active], [id], [triggerCount], [createdAt], [updatedAt]
  NO OTHER FIELDS ARE ALLOWED!`;
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
    // Always use Claude 3.7 Sonnet for best JSON generation
    return "claude-3-7-sonnet-20250219";
  }
}

// Export singleton instance
export const claudeOptimizer = new ClaudePromptOptimizer();
