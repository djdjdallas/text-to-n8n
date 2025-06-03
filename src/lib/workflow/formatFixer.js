// src/lib/workflow/formatFixer.js
export class WorkflowFormatFixer {
  /**
   * Fix n8n workflow format issues
   */
  fixN8nWorkflow(workflow) {
    // Create a copy to avoid mutations
    const fixed = JSON.parse(JSON.stringify(workflow));

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

    // 7. Remove any metadata that shouldn't be in the import
    delete fixed._metadata;

    // 8. Generate node replacement suggestions
    fixed.suggestions = this.suggestNodeReplacements(fixed);

    return fixed;
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

    // Fix channel format - ensure it starts with #
    if (node.parameters.channel && !node.parameters.channel.startsWith("#")) {
      if (node.parameters.channel.match(/^[CG][A-Z0-9]+$/)) {
        // It's a channel ID, replace with placeholder
        node.parameters.channel = "#general";
      } else {
        node.parameters.channel = "#" + node.parameters.channel;
      }
    }

    // Ensure otherOptions exists
    if (!node.parameters.otherOptions) {
      node.parameters.otherOptions = {};
    }
  }

  /**
   * Fix IF node conditions
   */
  fixIfNode(node) {
    if (!node.parameters) node.parameters = {};

    // Handle various condition formats
    if (node.parameters.conditions) {
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

      // NEW: Remove invalid "string" field if both exist
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
              fixedCondition.leftValue = '={{$json["field"]}}';
            }

            // NEW: Fix field references in conditions
            if (fixedCondition.leftValue === '={{$json["field"]}}') {
              // Try to infer the correct field from context
              fixedCondition.leftValue = '={{$json["email"]}}'; // Common case
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
      node.parameters.documentId =
        node.parameters.documentId.value || "YOUR_SHEET_ID_HERE";
    }

    // Fix sheetName format - remove __rl wrapper
    if (node.parameters.sheetName?.__rl) {
      node.parameters.sheetName = node.parameters.sheetName.value || "Sheet1";
    }

    // Fix columns structure
    if (node.parameters.columns?.mappingMode === "defineBelow") {
      if (node.parameters.columns.value?.mappingValues) {
        // Convert mappingValues array to simple object
        const simpleColumns = {};
        node.parameters.columns.value.mappingValues.forEach((mapping) => {
          simpleColumns[mapping.column] = mapping.value;
        });
        node.parameters.columns.value = simpleColumns;
      }
    }

    // Ensure options exists
    if (!node.parameters.options) {
      node.parameters.options = {};
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
    }

    // If mode is not set, try to infer it
    if (!node.parameters.mode) {
      if (node.parameters.cronExpression) {
        node.parameters.mode = "cronExpression";
      } else if (node.parameters.rule) {
        node.parameters.mode = "everyX";
      }
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

    // Ensure options object exists
    if (!node.parameters.options) {
      node.parameters.options = {};
    }

    // Fix headers format
    if (node.parameters.headerParametersUi?.parameter) {
      if (!Array.isArray(node.parameters.headerParametersUi.parameter)) {
        node.parameters.headerParametersUi.parameter = [
          node.parameters.headerParametersUi.parameter,
        ];
      }
    }

    // Fix query parameters format
    if (node.parameters.queryParametersUi?.parameter) {
      if (!Array.isArray(node.parameters.queryParametersUi.parameter)) {
        node.parameters.queryParametersUi.parameter = [
          node.parameters.queryParametersUi.parameter,
        ];
      }
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
