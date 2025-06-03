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

    // 2. Fix all nodes
    if (fixed.nodes) {
      fixed.nodes.forEach((node) => {
        // Fix Gmail trigger parameters
        if (node.type === "n8n-nodes-base.gmailTrigger") {
          // Convert 'label' to 'labelIds' array
          if (node.parameters?.label && !node.parameters.labelIds) {
            node.parameters.labelIds = [node.parameters.label];
            delete node.parameters.label;
          }
          // Ensure it's an array
          if (
            node.parameters?.labelIds &&
            !Array.isArray(node.parameters.labelIds)
          ) {
            node.parameters.labelIds = [node.parameters.labelIds];
          }
        }

        // Fix Slack node version
        if (node.type === "n8n-nodes-base.slack") {
          if (!node.typeVersion || node.typeVersion < 2) {
            node.typeVersion = 2.2;
          }
        }

        // Fix Schedule Trigger
        if (
          node.type === "n8n-nodes-base.scheduleTrigger" ||
          node.type === "n8n-nodes-base.cron"
        ) {
          this.fixScheduleTrigger(node);
        }

        // Fix IF nodes
        if (node.type === "n8n-nodes-base.if") {
          this.fixIfNode(node);
        }

        // Fix Google Drive triggers
        if (node.type === "n8n-nodes-base.googleDriveTrigger") {
          this.fixGoogleDriveTrigger(node);
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

        // Fix Google Sheets nodes
        if (node.type === "n8n-nodes-base.googleSheets") {
          this.fixGoogleSheetsNode(node);
        }

        // Fix Function nodes
        if (
          node.type === "n8n-nodes-base.function" ||
          node.type === "n8n-nodes-base.functionItem"
        ) {
          this.fixFunctionNode(node);
        }

        // Remove orphaned error handler nodes
        if (node.type === "n8n-nodes-base.errorTrigger") {
          // Check if it's connected
          const isConnected = this.isNodeConnected(
            node.name,
            fixed.connections
          );
          if (!isConnected) {
            // Remove from nodes array
            fixed.nodes = fixed.nodes.filter((n) => n.id !== node.id);
            // Remove from connections
            delete fixed.connections[node.name];
          }
        }
      });
    }

    // 3. Add required fields
    if (!fixed.versionId) {
      fixed.versionId = this.generateVersionId();
    }

    if (!fixed.pinData) {
      fixed.pinData = {};
    }

    if (fixed.staticData === undefined) {
      fixed.staticData = null;
    }

    // 4. Ensure proper settings
    if (!fixed.settings) {
      fixed.settings = {};
    }
    if (!fixed.settings.executionOrder) {
      fixed.settings.executionOrder = "v1";
    }

    // 5. Fix connections structure
    this.fixConnections(fixed);

    return fixed;
  }

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
   * Fix IF node conditions
   */
  fixIfNode(node) {
    if (!node.parameters) node.parameters = {};

    // Handle old format where conditions might be at top level
    if (
      node.parameters.conditions &&
      Array.isArray(node.parameters.conditions)
    ) {
      // Old format - wrap in conditions object
      node.parameters = {
        conditions: {
          conditions: node.parameters.conditions,
        },
      };
    }

    // Ensure conditions object exists
    if (!node.parameters.conditions) {
      node.parameters.conditions = {};
    }

    // Ensure conditions.conditions array exists
    if (!node.parameters.conditions.conditions) {
      node.parameters.conditions.conditions = [];
    }

    // Fix: ensure conditions.conditions is an array
    if (!Array.isArray(node.parameters.conditions.conditions)) {
      node.parameters.conditions.conditions = [
        node.parameters.conditions.conditions,
      ];
    }

    // Ensure each condition has required fields
    node.parameters.conditions.conditions =
      node.parameters.conditions.conditions
        .filter((condition) => condition !== null && condition !== undefined)
        .map((condition) => {
          if (typeof condition === "string") {
            // Convert string to proper condition object
            return {
              leftValue: condition,
              rightValue: "",
              operation: "equal",
            };
          }

          // Ensure condition has all required fields
          return {
            leftValue: condition.leftValue || "",
            rightValue: condition.rightValue || "",
            operation: condition.operation || "equal",
          };
        });

    // Set combineOperation if not set
    if (!node.parameters.combineOperation) {
      node.parameters.combineOperation = "all";
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
   * Fix Google Sheets node
   */
  fixGoogleSheetsNode(node) {
    if (!node.parameters) node.parameters = {};

    // Set default operation if missing
    if (!node.parameters.operation) {
      node.parameters.operation = "append";
    }

    // Fix range format
    if (node.parameters.range && typeof node.parameters.range === "object") {
      node.parameters.range = node.parameters.range.value || "A:Z";
    }

    // Fix options
    if (!node.parameters.options) {
      node.parameters.options = {};
    }

    // Ensure sheetId is string
    if (
      node.parameters.sheetId &&
      typeof node.parameters.sheetId === "number"
    ) {
      node.parameters.sheetId = node.parameters.sheetId.toString();
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
