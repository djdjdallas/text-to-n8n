// src/lib/workflow/formatFixer.js
export class WorkflowFormatFixer {
  /**
   * Remove NoOp nodes entirely
   */
  removeNoOpNodes(workflow) {
    if (!workflow.nodes) return;
    
    // Find all NoOp nodes
    const noOpNodes = workflow.nodes.filter(n => n.type === 'n8n-nodes-base.noOp');
    const noOpNodeNames = noOpNodes.map(n => n.name);
    
    // If no NoOp nodes, return early
    if (noOpNodeNames.length === 0) return;
    
    // Remove NoOp nodes from the nodes array
    workflow.nodes = workflow.nodes.filter(n => n.type !== 'n8n-nodes-base.noOp');
    
    // Remove connections to/from NoOp nodes
    if (workflow.connections) {
      Object.keys(workflow.connections).forEach(sourceName => {
        if (noOpNodeNames.includes(sourceName)) {
          // Remove this connection entirely
          delete workflow.connections[sourceName];
        } else {
          // Remove connections TO NoOp nodes
          const connection = workflow.connections[sourceName];
          if (connection.main) {
            connection.main = connection.main.map(output => {
              if (Array.isArray(output)) {
                return output.filter(conn => !noOpNodeNames.includes(conn.node));
              }
              return output;
            });
          }
        }
      });
    }
  }

  /**
   * Remove any options/otherOptions fields from nodes that shouldn't have them
   */
  removeUnknownOptions(workflow) {
    workflow.nodes?.forEach(node => {
      // List of nodes that should NEVER have options/otherOptions
      const noOptionsNodes = [
        'n8n-nodes-base.slack',
        'n8n-nodes-base.set',
        'n8n-nodes-base.if',
        'n8n-nodes-base.openAi',
        'n8n-nodes-base.googleSheets'
      ];
      
      if (noOptionsNodes.includes(node.type)) {
        if (node.parameters?.options) {
          delete node.parameters.options;
        }
        if (node.parameters?.otherOptions) {
          delete node.parameters.otherOptions;
        }
      }
    });
  }
  
  /**
   * Aggressively remove ALL options fields from ALL nodes
   */
  removeAllOptionsFields(workflow) {
    workflow.nodes?.forEach(node => {
      if (node.parameters?.options) {
        delete node.parameters.options;
      }
      if (node.parameters?.otherOptions) {
        delete node.parameters.otherOptions;
      }
    });
  }
  
  /**
   * Debug helper to identify problematic nodes
   */
  debugWorkflow(workflow) {
    console.log("=== WORKFLOW DEBUG ===");
    workflow.nodes?.forEach((node, index) => {
      console.log(`Node ${index}: ${node.name} (${node.type})`);
      if (node.parameters?.options) {
        console.log("  ⚠️  HAS OPTIONS:", JSON.stringify(node.parameters.options));
      }
      if (node.parameters?.otherOptions) {
        console.log("  ⚠️  HAS OTHER OPTIONS:", JSON.stringify(node.parameters.otherOptions));
      }
      if (node.parameters?.queryParameters?.parameters) {
        console.log("  ⚠️  HAS NESTED QUERY PARAMETERS");
      }
    });
  }

  /**
   * Fix expression syntax across all nodes
   */
  fixExpressionSyntax(workflow) {
    if (!workflow.nodes) return;
    
    console.log("🔧 Running expression syntax fix...");
    
    workflow.nodes.forEach(node => {
      // Fix IF node expressions
      if (node.type === 'n8n-nodes-base.if' && node.parameters?.conditions?.conditions) {
        node.parameters.conditions.conditions = node.parameters.conditions.conditions.map(condition => {
          if (condition.leftValue && typeof condition.leftValue === 'string') {
            const before = condition.leftValue;
            // For 'from' field and other common fields, use cleaner dot notation
            if (condition.leftValue === '={{$json["from"]}}') {
              condition.leftValue = '={{$json.from}}';
            } else if (condition.leftValue === '={{$json["subject"]}}') {
              condition.leftValue = '={{$json.subject}}';
            } else if (condition.leftValue === '={{$json["email"]}}') {
              condition.leftValue = '={{$json.email}}';
            } else {
              // General pattern replacement for escaped quotes
              condition.leftValue = condition.leftValue
                .replace(/\{\{\$json\[\\?"(\w+)\\?"\]\}\}/g, '{{$json.$1}}')
                .replace(/\{\{\$json\["(\w+)"\]\}\}/g, '{{$json.$1}}')
                .replace(/\{\{\$json\['(\w+)'\]\}\}/g, '{{$json.$1}}');
            }
            if (before !== condition.leftValue) {
              console.log(`  ✅ Fixed IF expression: ${before} → ${condition.leftValue}`);
            }
          }
          return condition;
        });
      }
      
      // Fix Slack node text expressions
      if (node.type === 'n8n-nodes-base.slack' && node.parameters?.text) {
        const before = node.parameters.text;
        node.parameters.text = this.fixExpressionString(node.parameters.text);
        if (before !== node.parameters.text) {
          console.log(`  ✅ Fixed Slack expression: ${before.substring(0, 50)}...`);
        }
      }
      
      // Fix Set node value expressions
      if (node.type === 'n8n-nodes-base.set' && node.parameters?.values?.string) {
        node.parameters.values.string = node.parameters.values.string.map(item => {
          if (item.value && typeof item.value === 'string' && item.value.includes('{{')) {
            const before = item.value;
            item.value = this.fixExpressionString(item.value);
            if (before !== item.value) {
              console.log(`  ✅ Fixed Set node expression: ${before} → ${item.value}`);
            }
          }
          return item;
        });
      }

      // Fix any other expression fields in parameters recursively
      this.fixNodeExpressions(node.parameters);
    });
  }

  /**
   * Fix expression string by replacing escaped quotes and complex patterns
   */
  fixExpressionString(text) {
    if (!text || typeof text !== 'string') return text;
    
    // Replace common patterns with cleaner dot notation
    return text
      .replace(/\{\{\$json\[\\?"(\w+)\\?"\]\}\}/g, '{{$json.$1}}')
      .replace(/\{\{\$json\["(\w+)"\]\}\}/g, '{{$json.$1}}')
      .replace(/\{\{\$json\['(\w+)'\]\}\}/g, '{{$json.$1}}');
  }

  /**
   * Recursively fix expressions in node parameters
   */
  fixNodeExpressions(obj) {
    if (!obj || typeof obj !== 'object') return;

    for (const key in obj) {
      if (typeof obj[key] === 'string' && obj[key].includes('{{')) {
        obj[key] = this.fixExpressionString(obj[key]);
      } else if (typeof obj[key] === 'object') {
        this.fixNodeExpressions(obj[key]);
      }
    }
  }

  /**
   * Fix Gmail field references to match actual n8n output
   */
  fixGmailFieldReferences(workflow) {
    if (!workflow.nodes) return;
    
    console.log("🔧 Fixing Gmail field references...");
    
    // Check if workflow has a Gmail trigger
    const hasGmailTrigger = workflow.nodes.some(n => 
      n.type === 'n8n-nodes-base.gmailTrigger' || 
      n.type === 'n8n-nodes-base.gmail'
    );
    
    if (!hasGmailTrigger) {
      console.log("  ❌ No Gmail trigger found, skipping Gmail field fixes");
      return;
    }
    
    console.log("  ✅ Gmail trigger found, applying field reference fixes");
    
    workflow.nodes.forEach(node => {
      // Function to fix Gmail field references in text
      const fixGmailFields = (text) => {
        if (!text || typeof text !== 'string') return text;
        
        return text
          // Fix 'from' references
          .replace(/\{\{\$json\.from\}\}/g, '{{$json["headers"]["from"]}}')
          .replace(/\{\{\$json\["from"\]\}\}/g, '{{$json["headers"]["from"]}}')
          .replace(/\{\{\$json\['from'\]\}\}/g, '{{$json["headers"]["from"]}}')
          // Fix 'subject' references
          .replace(/\{\{\$json\.subject\}\}/g, '{{$json["headers"]["subject"]}}')
          .replace(/\{\{\$json\["subject"\]\}\}/g, '{{$json["headers"]["subject"]}}')
          .replace(/\{\{\$json\['subject'\]\}\}/g, '{{$json["headers"]["subject"]}}')
          // Fix 'text' or 'body' references
          .replace(/\{\{\$json\.text\}\}/g, '{{$json["textPlain"]}}')
          .replace(/\{\{\$json\["text"\]\}\}/g, '{{$json["textPlain"]}}')
          .replace(/\{\{\$json\.body\}\}/g, '{{$json["textPlain"]}}')
          .replace(/\{\{\$json\["body"\]\}\}/g, '{{$json["textPlain"]}}')
          // Fix 'email' references (commonly used for from field)
          .replace(/\{\{\$json\.email\}\}/g, '{{$json["headers"]["from"]}}')
          .replace(/\{\{\$json\["email"\]\}\}/g, '{{$json["headers"]["from"]}}')
          .replace(/\{\{\$json\['email'\]\}\}/g, '{{$json["headers"]["from"]}}');
      };
      
      // Fix IF node conditions
      if (node.type === 'n8n-nodes-base.if' && node.parameters?.conditions?.conditions) {
        node.parameters.conditions.conditions = node.parameters.conditions.conditions.map(condition => {
          if (condition.leftValue) {
            const before = condition.leftValue;
            condition.leftValue = fixGmailFields(condition.leftValue);
            if (before !== condition.leftValue) {
              console.log(`    ✅ Fixed Gmail field in IF: ${before} → ${condition.leftValue}`);
            }
          }
          if (condition.rightValue && typeof condition.rightValue === 'string' && condition.rightValue.includes('{{')) {
            const before = condition.rightValue;
            condition.rightValue = fixGmailFields(condition.rightValue);
            if (before !== condition.rightValue) {
              console.log(`    ✅ Fixed Gmail field in IF rightValue: ${before} → ${condition.rightValue}`);
            }
          }
          return condition;
        });
      }
      
      // Fix Slack node text
      if (node.type === 'n8n-nodes-base.slack' && node.parameters?.text) {
        const before = node.parameters.text;
        node.parameters.text = fixGmailFields(node.parameters.text);
        if (before !== node.parameters.text) {
          console.log(`    ✅ Fixed Gmail fields in Slack text: ${before.substring(0, 30)}...`);
        }
      }
      
      // Fix Set node values
      if (node.type === 'n8n-nodes-base.set' && node.parameters?.values?.string) {
        node.parameters.values.string = node.parameters.values.string.map(item => {
          if (item.value && typeof item.value === 'string') {
            const before = item.value;
            item.value = fixGmailFields(item.value);
            if (before !== item.value) {
              console.log(`    ✅ Fixed Gmail field in Set node: ${item.name}`);
            }
          }
          return item;
        });
      }
      
      // Fix Google Sheets node column mappings
      if (node.type === 'n8n-nodes-base.googleSheets' && node.parameters?.columns?.value) {
        for (const [column, value] of Object.entries(node.parameters.columns.value)) {
          if (typeof value === 'string' && value.includes('{{')) {
            const before = value;
            node.parameters.columns.value[column] = fixGmailFields(value);
            if (before !== node.parameters.columns.value[column]) {
              console.log(`    ✅ Fixed Gmail field in Sheets column ${column}`);
            }
          }
        }
      }
    });
  }

  /**
   * Ensure workflow has all expected fields with proper defaults
   */
  ensureWorkflowCompleteness(workflow) {
    // Ensure all standard fields exist
    if (!workflow.name) workflow.name = "Generated Workflow";
    if (!workflow.nodes) workflow.nodes = [];
    if (!workflow.connections) workflow.connections = {};
    if (!workflow.settings) workflow.settings = {};
    if (!workflow.settings.executionOrder) workflow.settings.executionOrder = "v1";
    if (!workflow.meta) workflow.meta = {};
    if (!workflow.meta.instanceId) workflow.meta.instanceId = this.generateInstanceId();
    
    // Add these fields with proper values
    if (workflow.versionId === undefined) workflow.versionId = this.generateVersionId();
    if (workflow.pinData === undefined) workflow.pinData = {};
    if (workflow.staticData === undefined) workflow.staticData = null;
    if (workflow.tags === undefined) workflow.tags = [];
    if (workflow.active === undefined) workflow.active = false;
    
    // Ensure settings has all expected properties
    if (workflow.settings.saveExecutionProgress === undefined) {
      workflow.settings.saveExecutionProgress = false;
    }
    if (workflow.settings.saveManualExecutions === undefined) {
      workflow.settings.saveManualExecutions = true;
    }
    if (workflow.settings.saveDataErrorExecution === undefined) {
      workflow.settings.saveDataErrorExecution = "all";
    }
    if (workflow.settings.saveDataSuccessExecution === undefined) {
      workflow.settings.saveDataSuccessExecution = "all";
    }
    if (workflow.settings.executionTimeout === undefined) {
      workflow.settings.executionTimeout = -1;
    }
    if (workflow.settings.timezone === undefined) {
      workflow.settings.timezone = "America/New_York";
    }
  }

  /**
   * Fix n8n workflow format issues
   */
  fixN8nWorkflow(workflow) {
    console.log("🔧 formatFixer.fixN8nWorkflow called!");
    
    // Create a copy to avoid mutations
    const fixed = JSON.parse(JSON.stringify(workflow));

    // NEW: Fix expression syntax first
    this.fixExpressionSyntax(fixed);
    
    // NEW: Fix Gmail field references to match actual output
    this.fixGmailFieldReferences(fixed);
    
    // NEW: Ensure workflow completeness
    this.ensureWorkflowCompleteness(fixed);

    // 0. Remove NoOp nodes before processing
    this.removeNoOpNodes(fixed);

    // 0.5. Fix node type casing issues (gmailtrigger → gmailTrigger)
    this.fixNodeTypeNames(fixed);

    // 1. Add meta field if missing
    if (!fixed.meta) {
      fixed.meta = {
        instanceId: this.generateInstanceId(),
      };
    }

    // 2. Ensure name exists
    if (!fixed.name) {
      fixed.name = "Generated Workflow";
    }

    // 3. Fix all nodes
    if (fixed.nodes) {
      fixed.nodes.forEach((node, index) => {
        // Ensure node has valid ID
        if (!node.id || node.id.length < 5) {
          node.id = this.generateNodeId();
        }

        // Ensure position is valid
        if (!Array.isArray(node.position) || node.position.length !== 2) {
          node.position = [250 + index * 200, 300];
        }

        // Add credentials structure if missing
        if (!node.credentials && this.nodeNeedsCredentials(node.type)) {
          node.credentials = this.getDefaultCredentials(node.type);
        }

        // Fix Gmail trigger parameters
        if (node.type === "n8n-nodes-base.gmailTrigger") {
          this.fixGmailTrigger(node);
        }

        // Fix Slack node
        if (node.type === "n8n-nodes-base.slack") {
          this.fixSlackNode(node);
        }

        // Fix IF nodes
        if (node.type === "n8n-nodes-base.if") {
          this.fixIfNode(node);
        }

        // Fix Google Sheets nodes
        if (node.type === "n8n-nodes-base.googleSheets") {
          this.fixGoogleSheetsNode(node);
        }

        // Fix Schedule Trigger
        if (
          node.type === "n8n-nodes-base.scheduleTrigger" ||
          node.type === "n8n-nodes-base.cron"
        ) {
          this.fixScheduleTrigger(node);
        }

        // Fix Google Drive triggers
        if (node.type === "n8n-nodes-base.googleDriveTrigger") {
          this.fixGoogleDriveTrigger(node);
        }
        // Fix Google Drive nodes
        if (node.type === "n8n-nodes-base.googleDrive") {
          console.log(`🔧 Processing Google Drive node: ${node.name}`);
          this.fixGoogleDriveNode(node);
        }

        // Fix HTTP Request nodes
        if (node.type === "n8n-nodes-base.httpRequest") {
          this.fixHttpRequestNode(node);
        }

        // Fix Webhook nodes
        if (node.type === "n8n-nodes-base.webhook") {
          this.fixWebhookNode(node);
        }
        
        // Fix RespondToWebhook nodes
        if (node.type === "n8n-nodes-base.respondToWebhook") {
          this.fixRespondToWebhookNode(node);
        }

        // Fix Email Send nodes
        if (node.type === "n8n-nodes-base.emailSend") {
          this.fixEmailSendNode(node);
        }

        // Fix Function nodes
        if (
          node.type === "n8n-nodes-base.function" ||
          node.type === "n8n-nodes-base.functionItem"
        ) {
          this.fixFunctionNode(node);
        }
        
        // Fix Set nodes
        if (node.type === "n8n-nodes-base.set") {
          this.fixSetNode(node);
        }
        
        // Fix OpenAI nodes
        if (node.type === "n8n-nodes-base.openAi") {
          this.fixOpenAINode(node);
        }
        
        // Fix Filter nodes
        if (node.type === "n8n-nodes-base.filter") {
          this.fixFilterNode(node);
        }
      });
    }

    // 4. Add required fields
    if (!fixed.versionId) {
      fixed.versionId = this.generateVersionId();
    }

    if (!fixed.pinData) {
      fixed.pinData = {};
    }

    if (fixed.staticData === undefined) {
      fixed.staticData = null;
    }

    // 5. Ensure proper settings
    if (!fixed.settings) {
      fixed.settings = {};
    }
    if (!fixed.settings.executionOrder) {
      fixed.settings.executionOrder = "v1";
    }

    // 6. Fix connections structure
    this.fixConnections(fixed);

    // 7. Clean up all unknown options fields
    this.removeUnknownOptions(fixed);
    
    // 8. Aggressively remove ALL options fields (more reliable)
    this.removeAllOptionsFields(fixed);

    // 8.5. Make sure Slack nodes do NOT have otherOptions - they cause import errors in n8n v1.0+
    console.log("🔧 Ensuring Slack nodes don't have otherOptions field");
    fixed.nodes?.forEach(node => {
      if (node.type === 'n8n-nodes-base.slack') {
        if (!node.parameters) node.parameters = {};
        
        // Make sure otherOptions is removed - it's NOT needed in n8n v1.0+
        if (node.parameters.otherOptions) {
          delete node.parameters.otherOptions;
          console.log(`✅ Removed otherOptions from Slack node "${node.name}"`);
        }
      }
    });

    // 9. Remove any metadata that shouldn't be in the import
    delete fixed._metadata;

    // 10. Debug output for troubleshooting (commented out in production)
    // this.debugWorkflow(fixed);

    // 11. Generate node replacement suggestions (store separately)
    // NOTE: suggestions should NOT be added to the workflow object itself
    // They are stored in the return value metadata instead

    // Add debug method for detailed structure inspection
    this.debugWorkflowStructure(fixed);

    // Debug logging to confirm completion
    console.log("✅ formatFixer.fixN8nWorkflow completed!");
    
    // Generate suggestions separately from the workflow
    const suggestions = this.suggestNodeReplacements(fixed);
    
    // Return workflow and suggestions separately
    return {
      workflow: fixed,
      suggestions: suggestions
    };
  }
  
  /**
   * Suggest node replacements to optimize workflow
   */
  suggestNodeReplacements(workflow) {
    const suggestions = [];
    
    if (workflow.nodes) {
      workflow.nodes.forEach(node => {
        // Suggest switch instead of IF for simple conditions
        if (node.type === 'n8n-nodes-base.if' && 
            node.parameters?.conditions?.conditions?.length === 1) {
          suggestions.push({
            node: node.name,
            current: 'if',
            suggested: 'switch',
            reason: 'Switch is simpler for binary conditions'
          });
        }
        
        // Suggest set instead of emailSend for non-email tasks
        if (node.type === 'n8n-nodes-base.emailSend' && 
            !node.name.toLowerCase().includes('email')) {
          suggestions.push({
            node: node.name,
            current: 'emailSend',
            suggested: 'set',
            reason: 'Use set node for creating response data'
          });
        }
        
        // Suggest set instead of function for simple data creation
        if ((node.type === 'n8n-nodes-base.function' || node.type === 'n8n-nodes-base.functionItem') && 
            (node.parameters?.functionCode?.includes('return {') || node.parameters?.functionCode?.includes('return ['))) {
          suggestions.push({
            node: node.name,
            current: 'function',
            suggested: 'set',
            reason: 'Use set node for creating simple data structures'
          });
        }
        
        // Identify noOp nodes
        if (node.type === 'n8n-nodes-base.noOp') {
          suggestions.push({
            node: node.name,
            current: 'noOp',
            suggested: 'remove',
            reason: 'NoOp nodes do nothing and can be removed'
          });
        }
        
        // Check for non-standard fields in webhook nodes
        if (node.type === 'n8n-nodes-base.webhook' && node.webhookId) {
          suggestions.push({
            node: node.name,
            current: 'webhook with webhookId field',
            suggested: 'webhook without webhookId field',
            reason: 'Remove non-standard webhookId field'
          });
        }
      });
    }
    
    return suggestions;
  }

  fixGoogleDriveNode(node) {
    if (!node.parameters) node.parameters = {};

    // Fix list/search operations
    if (
      node.parameters.operation === "list" &&
      node.parameters.resource === "folder"
    ) {
      // Remove invalid 'name' parameter at root level
      if (node.parameters.name) {
        delete node.parameters.name;
      }

      // Ensure search query is in the right place
      if (!node.parameters.queryString && node.parameters.options?.q) {
        node.parameters.queryString = node.parameters.options.q;
        delete node.parameters.options.q;
      }

      // For folder search, it should use 'search' operation
      node.parameters.operation = "search";
      node.parameters.searchMethod = "name";
      node.parameters.searchText = "Invoices 2025";

      // Remove options if empty
      if (
        node.parameters.options &&
        Object.keys(node.parameters.options).length === 0
      ) {
        delete node.parameters.options;
      }
    }

    // Fix upload operations
    if (
      node.parameters.operation === "upload" &&
      node.parameters.resource === "file"
    ) {
      // Fix binary data reference
      if (node.parameters.binary) {
        delete node.parameters.binary;
        // Set the correct binary property name
        node.parameters.binaryPropertyName = "data";
      }

      // Fix parents format - common issue causing validation errors
      if (node.parameters.parents) {
        // Log current format
        console.log(`  Current parents format:`, JSON.stringify(node.parameters.parents));
        
        // Fix all possible wrong formats
        if (typeof node.parameters.parents === 'object' && node.parameters.parents.values) {
          // Wrong format: {"values":[{"id":"root"}]}
          const parentIds = node.parameters.parents.values.map(v => v.id || 'root');
          node.parameters.parents = parentIds;
          console.log(`  ✅ Fixed to:`, JSON.stringify(node.parameters.parents));
        } else if (typeof node.parameters.parents === 'string') {
          // If it's a single string, convert to array
          node.parameters.parents = [node.parameters.parents];
          console.log(`  ✅ Converted string to array:`, JSON.stringify(node.parameters.parents));
        } else if (!Array.isArray(node.parameters.parents)) {
          // If it's any other format, default to ["root"]
          node.parameters.parents = ["root"];
          console.log(`  ✅ Set default parents: ["root"]`);
        }
      }

      // Also check for binaryData flag
      if (node.parameters.binaryData === true && !node.parameters.binaryPropertyName) {
        node.parameters.binaryPropertyName = "data";
        console.log(`  ✅ Added missing binaryPropertyName`);
      }

      // Fix folder ID reference
      if (
        node.parameters.folderId &&
        typeof node.parameters.folderId === "string"
      ) {
        // Ensure it's using proper expression
        if (node.parameters.folderId.includes("getFolderID")) {
          node.parameters.parents = {
            __rl: true,
            value: node.parameters.folderId,
            mode: "id",
          };
          delete node.parameters.folderId;
        }
      }
    }

    // Fix create folder operations
    if (
      node.parameters.operation === "create" &&
      node.parameters.resource === "folder"
    ) {
      // Ensure proper structure
      if (!node.parameters.name && node.parameters.folderName) {
        node.parameters.name = node.parameters.folderName;
        delete node.parameters.folderName;
      }
    }
  }

  /**
   * Fix Gmail Trigger node
   */
  fixGmailTrigger(node) {
    if (!node.parameters) node.parameters = {};

    // Fix labelIds structure - should NOT be inside options
    if (node.parameters.options?.labelIds) {
      node.parameters.labelIds = node.parameters.options.labelIds;
      delete node.parameters.options.labelIds;

      // Remove empty options object
      if (Object.keys(node.parameters.options).length === 0) {
        delete node.parameters.options;
      }
    }

    // Convert label to labelIds array
    if (node.parameters.label && !node.parameters.labelIds) {
      node.parameters.labelIds = [node.parameters.label];
      delete node.parameters.label;
    }

    // Ensure labelIds is an array
    if (node.parameters.labelIds && !Array.isArray(node.parameters.labelIds)) {
      node.parameters.labelIds = [node.parameters.labelIds];
    }

    // Set default labelIds if missing
    if (!node.parameters.labelIds) {
      node.parameters.labelIds = ["INBOX"];
    }

    // Remove invalid scope parameter
    if (node.parameters.scope) {
      delete node.parameters.scope;
    }
  }
  fixAttachmentWorkflow(workflow) {
    // Check if workflow deals with email attachments
    const hasGmailTrigger = workflow.nodes.some(
      (n) =>
        n.type === "n8n-nodes-base.gmailTrigger" &&
        n.parameters?.includeAttachments
    );

    if (hasGmailTrigger) {
      // Find nodes that try to use binary data
      const needsAttachmentDownload = workflow.nodes.some((n) =>
        JSON.stringify(n).includes("$binary")
      );

      if (needsAttachmentDownload) {
        // Insert Gmail getAttachment node after the filter
        const downloadNode = {
          id: "downloadAttachment",
          name: "Download Attachment",
          type: "n8n-nodes-base.gmail",
          typeVersion: 1,
          position: [1000, 240],
          parameters: {
            operation: "getAttachment",
            messageId: '={{$json["messageId"]}}',
            attachmentId: '={{$json["id"]}}',
          },
          credentials: {
            gmailOAuth2: { id: "1", name: "Gmail account" },
          },
        };

        // Add this node to the workflow
        // Update connections accordingly
      }
    }
  }

  /**
   * Fix Slack node
   */
  fixSlackNode(node) {
    if (!node.parameters) node.parameters = {};

    // Fix version
    if (!node.typeVersion || node.typeVersion < 2) {
      node.typeVersion = 2.2;
    }

    // Remove invalid resource parameter
    if (node.parameters.resource) {
      delete node.parameters.resource;
    }

    // Ensure operation is set
    if (!node.parameters.operation) {
      node.parameters.operation = "post";
    }

    // Ensure authentication is set
    if (!node.parameters.authentication) {
      node.parameters.authentication = "accessToken";
    }

    // Fix channel format issues
    if (node.parameters.channel) {
      // Remove any expression prefix if the channel already has # symbol
      if (node.parameters.channel.includes("#=")) {
        node.parameters.channel = node.parameters.channel.replace("#=", "");
      }
      
      // Fix channel references that use expressions
      if (node.parameters.channel.startsWith("=")) {
        // Handle "#={{$json.slackChannel}}" format
        if (node.parameters.channel.startsWith("=#")) {
          node.parameters.channel = node.parameters.channel.substring(1); // Remove = but keep #
        }
        // Handle "={{$json.slackChannel}}" format
        else {
          const expression = node.parameters.channel.substring(1);
          
          // Check if the expression itself might contain a # already
          if (expression.includes("#")) {
            node.parameters.channel = expression;
          } else if (expression.includes("{{") && expression.includes("}}")) {
            // This is a valid expression, just remove the = prefix
            node.parameters.channel = expression;
          } else {
            // Add # if missing and not an expression
            node.parameters.channel = "#" + expression;
          }
        }
      }
      // Handle static channel names without # prefix
      else if (!node.parameters.channel.startsWith("#") && 
               !node.parameters.channel.match(/^\{\{.*\}\}$/)) {
        if (node.parameters.channel.match(/^[CG][A-Z0-9]+$/)) {
          // It's a channel ID, replace with placeholder
          node.parameters.channel = "#general";
        } else {
          node.parameters.channel = "#" + node.parameters.channel;
        }
      }
    }
    
    // Fix text field - remove "=" prefix if it exists
    if (node.parameters.text && typeof node.parameters.text === 'string' && node.parameters.text.startsWith("=")) {
      node.parameters.text = node.parameters.text.substring(1);
    }
    
    // Also fix blocks field if it exists and has "=" prefix
    if (node.parameters.blocks && typeof node.parameters.blocks === 'string' && node.parameters.blocks.startsWith("=")) {
      node.parameters.blocks = node.parameters.blocks.substring(1);
    }
    
    // Fix attachments field if it exists
    if (node.parameters.attachments && typeof node.parameters.attachments === 'string' && node.parameters.attachments.startsWith("=")) {
      node.parameters.attachments = node.parameters.attachments.substring(1);
    }
    
    // Remove otherOptions completely - it's not needed in n8n v1.0+
    if (node.parameters.otherOptions) {
      delete node.parameters.otherOptions;
      console.log(`✅ Removed otherOptions from Slack node "${node.name}"`);
    }

    console.log(`ℹ️ Processed Slack node "${node.name}" - ensured no otherOptions field`);
  }

  /**
   * Fix IF node conditions
   */
  fixIfNode(node) {
    if (!node.parameters) node.parameters = {};

    // Handle various condition formats
    if (node.parameters.conditions) {
      // REMOVE the "number" field if it exists (it's invalid)
      if (node.parameters.conditions.number) {
        delete node.parameters.conditions.number;
      }

      // Ensure conditions object structure
      if (!node.parameters.conditions.conditions) {
        if (Array.isArray(node.parameters.conditions)) {
          // Old format - wrap in conditions object
          node.parameters.conditions = {
            conditions: node.parameters.conditions,
          };
        } else {
          node.parameters.conditions.conditions = [];
        }
      }

      // Ensure conditions.conditions is an array
      if (!Array.isArray(node.parameters.conditions.conditions)) {
        node.parameters.conditions.conditions = [
          node.parameters.conditions.conditions,
        ];
      }

      // Remove invalid "string" field if both exist
      if (node.parameters.conditions.string && node.parameters.conditions.conditions) {
        delete node.parameters.conditions.string;
      }

      // Fix empty or invalid conditions
      node.parameters.conditions.conditions =
        node.parameters.conditions.conditions
          .filter((condition) => condition !== null && condition !== undefined)
          .map((condition, index) => {
            // Ensure condition has all required fields
            const fixedCondition = {
              leftValue: condition.leftValue || '={{$json["field"]}}',
              rightValue: condition.rightValue || "",
              operation: condition.operation || "equal",
            };

            // Fix empty leftValue
            if (!fixedCondition.leftValue || fixedCondition.leftValue === "") {
              fixedCondition.leftValue = '={{$json["email"]}}';
            }
            
            // Convert complex boolean expressions to simpler ones
            if (typeof fixedCondition.leftValue === 'string') {
              // Handle includes() method - convert to contains operation
              if (fixedCondition.leftValue.includes('.includes(')) {
                const matchResult = fixedCondition.leftValue.match(/\{\{([^}]+)\.includes\(['"](.*)['"]\)\}\}/);
                if (matchResult && matchResult.length >= 3) {
                  fixedCondition.leftValue = `={{${matchResult[1]}}}`;
                  fixedCondition.rightValue = matchResult[2];
                  fixedCondition.operation = "contains";
                }
              }
              
              // Handle comparison to boolean literals with equals
              if (fixedCondition.operation === "equal" && 
                  fixedCondition.rightValue === "{{true}}" &&
                  fixedCondition.leftValue.includes('>') || 
                  fixedCondition.leftValue.includes('<') ||
                  fixedCondition.leftValue.includes('===') ||
                  fixedCondition.leftValue.includes('!==')) {
                
                // Extract the actual comparison from leftValue
                const valuePattern = /\{\{(.+?)\}\}/;
                const match = fixedCondition.leftValue.match(valuePattern);
                if (match && match[1]) {
                  // Extract the parts of the comparison
                  const comparisonStr = match[1];
                  
                  // For array length comparisons
                  if (comparisonStr.includes('.length')) {
                    const lengthMatch = comparisonStr.match(/\$json(?:\[['"](.+?)['"]\])?\.length\s*([><=!]+)\s*(\d+)/);
                    if (lengthMatch) {
                      const [_, field, operator, value] = lengthMatch;
                      
                      if (field) {
                        fixedCondition.leftValue = `={{$json["${field}"].length}}`;
                      } else {
                        fixedCondition.leftValue = `={{$json.length}}`;
                      }
                      
                      if (operator === '>' || operator === '>=') {
                        fixedCondition.operation = "largerThan";
                        fixedCondition.rightValue = parseInt(value) - 1;  // Adjust for largerThan vs >=
                      } else if (operator === '<' || operator === '<=') {
                        fixedCondition.operation = "smallerThan";
                        fixedCondition.rightValue = parseInt(value) + 1;  // Adjust for smallerThan vs <=
                      } else {
                        fixedCondition.operation = "equal";
                        fixedCondition.rightValue = parseInt(value);
                      }
                    }
                  }
                }
              }
            }
            
            // Handle boolean values to ensure they're not strings
            if (fixedCondition.rightValue === "true" || fixedCondition.rightValue === "{{true}}") {
              fixedCondition.rightValue = true;
            } else if (fixedCondition.rightValue === "false" || fixedCondition.rightValue === "{{false}}") {
              fixedCondition.rightValue = false;
            }
            
            // Handle "exists" operation - it should have empty rightValue
            if (fixedCondition.operation === 'exists' || fixedCondition.operation === 'notExists') {
              fixedCondition.rightValue = '';
            }
            
            // Fix IF nodes with empty rightValue for numeric comparisons
            if ((fixedCondition.operation === 'largerThan' || 
                 fixedCondition.operation === 'smallerThan' || 
                 fixedCondition.operation === 'largerOrEqual' || 
                 fixedCondition.operation === 'smallerOrEqual') && 
                (fixedCondition.rightValue === '' || fixedCondition.rightValue === null || fixedCondition.rightValue === undefined)) {
              fixedCondition.rightValue = 0;
              console.log(`  ✅ Fixed IF node: empty rightValue → 0 for ${fixedCondition.operation}`);
            }

            return fixedCondition;
          });

      // Ensure at least one condition exists
      if (node.parameters.conditions.conditions.length === 0) {
        node.parameters.conditions.conditions = [
          {
            leftValue: '={{$json["email"]}}',
            rightValue: "",
            operation: "equal",
          },
        ];
      }

      // Remove invalid combinator field
      if (node.parameters.conditions.combinator) {
        delete node.parameters.conditions.combinator;
      }
    } else {
      // No conditions at all - create default
      node.parameters.conditions = {
        conditions: [
          {
            leftValue: '={{$json["email"]}}',
            rightValue: "",
            operation: "equal",
          },
        ],
      };
    }

    // Set combineOperation if not set
    if (!node.parameters.combineOperation) {
      node.parameters.combineOperation = "all";
    }
  }

  /**
   * Fix Google Sheets node
   */
  fixGoogleSheetsNode(node) {
    if (!node.parameters) node.parameters = {};

    // Set default operation if missing
    if (!node.parameters.operation) {
      node.parameters.operation = "append";
    }

    // Fix documentId format - remove __rl wrapper
    if (node.parameters.documentId?.__rl) {
      node.parameters.documentId = node.parameters.documentId.value || "YOUR_SHEET_ID_HERE";
    }

    // Fix sheetName format - remove __rl wrapper
    if (node.parameters.sheetName?.__rl) {
      node.parameters.sheetName = node.parameters.sheetName.value || "Sheet1";
    }

    // Remove options field for all operations (they cause issues)
    if (node.parameters.options) {
      delete node.parameters.options;
    }

    // Fix columns structure for append operation
    if (node.parameters.columns?.mappingMode === "defineBelow") {
      if (node.parameters.columns.value?.mappingValues) {
        const simpleColumns = {};
        node.parameters.columns.value.mappingValues.forEach((mapping) => {
          simpleColumns[mapping.column] = mapping.value;
        });
        node.parameters.columns.value = simpleColumns;
      }
    }
    
    // Remove valueInputMode if it exists (not supported by n8n)
    if (node.parameters.valueInputMode) {
      delete node.parameters.valueInputMode;
    }
  }

  /**
   * Check if node type needs credentials
   */
  nodeNeedsCredentials(nodeType) {
    const credentialNodes = [
      "n8n-nodes-base.gmailTrigger",
      "n8n-nodes-base.gmail",
      "n8n-nodes-base.slack",
      "n8n-nodes-base.googleSheets",
      "n8n-nodes-base.googleDrive",
      "n8n-nodes-base.googleDriveTrigger",
    ];
    return credentialNodes.includes(nodeType);
  }

  /**
   * Get default credentials structure for node type
   */
  getDefaultCredentials(nodeType) {
    const credentialMap = {
      "n8n-nodes-base.gmailTrigger": {
        gmailOAuth2: { id: "1", name: "Gmail account" },
      },
      "n8n-nodes-base.gmail": {
        gmailOAuth2: { id: "1", name: "Gmail account" },
      },
      "n8n-nodes-base.slack": { slackApi: { id: "2", name: "Slack account" } },
      "n8n-nodes-base.googleSheets": {
        googleSheetsOAuth2Api: { id: "3", name: "Google Sheets account" },
      },
      "n8n-nodes-base.googleDrive": {
        googleDriveOAuth2Api: { id: "4", name: "Google Drive account" },
      },
      "n8n-nodes-base.googleDriveTrigger": {
        googleDriveOAuth2Api: { id: "4", name: "Google Drive account" },
      },
    };
    return credentialMap[nodeType] || {};
  }

  /**
   * Generate a valid node ID
   */
  generateNodeId() {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < 8; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  // ... rest of the existing methods remain the same ...

  /**
   * Fix Schedule Trigger parameters
   */
  fixScheduleTrigger(node) {
    if (!node.parameters) node.parameters = {};

    // If using interval mode
    if (node.parameters.rule) {
      const rule = node.parameters.rule;

      // Fix interval - must be array
      if (rule.interval !== undefined && !Array.isArray(rule.interval)) {
        rule.interval = [rule.interval];
      }

      // Fix cronTimes if it exists
      if (rule.cronTimes && !Array.isArray(rule.cronTimes)) {
        rule.cronTimes = [rule.cronTimes];
      }
      
      // Fix weekly schedules with hour and dayOfWeek
      if (rule.hour !== undefined && rule.dayOfWeek !== undefined) {
        // Convert hour/dayOfWeek to cron expression
        const hour = typeof rule.hour === 'number' ? rule.hour : parseInt(rule.hour, 10) || 8;
        let dayOfWeek = 1; // Default to Monday
        
        if (rule.dayOfWeek !== undefined) {
          if (typeof rule.dayOfWeek === 'string') {
            // Convert day name to number (0 = Sunday, 1 = Monday, etc.)
            const dayMap = {
              'sunday': 0, 'sun': 0,
              'monday': 1, 'mon': 1,
              'tuesday': 2, 'tue': 2,
              'wednesday': 3, 'wed': 3,
              'thursday': 4, 'thu': 4,
              'friday': 5, 'fri': 5,
              'saturday': 6, 'sat': 6
            };
            dayOfWeek = dayMap[rule.dayOfWeek.toLowerCase()] || 1;
          } else if (typeof rule.dayOfWeek === 'number') {
            dayOfWeek = rule.dayOfWeek;
          }
        }
        
        // Format cron expression: minute hour * * day-of-week
        // e.g., "0 8 * * 1" for Monday at 8 AM
        node.parameters.cronExpression = `0 ${hour} * * ${dayOfWeek}`;
        node.parameters.mode = "cronExpression";
        
        // Remove rule structure since we're using cron
        delete node.parameters.rule;
      }
    }

    // If mode is not set, try to infer it
    if (!node.parameters.mode) {
      if (node.parameters.cronExpression) {
        node.parameters.mode = "cronExpression";
      } else if (node.parameters.rule) {
        node.parameters.mode = "everyX";
      }
    }
    
    // Handle cron expression for weekly schedules if specified directly
    if (node.parameters.mode === "cronExpression" && !node.parameters.cronExpression) {
      node.parameters.cronExpression = "0 8 * * 1"; // Default to Monday 8 AM
    }
    
    // Ensure we have a valid typeVersion
    if (!node.typeVersion || node.typeVersion < 1) {
      node.typeVersion = 1;
    }
  }

  /**
   * Fix Google Drive Trigger
   */
  fixGoogleDriveTrigger(node) {
    if (!node.parameters) node.parameters = {};

    // Ensure event is set
    if (!node.parameters.event) {
      node.parameters.event = "fileCreated";
    }

    // Fix folder ID format
    if (
      node.parameters.folderId &&
      typeof node.parameters.folderId === "object"
    ) {
      node.parameters.folderId =
        node.parameters.folderId.value || node.parameters.folderId.id || "";
    }

    // Fix pollTimes structure
    if (!node.parameters.pollTimes) {
      node.parameters.pollTimes = {
        item: [
          {
            mode: "everyMinute",
          },
        ],
      };
    } else if (node.parameters.pollTimes && !node.parameters.pollTimes.item) {
      // Wrap in item array if needed
      node.parameters.pollTimes = {
        item: [node.parameters.pollTimes],
      };
    }
  }

  /**
   * Fix HTTP Request node
   */
  fixHttpRequestNode(node) {
    if (!node.parameters) node.parameters = {};

    // Set default method
    if (!node.parameters.method) {
      node.parameters.method = "GET";
    }

    // Fix authentication if present
    if (
      node.parameters.authentication &&
      typeof node.parameters.authentication === "object"
    ) {
      // Ensure it's a string value
      node.parameters.authentication =
        node.parameters.authentication.value || "none";
    }

    // Fix queryParameters structure - should be flat object, not nested array
    if (node.parameters.queryParameters?.parameters) {
      // Convert array format to object format
      const queryParams = {};
      node.parameters.queryParameters.parameters.forEach(param => {
        if (param.name && param.value !== undefined) {
          queryParams[param.name] = param.value;
        }
      });
      node.parameters.queryParameters = queryParams;
    }

    // Handle queryParametersUi format too (alternative format)
    if (node.parameters.queryParametersUi?.parameter) {
      // If it's not an array, make it an array
      if (!Array.isArray(node.parameters.queryParametersUi.parameter)) {
        node.parameters.queryParametersUi.parameter = [
          node.parameters.queryParametersUi.parameter,
        ];
      }
      
      // Ensure all parameters have name and value
      node.parameters.queryParametersUi.parameter = 
        node.parameters.queryParametersUi.parameter.filter(param => 
          param && param.name && param.value !== undefined);
    }

    // Fix headers format for headerParametersUi
    if (node.parameters.headerParametersUi?.parameter) {
      if (!Array.isArray(node.parameters.headerParametersUi.parameter)) {
        node.parameters.headerParametersUi.parameter = [
          node.parameters.headerParametersUi.parameter,
        ];
      }
      
      // Ensure all parameters have name and value
      node.parameters.headerParametersUi.parameter = 
        node.parameters.headerParametersUi.parameter.filter(param => 
          param && param.name && param.value !== undefined);
    }

    // Move essential options to root level (before removing options)
    if (node.parameters.options) {
      // Save timeout at root level if present
      if (node.parameters.options.timeout !== undefined) {
        node.parameters.timeout = node.parameters.options.timeout;
      }
      
      // Handle nested options from previous versions
      if (node.parameters.options.redirect?.redirect?.followRedirects !== undefined) {
        node.parameters.followRedirects = node.parameters.options.redirect.redirect.followRedirects;
      }
      
      if (node.parameters.options.response?.response?.fullResponse !== undefined) {
        node.parameters.fullResponse = node.parameters.options.response.response.fullResponse;
      }
      
      // Remove options field completely
      delete node.parameters.options;
    }
  }

  /**
   * Fix Webhook node
   */
  fixWebhookNode(node) {
    if (!node.parameters) node.parameters = {};

    // Set default method
    if (!node.parameters.httpMethod) {
      node.parameters.httpMethod = "POST";
    }

    // Set default path - ensure no spaces
    if (!node.parameters.path) {
      node.parameters.path = node.name.toLowerCase().replace(/\s+/g, "-");
    } else {
      // Remove any spaces from existing path
      node.parameters.path = node.parameters.path.replace(/\s+/g, "-");
    }

    // Ensure responseMode is set
    if (!node.parameters.responseMode) {
      node.parameters.responseMode = "onReceived";
    }

    // Fix options
    if (!node.parameters.options) {
      node.parameters.options = {};
    }
    
    // Remove invalid options
    if (node.parameters.options) {
      const validWebhookOptions = ['responseHeaders', 'rawBody'];
      const cleanOptions = {};
      
      validWebhookOptions.forEach(opt => {
        if (node.parameters.options[opt] !== undefined) {
          cleanOptions[opt] = node.parameters.options[opt];
        }
      });
      
      // Remove invalid responseData option
      if (node.parameters.options.responseData) {
        delete node.parameters.options.responseData;
      }
      
      // If options is empty, remove it
      if (Object.keys(cleanOptions).length === 0) {
        delete node.parameters.options;
      } else {
        node.parameters.options = cleanOptions;
      }
    }
    
    // Remove non-standard webhookId field if it exists at the node level
    if (node.webhookId) {
      delete node.webhookId;
    }
    
    // Remove non-standard fields that might exist at the node level
    const standardNodeFields = ['id', 'name', 'type', 'typeVersion', 'position', 'parameters', 'credentials'];
    Object.keys(node).forEach(field => {
      if (!standardNodeFields.includes(field)) {
        delete node[field];
      }
    });
  }
  
  /**
   * Fix RespondToWebhook node
   */
  fixRespondToWebhookNode(node) {
    if (!node.parameters) node.parameters = {};
    
    // Fix responseCode to be a number
    if (node.parameters.options?.responseCode) {
      // If it's an expression, set a default
      if (typeof node.parameters.options.responseCode === 'string' && 
          node.parameters.options.responseCode.includes('{{')) {
        // Move to parameters level and set default
        node.parameters.responseCode = 200;
        delete node.parameters.options.responseCode;
      }
    }
    
    // responseCode should be at parameters level, not in options
    if (node.parameters.options?.responseCode) {
      node.parameters.responseCode = node.parameters.options.responseCode;
      delete node.parameters.options.responseCode;
    }
    
    // Ensure responseCode is a number
    if (node.parameters.responseCode && typeof node.parameters.responseCode === 'string') {
      if (!node.parameters.responseCode.includes('{{')) {
        node.parameters.responseCode = parseInt(node.parameters.responseCode, 10) || 200;
      }
    }
    
    // Fix complex responseData structure - convert to simple format
    if (node.parameters.responseData && 
        typeof node.parameters.responseData === 'string' && 
        node.parameters.responseData.includes('JSON.stringify')) {
      
      // Set up standard response structure
      node.parameters.respondWith = "json";
      node.parameters.responseCode = node.parameters.responseCode || 200;
      
      // Create simple options structure if needed
      if (!node.parameters.options) {
        node.parameters.options = {};
      }
      
      // Set responseData to simple format
      node.parameters.options.responseData = "firstEntryJson";
      
      // Remove old complex responseData
      delete node.parameters.responseData;
    }
    
    // Always ensure we have proper respondWith value
    if (!node.parameters.respondWith) {
      node.parameters.respondWith = "json";
    }
    
    // Always ensure we have proper responseCode
    if (!node.parameters.responseCode) {
      node.parameters.responseCode = 200;
    }
    
    // Clean up empty options
    if (node.parameters.options && Object.keys(node.parameters.options).length === 0) {
      delete node.parameters.options;
    }
  }

  /**
   * Fix Email Send node
   */
  fixEmailSendNode(node) {
    if (!node.parameters) node.parameters = {};

    // Ensure required fields exist
    if (!node.parameters.fromEmail) {
      node.parameters.fromEmail = "noreply@example.com";
    }

    // Fix toEmail - ensure it's properly formatted
    if (
      node.parameters.toEmail &&
      typeof node.parameters.toEmail === "object"
    ) {
      node.parameters.toEmail = node.parameters.toEmail.value || "";
    }

    // Fix attachments format if present
    if (node.parameters.attachments) {
      if (!node.parameters.attachments.attachment) {
        node.parameters.attachments = {
          attachment: Array.isArray(node.parameters.attachments)
            ? node.parameters.attachments
            : [node.parameters.attachments],
        };
      }
    }
  }

  /**
   * Fix Function nodes
   */
  fixFunctionNode(node) {
    if (!node.parameters) node.parameters = {};

    // Ensure functionCode exists
    if (!node.parameters.functionCode) {
      node.parameters.functionCode = "// Add your code here\nreturn items;";
    }

    // Fix legacy jsCode parameter
    if (node.parameters.jsCode && !node.parameters.functionCode) {
      node.parameters.functionCode = node.parameters.jsCode;
      delete node.parameters.jsCode;
    }
  }

  /**
   * Fix Set node parameters
   */
  fixSetNode(node) {
    if (!node.parameters) node.parameters = {};
    
    // Remove keepOnlySet entirely - we won't use it at all
    if (node.parameters.keepOnlySet !== undefined) {
      delete node.parameters.keepOnlySet;
    }
    
    // Remove options object entirely
    if (node.parameters.options) {
      delete node.parameters.options;
    }
    
    // Ensure values.string is an array
    if (node.parameters.values && node.parameters.values.string && !Array.isArray(node.parameters.values.string)) {
      node.parameters.values.string = [node.parameters.values.string];
    }
    
    // Create default values if missing
    if (!node.parameters.values) {
      node.parameters.values = {
        string: [
          { name: "success", value: "true" }
        ]
      };
    }
    
    // Fix expression syntax
    this.fixSetNodeExpressions(node);
    
    // Ensure typeVersion is 1 for set nodes
    node.typeVersion = 1;
  }
  
  /**
   * Fix Set node expression syntax
   */
  fixSetNodeExpressions(node) {
    if (!node.parameters?.values?.string) return;
    
    node.parameters.values.string = node.parameters.values.string.map(item => {
      if (item.value && typeof item.value === 'string') {
        // If value starts with = and contains {{, fix the syntax
        if (item.value.startsWith('=') && item.value.includes('{{')) {
          // Remove the = prefix and let n8n handle it as a template string
          item.value = item.value.substring(1);
          console.log(`Fixed mixed expression syntax in Set node value: ${item.name}`);
        }
      }
      return item;
    });
  }

  /**
   * Fix Filter node structure
   */
  fixFilterNode(node) {
    if (!node.parameters) node.parameters = {};
    
    // Fix conditions structure, especially fixing string-based conditions
    if (node.parameters.conditions?.string) {
      // Convert string-type conditions to boolean type
      let booleanConditions = [];
      
      // Process string conditions
      if (Array.isArray(node.parameters.conditions.string)) {
        booleanConditions = node.parameters.conditions.string.map(condition => {
          return {
            value1: condition.value1,
            operation: condition.operation || "equal",
            value2: condition.value2
          };
        });
      } else if (node.parameters.conditions.string) {
        // Single condition as object
        booleanConditions = [{
          value1: node.parameters.conditions.string.value1,
          operation: node.parameters.conditions.string.operation || "equal",
          value2: node.parameters.conditions.string.value2
        }];
      }
      
      // Replace with proper boolean structure
      node.parameters.dataType = "boolean";
      node.parameters.conditions = {
        boolean: booleanConditions
      };
    }
    
    // Check if we need to create a default filter structure
    if (!node.parameters.dataType) {
      node.parameters.dataType = "boolean";
      
      if (!node.parameters.conditions || !node.parameters.conditions.boolean) {
        node.parameters.conditions = {
          boolean: [{
            value1: "={{$json[\"active\"]}}",
            operation: "equal",
            value2: true
          }]
        };
      }
    }
    
    // Ensure combination mode is set
    if (!node.parameters.combineOperation) {
      node.parameters.combineOperation = "AND";
    }
    
    // Convert any lowercase combiners to uppercase
    if (node.parameters.combineOperation === "and") {
      node.parameters.combineOperation = "AND";
    } else if (node.parameters.combineOperation === "or") {
      node.parameters.combineOperation = "OR";
    }
  }
  
  /**
   * Fix OpenAI node parameters
   */
  fixOpenAINode(node) {
    if (!node.parameters) node.parameters = {};
    
    // Move options fields to root level if they exist
    if (node.parameters.options) {
      // Common OpenAI parameters that should be at root level
      if (node.parameters.options.model) {
        node.parameters.model = node.parameters.options.model;
      }
      
      if (node.parameters.options.temperature !== undefined) {
        node.parameters.temperature = node.parameters.options.temperature;
      }
      
      if (node.parameters.options.maxTokens !== undefined) {
        node.parameters.maxTokens = node.parameters.options.maxTokens;
      }
      
      // Check for max_tokens (snake_case variant)
      if (node.parameters.options.max_tokens !== undefined) {
        node.parameters.maxTokens = node.parameters.options.max_tokens;
      }
      
      // Check for other common parameters
      const commonParams = [
        'topP', 'frequencyPenalty', 'presencePenalty', 
        'stop', 'topK', 'n', 'stream'
      ];
      
      commonParams.forEach(param => {
        if (node.parameters.options[param] !== undefined) {
          node.parameters[param] = node.parameters.options[param];
        }
      });
      
      // Remove the options field after moving values
      delete node.parameters.options;
    }
    
    // Ensure required fields
    if (!node.parameters.model) {
      node.parameters.model = "gpt-3.5-turbo"; // Default model
    }
    
    // Check the resource and ensure proper structure
    if (node.parameters.resource === "chat") {
      // Ensure prompt.messages exists and is properly formatted
      if (!node.parameters.prompt) {
        node.parameters.prompt = {
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant."
            }
          ]
        };
      } else if (!node.parameters.prompt.messages) {
        node.parameters.prompt.messages = [
          {
            role: "system",
            content: "You are a helpful assistant."
          }
        ];
      }
    }
  }

  /**
   * Fix lowercase node type names to correct camelCase format
   */
  fixNodeTypeNames(workflow) {
    if (!workflow.nodes) return;
    
    // Map of lowercase node types to their correct camelCase versions
    const nodeTypeCasingMap = {
      'n8n-nodes-base.gmailtrigger': 'n8n-nodes-base.gmailTrigger',
      'n8n-nodes-base.googlesheets': 'n8n-nodes-base.googleSheets',
      'n8n-nodes-base.googledrive': 'n8n-nodes-base.googleDrive',
      'n8n-nodes-base.googledrivetrigger': 'n8n-nodes-base.googleDriveTrigger',
      'n8n-nodes-base.httprequest': 'n8n-nodes-base.httpRequest',
      'n8n-nodes-base.scheduletrigger': 'n8n-nodes-base.scheduleTrigger',
      'n8n-nodes-base.respondtowebhook': 'n8n-nodes-base.respondToWebhook',
      'n8n-nodes-base.emailsend': 'n8n-nodes-base.emailSend',
      'n8n-nodes-base.functionitem': 'n8n-nodes-base.functionItem',
      'n8n-nodes-base.openai': 'n8n-nodes-base.openAi',
      'n8n-nodes-base.splitinbatches': 'n8n-nodes-base.splitInBatches',
    };
    
    // Fix node type casing
    workflow.nodes.forEach(node => {
      if (node.type && nodeTypeCasingMap[node.type.toLowerCase()]) {
        node.type = nodeTypeCasingMap[node.type.toLowerCase()];
      }
    });
  }

  /**
   * Fix connections structure
   */
  fixConnections(workflow) {
    if (!workflow.connections) {
      workflow.connections = {};
      return;
    }

    // Ensure all connections have proper structure
    Object.keys(workflow.connections).forEach((nodeName) => {
      const connection = workflow.connections[nodeName];

      // Ensure main array exists
      if (!connection.main) {
        connection.main = [];
      }

      // Ensure main is an array of arrays
      if (!Array.isArray(connection.main)) {
        connection.main = [connection.main];
      }

      // Fix each output
      connection.main = connection.main.map((output) => {
        if (!Array.isArray(output)) {
          return [output];
        }
        return output.filter((conn) => conn && conn.node);
      });
    });
  }

  /**
   * Check if a node is connected
   */
  isNodeConnected(nodeName, connections) {
    // Check if node has outgoing connections
    if (connections[nodeName]) {
      return true;
    }

    // Check if node has incoming connections
    for (const [sourceName, outputs] of Object.entries(connections)) {
      if (outputs.main) {
        for (const output of outputs.main) {
          if (output && Array.isArray(output)) {
            for (const connection of output) {
              if (connection.node === nodeName) {
                return true;
              }
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * Generate instance ID
   */
  generateInstanceId() {
    // In browser environment, use crypto API differently
    if (typeof window !== "undefined" && window.crypto) {
      const array = new Uint8Array(32);
      window.crypto.getRandomValues(array);
      return Array.from(array, (byte) =>
        byte.toString(16).padStart(2, "0")
      ).join("");
    } else {
      // Fallback for Node.js environment
      return "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".replace(
        /[x]/g,
        () => {
          return ((Math.random() * 16) | 0).toString(16);
        }
      );
    }
  }

  /**
   * Debug workflow structure to identify issues
   */
  debugWorkflowStructure(workflow) {
    console.log("🔍 Detailed workflow structure:");
    workflow.nodes?.forEach((node, i) => {
      console.log(`\nNode ${i}: ${node.name} (${node.type})`);
      console.log("Parameters:", JSON.stringify(node.parameters, null, 2));
    });
    console.log("\nConnections:", JSON.stringify(workflow.connections, null, 2));
    console.log("\nSettings:", JSON.stringify(workflow.settings, null, 2));
  }

  /**
   * Generate version ID
   */
  generateVersionId() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }
}

export const workflowFixer = new WorkflowFormatFixer();
