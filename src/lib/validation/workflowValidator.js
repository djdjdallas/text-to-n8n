// src/lib/validation/workflowValidator.js
import { PLATFORMS, COMPLEXITY_LEVELS } from "@/lib/constants";
import { platformSchemas } from "@/lib/validators/platformSchemas";
import exampleLoader from "@/lib/examples/exampleLoader";

/**
 * Comprehensive workflow validation system
 */
export class WorkflowValidator {
  constructor() {
    this.validators = {
      [PLATFORMS.N8N]: new N8NValidator(),
      [PLATFORMS.ZAPIER]: new ZapierValidator(),
      [PLATFORMS.MAKE]: new MakeValidator(),
    };
    
    // Import the schema directly from the documentation
    this.schemas = {
      [PLATFORMS.N8N]: platformSchemas.n8n.workflow,
      [PLATFORMS.ZAPIER]: platformSchemas.zapier.zap,
      [PLATFORMS.MAKE]: platformSchemas.make.scenario,
    };
    
    // Load examples for validation
    this.examplesLoaded = false;
    this.loadExamples();
  }
  
  async loadExamples() {
    try {
      await exampleLoader.loadExamples();
      this.examplesLoaded = true;
    } catch (error) {
      console.error('Failed to load examples:', error);
    }
  }

  /**
   * Validate workflow for a specific platform
   */
  async validateWorkflow(platform, workflow, options = {}) {
    const validator = this.validators[platform];
    if (!validator) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const startTime = Date.now();

    try {
      // Run platform-specific validation
      const result = await validator.validate(workflow, options);

      // Add validation metadata
      result.validationTime = Date.now() - startTime;
      result.platform = platform;
      result.timestamp = new Date().toISOString();

      return result;
    } catch (error) {
      return {
        isValid: false,
        errors: [
          {
            type: "VALIDATION_ERROR",
            message: error.message,
            severity: "critical",
          },
        ],
        warnings: [],
        suggestions: [],
        score: 0,
        validationTime: Date.now() - startTime,
        platform,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Quick validation check
   */
  quickValidate(platform, workflow) {
    const validator = this.validators[platform];
    if (!validator) return false;

    try {
      return validator.quickValidate(workflow);
    } catch {
      return false;
    }
  }
}

/**
 * Base validator class
 */
class BaseValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.suggestions = [];
  }

  /**
   * Main validation method to be implemented by platform validators
   */
  async validate(workflow, options) {
    // Reset state
    this.errors = [];
    this.warnings = [];
    this.suggestions = [];

    // Schema validation
    const schemaValid = this.validateSchema(workflow);
    if (!schemaValid) {
      return this.buildResult(false);
    }

    // Structure validation
    this.validateStructure(workflow);

    // Logic validation
    this.validateLogic(workflow);
    
    // Example-based validation
    await this.validateAgainstExamples(workflow);

    // Options-based validation
    if (options.errorHandling) {
      this.validateErrorHandling(workflow);
    }

    if (options.requiredApps?.length > 0) {
      this.validateRequiredApps(workflow, options.requiredApps);
    }

    if (options.complexity) {
      this.validateComplexity(workflow, options.complexity);
    }

    // Calculate score
    const score = this.calculateScore(workflow);

    return this.buildResult(this.errors.length === 0, score);
  }

  /**
   * Quick validation without detailed checks
   */
  quickValidate(workflow) {
    try {
      return this.validateSchema(workflow);
    } catch {
      return false;
    }
  }
  validateBinaryOperations(workflow) {
    const binaryReferences = [];

    workflow.nodes.forEach((node) => {
      const nodeString = JSON.stringify(node);
      if (nodeString.includes("$binary")) {
        // Check if there's a node that provides this binary data
        const hasBinarySource = workflow.nodes.some(
          (n) =>
            n.type.includes("gmail") &&
            n.parameters?.operation === "getAttachment"
        );

        if (!hasBinarySource) {
          this.addError(
            "MISSING_BINARY_SOURCE",
            `Node ${node.name} references binary data but no attachment download found`
          );
        }
      }
    });
  }

  /**
   * Build validation result
   */
  buildResult(isValid, score = null) {
    return {
      isValid,
      errors: this.errors,
      warnings: this.warnings,
      suggestions: this.suggestions,
      score: score || (isValid ? this.calculateBasicScore() : 0),
    };
  }

  /**
   * Add error
   */
  addError(type, message, details = null, severity = "error") {
    this.errors.push({
      type,
      message,
      details,
      severity,
    });
  }

  /**
   * Add warning
   */
  addWarning(type, message, details = null) {
    this.warnings.push({
      type,
      message,
      details,
    });
  }

  /**
   * Add suggestion
   */
  addSuggestion(message, improvement = null) {
    this.suggestions.push({
      message,
      improvement,
    });
  }

  /**
   * Calculate basic score based on errors and warnings
   */
  calculateBasicScore() {
    let score = 100;
    score -= this.errors.length * 10;
    score -= this.warnings.length * 5;
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Validate workflow against examples
   */
  async validateAgainstExamples(workflow) {
    // To be implemented by specific validators
  }
}

/**
 * n8n specific validator
 */
class N8NValidator extends BaseValidator {
  validateSchema(workflow) {
    const schema = platformSchemas.n8n.workflow;
    
    // Check required fields from schema
    if (schema.required) {
      for (const field of schema.required) {
        if (!workflow[field]) {
          this.addError(
            "MISSING_FIELD",
            `Missing required field: ${field}`,
            { field },
            "critical"
          );
          return false;
        }
      }
    }

    // Validate nodes array using schema definition
    if (!Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
      this.addError("INVALID_NODES", "Nodes must be a non-empty array");
      return false;
    }

    // Validate node items against schema
    for (const node of workflow.nodes) {
      if (schema.definitions?.node?.required) {
        for (const requiredProp of schema.definitions.node.required) {
          if (!node[requiredProp]) {
            this.addError(
              "INVALID_NODE_STRUCTURE",
              `Node missing required property: ${requiredProp}`,
              { node: node.name || "unnamed" }
            );
            return false;
          }
        }
      }
    }

    // Validate connections object
    if (
      typeof workflow.connections !== "object" ||
      workflow.connections === null
    ) {
      this.addError("INVALID_CONNECTIONS", "Connections must be an object");
      return false;
    }

    return true;
  }

  validateStructure(workflow) {
    const nodeMap = new Map();
    const nodeNames = new Set();

    // Validate each node
    workflow.nodes.forEach((node, index) => {
      // Check required node fields
      if (!node.id || !node.name || !node.type) {
        this.addError(
          "INVALID_NODE",
          `Node at index ${index} missing required fields`,
          { node, index }
        );
        return;
      }

      // Check for duplicate names
      if (nodeNames.has(node.name)) {
        this.addError(
          "DUPLICATE_NODE_NAME",
          `Duplicate node name: ${node.name}`,
          { name: node.name }
        );
      }
      nodeNames.add(node.name);
      nodeMap.set(node.name, node);

      // Validate position
      if (!Array.isArray(node.position) || node.position.length !== 2) {
        this.addWarning(
          "INVALID_POSITION",
          `Node ${node.name} has invalid position`,
          { node: node.name, position: node.position }
        );
      }

      // Validate node type
      this.validateNodeType(node);

      // Validate parameters based on node type
      this.validateNodeParameters(node);
    });

    // Validate connections
    this.validateConnections(workflow.connections, nodeMap);
  }

  /**
   * Fix Set node parameters
   */
  fixSetNode(node) {
    if (!node.parameters) node.parameters = {};
    
    // Remove invalid options field
    if (node.parameters.options) {
      delete node.parameters.options;
    }
    
    // Ensure typeVersion is 1
    if (node.typeVersion !== 1) {
      node.typeVersion = 1;
    }
    
    // Ensure values structure exists
    if (!node.parameters.values) {
      node.parameters.values = { string: [] };
    }
  }

  validateNodeType(node) {
    // Common n8n node patterns
    const validNodePatterns = [
      /^n8n-nodes-base\./,
      /^n8n-nodes-/,
      /^@[^/]+\/n8n-nodes-/,
    ];

    const isValidType = validNodePatterns.some((pattern) =>
      pattern.test(node.type)
    );

    if (!isValidType) {
      this.addWarning("UNKNOWN_NODE_TYPE", `Unknown node type: ${node.type}`, {
        node: node.name,
        type: node.type,
      });
    }

    // Check for common node types
    const commonTypes = [
      "n8n-nodes-base.webhook",
      "n8n-nodes-base.httpRequest",
      "n8n-nodes-base.set",
      "n8n-nodes-base.if",
      "n8n-nodes-base.merge",
      "n8n-nodes-base.code",
    ];

    if (commonTypes.includes(node.type) && !node.typeVersion) {
      this.addWarning(
        "MISSING_TYPE_VERSION",
        `Node ${node.name} should have typeVersion`,
        { node: node.name }
      );
    }
    
    // NEW: Warn about inappropriate node usage
    if (node.type === "n8n-nodes-base.emailSend") {
      // Check if it's actually sending an email
      if (!node.parameters?.toEmail || !node.parameters?.subject) {
        this.addWarning(
          "INAPPROPRIATE_NODE_TYPE",
          `EmailSend node "${node.name}" used without email parameters. Consider using Set node instead.`,
          { node: node.name }
        );
      }
    }
    
    if (node.type === "n8n-nodes-base.noOp") {
      this.addWarning(
        "UNNECESSARY_NODE",
        `NoOp node "${node.name}" does nothing. Consider removing it.`,
        { node: node.name }
      );
    }
    
    // Check for simple conditions that should use Switch instead of IF
    if (node.type === "n8n-nodes-base.if" && 
        node.parameters?.conditions?.conditions?.length === 1) {
      this.addWarning(
        "SUBOPTIMAL_NODE_CHOICE",
        `IF node "${node.name}" has only one condition. Consider using Switch node for better performance.`,
        { node: node.name }
      );
    }
    
    // Check for function nodes that just create simple data structures
    if ((node.type === "n8n-nodes-base.function" || node.type === "n8n-nodes-base.functionItem") && 
        node.parameters?.functionCode) {
      const code = node.parameters.functionCode;
      const simpleReturnStructure = code.includes("return {") && !code.includes("if") && !code.includes("for");
      
      if (simpleReturnStructure) {
        this.addWarning(
          "SUBOPTIMAL_NODE_CHOICE",
          `Function node "${node.name}" only creates a simple data structure. Consider using Set node instead.`,
          { node: node.name }
        );
      }
    }
    
    // Check for Set node issues
    if (node.type === "n8n-nodes-base.set") {
      this.fixSetNode(node);
      
      if (node.parameters?.options) {
        this.addWarning(
          "INVALID_SET_NODE_OPTIONS",
          `Set node "${node.name}" has options field which should be removed`,
          { node: node.name }
        );
      }
      
      if (node.typeVersion !== 1) {
        this.addWarning(
          "INCORRECT_SET_NODE_VERSION",
          `Set node "${node.name}" should have typeVersion 1`,
          { node: node.name }
        );
      }
    }
    
    // Check for non-standard fields
    if (node.type === "n8n-nodes-base.webhook") {
      const standardNodeFields = ['id', 'name', 'type', 'typeVersion', 'position', 'parameters', 'credentials'];
      Object.keys(node).forEach(field => {
        if (!standardNodeFields.includes(field)) {
          if (field === "webhookId") {
            this.addError(
              "NON_STANDARD_FIELD",
              `Webhook node has non-standard field: ${field}`,
              { node: node.name, field }
            );
          } else {
            this.addWarning(
              "NON_STANDARD_FIELD",
              `Webhook node has unexpected field: ${field}`,
              { node: node.name, field }
            );
          }
        }
      });
    }
  }

  validateNodeParameters(node) {
    // Validate based on common node types
    if (node.type === "n8n-nodes-base.httpRequest") {
      if (
        !node.parameters?.url &&
        !node.parameters?.requestMethod &&
        !node.parameters?.options
      ) {
        this.addWarning(
          "MISSING_HTTP_CONFIG",
          `HTTP Request node ${node.name} missing configuration`,
          { node: node.name }
        );
      }
      
      // Check for nested queryParameters structure
      if (node.parameters?.queryParameters?.parameters) {
        this.addError(
          "INVALID_QUERYPARAMS_STRUCTURE",
          `HTTP Request node ${node.name} has nested parameters in queryParameters`,
          { node: node.name }
        );
      }
    }

    if (node.type === "n8n-nodes-base.if") {
      if (!node.parameters?.conditions) {
        this.addError(
          "MISSING_IF_CONDITIONS",
          `IF node ${node.name} missing conditions`,
          { node: node.name }
        );
      } else {
        // Validate IF node conditions structure
        this.validateIfConditions(node);
      }
    }
    
    // Check Slack node for format issues
    if (node.type === "n8n-nodes-base.slack") {
      this.validateSlackNode(node);
    }
    
    // Check Google Sheets node
    if (node.type === "n8n-nodes-base.googleSheets") {
      this.validateGoogleSheetsNode(node);
    }
    
    // Check Set node
    if (node.type === "n8n-nodes-base.set") {
      this.validateSetNode(node);
    }
    
    // Check OpenAI node
    if (node.type === "n8n-nodes-base.openAi") {
      this.validateOpenAINode(node);
    }
    
    // Check for expression syntax
    this.validateExpressions(node);
  }
  
  /**
   * Validate IF node conditions structure and formats
   */
  validateIfConditions(node) {
    // Skip if conditions don't exist
    if (!node.parameters?.conditions?.conditions) {
      return;
    }
    
    // Check if "number" field exists (invalid)
    if (node.parameters.conditions.number !== undefined) {
      this.addError(
        "INVALID_IF_CONDITIONS",
        `IF node ${node.name} has invalid 'number' field in conditions`,
        { node: node.name }
      );
    }
    
    // Check individual conditions
    node.parameters.conditions.conditions.forEach((condition, index) => {
      // Check for complex expressions using JavaScript methods
      if (typeof condition.leftValue === 'string' && 
          condition.leftValue.includes('.includes(') && 
          condition.operation === 'equal') {
        this.addError(
          "COMPLEX_EXPRESSION",
          `IF node ${node.name} uses complex JavaScript method. Use 'contains' operation instead.`,
          { node: node.name, condition: index }
        );
      }
      
      // Check for comparison to boolean true in complex expression
      if (condition.rightValue === '{{true}}' || condition.rightValue === true) {
        if (typeof condition.leftValue === 'string' && 
            (condition.leftValue.includes('>') || condition.leftValue.includes('<'))) {
          this.addError(
            "COMPLEX_COMPARISON",
            `IF node ${node.name} has complex comparison. Use direct comparison operations.`,
            { node: node.name, condition: index }
          );
        }
      }
    });
  }
  
  /**
   * Validate Slack node format
   */
  validateSlackNode(node) {
    // Check for required type version
    if (!node.typeVersion || node.typeVersion < 2) {
      this.addWarning(
        "OUTDATED_SLACK_VERSION",
        `Slack node ${node.name} should use typeVersion 2.2 or higher`,
        { node: node.name }
      );
    }
    
    // Check for otherOptions field which causes issues in newer n8n versions
    if (node.parameters?.otherOptions) {
      this.addWarning(
        "DEPRECATED_SLACK_OPTIONS",
        `Slack node ${node.name} has otherOptions field which may cause issues in newer n8n versions`,
        { node: node.name }
      );
    }
    
    // Check for equal sign prefix in text field
    if (typeof node.parameters?.text === 'string' && node.parameters.text.startsWith('=')) {
      this.addError(
        "INVALID_TEXT_FORMAT",
        `Slack node ${node.name} has text field with = prefix which will cause errors`,
        { node: node.name }
      );
    }
    
    // Check for channel format
    if (node.parameters?.channel) {
      if (node.parameters.channel.startsWith('=#')) {
        this.addError(
          "INVALID_CHANNEL_FORMAT",
          `Slack node ${node.name} has invalid channel format with "=#" prefix`,
          { node: node.name }
        );
      }
      
      if (node.parameters.channel === '={{$json.slackChannel}}' && !node.parameters.channel.startsWith('#')) {
        this.addWarning(
          "MISSING_CHANNEL_PREFIX",
          `Slack node ${node.name} dynamic channel reference may need # prefix`,
          { node: node.name }
        );
      }
    }
  }
  
  /**
   * Validate Google Sheets node format
   */
  validateGoogleSheetsNode(node) {
    // Check for options field
    if (node.parameters?.options) {
      this.addError(
        "INVALID_GOOGLESHEETS_OPTIONS",
        `Google Sheets node ${node.name} has options field which causes import errors`,
        { node: node.name }
      );
    }
    
    // Check for valueInputMode parameter
    if (node.parameters?.valueInputMode) {
      this.addError(
        "INVALID_GOOGLESHEETS_PARAM",
        `Google Sheets node ${node.name} has invalid valueInputMode parameter`,
        { node: node.name }
      );
    }
    
    // Check for complex reference object format that needs simplification
    if (node.parameters?.documentId && typeof node.parameters.documentId === 'object') {
      this.addError(
        "COMPLEX_GOOGLESHEETS_REF",
        `Google Sheets node ${node.name} has complex documentId reference that needs simplification`,
        { node: node.name }
      );
    }
  }
  
  /**
   * Validate Set node format
   */
  validateSetNode(node) {
    // Check for options field
    if (node.parameters?.options) {
      this.addError(
        "INVALID_SET_OPTIONS",
        `Set node ${node.name} has options field which should be removed`,
        { node: node.name }
      );
    }
    
    // Check for keepOnlySet parameter
    if (node.parameters?.keepOnlySet !== undefined) {
      this.addError(
        "INVALID_SET_PARAM",
        `Set node ${node.name} has keepOnlySet parameter which causes import issues`,
        { node: node.name }
      );
    }
    
    // Check for improper typeVersion
    if (node.typeVersion !== 1) {
      this.addWarning(
        "INCORRECT_SET_VERSION",
        `Set node ${node.name} should have typeVersion 1`,
        { node: node.name }
      );
    }
  }
  
  /**
   * Validate OpenAI node format
   */
  validateOpenAINode(node) {
    // Check for options field with model parameters that should be at root
    if (node.parameters?.options) {
      const criticalParams = ['model', 'temperature', 'maxTokens', 'max_tokens'];
      let hasCriticalParams = false;
      
      criticalParams.forEach(param => {
        if (node.parameters.options[param] !== undefined) {
          hasCriticalParams = true;
          this.addError(
            "INVALID_OPENAI_STRUCTURE",
            `OpenAI node ${node.name} has ${param} in options object instead of at root level`,
            { node: node.name, param }
          );
        }
      });
      
      if (hasCriticalParams) {
        this.addSuggestion(
          `Move OpenAI parameters out of options object to root level in node ${node.name}`
        );
      }
    }
  }

  validateExpressions(node) {
    const expressionPattern = /\{\{([^}]+)\}\}/g;
    const nodeRefPattern = /\$node\["([^"]+)"\]/g;

    const checkExpressions = (obj, path = "") => {
      if (typeof obj === "string") {
        const matches = obj.match(expressionPattern);
        if (matches) {
          matches.forEach((match) => {
            const nodeRefs = match.match(nodeRefPattern);
            if (nodeRefs) {
              nodeRefs.forEach((ref) => {
                const nodeName = ref.match(/\$node\["([^"]+)"\]/)?.[1];
                if (nodeName && !this.nodeExists(nodeName)) {
                  this.addError(
                    "INVALID_NODE_REFERENCE",
                    `Expression references non-existent node: ${nodeName}`,
                    { node: node.name, expression: match, path }
                  );
                }
              });
            }
          });
        }
      } else if (typeof obj === "object" && obj !== null) {
        Object.entries(obj).forEach(([key, value]) => {
          checkExpressions(value, path ? `${path}.${key}` : key);
        });
      }
    };

    if (node.parameters) {
      checkExpressions(node.parameters, "parameters");
    }
  }

  validateConnections(connections, nodeMap) {
    // Check each connection
    Object.entries(connections).forEach(([sourceName, outputs]) => {
      if (!nodeMap.has(sourceName)) {
        this.addError(
          "INVALID_CONNECTION_SOURCE",
          `Connection from non-existent node: ${sourceName}`,
          { source: sourceName }
        );
        return;
      }

      if (!outputs.main || !Array.isArray(outputs.main)) {
        this.addError(
          "INVALID_CONNECTION_FORMAT",
          `Invalid connection format for node: ${sourceName}`,
          { source: sourceName }
        );
        return;
      }

      outputs.main.forEach((output, outputIndex) => {
        if (!Array.isArray(output)) {
          this.addError(
            "INVALID_OUTPUT_FORMAT",
            `Invalid output format for ${sourceName}[${outputIndex}]`
          );
          return;
        }

        output.forEach((connection) => {
          if (!connection.node || !nodeMap.has(connection.node)) {
            this.addError(
              "INVALID_CONNECTION_TARGET",
              `Connection to non-existent node: ${connection.node}`,
              { source: sourceName, target: connection.node }
            );
          }
        });
      });
    });

    // Check for orphaned nodes
    const connectedNodes = new Set();
    connectedNodes.add(Object.keys(connections)[0]); // First node (trigger)

    Object.values(connections).forEach((outputs) => {
      outputs.main?.forEach((output) => {
        output?.forEach((conn) => {
          if (conn.node) connectedNodes.add(conn.node);
        });
      });
    });

    nodeMap.forEach((node, name) => {
      if (!connectedNodes.has(name) && nodeMap.size > 1) {
        this.addWarning("ORPHANED_NODE", `Node ${name} is not connected`, {
          node: name,
        });
      }
    });
  }

  validateLogic(workflow) {
    // Check for loops
    this.detectLoops(workflow);

    // Check for trigger node
    const triggerNodes = workflow.nodes.filter(
      (node) =>
        node.type.includes("trigger") ||
        node.type.includes("webhook") ||
        node.type === "n8n-nodes-base.start"
    );

    if (triggerNodes.length === 0) {
      this.addWarning(
        "NO_TRIGGER",
        "Workflow has no obvious trigger node",
        null
      );
      this.addSuggestion(
        "Add a trigger node to start the workflow automatically"
      );
    } else if (triggerNodes.length > 1) {
      this.addWarning(
        "MULTIPLE_TRIGGERS",
        "Workflow has multiple trigger nodes",
        { count: triggerNodes.length }
      );
    }
  }

  validateErrorHandling(workflow) {
    const errorHandlingNodes = workflow.nodes.filter(
      (node) =>
        node.type.includes("errorTrigger") ||
        node.type.includes("catch") ||
        node.parameters?.continueOnFail === true
    );

    if (errorHandlingNodes.length === 0) {
      this.addWarning(
        "NO_ERROR_HANDLING",
        "Workflow has no error handling",
        null
      );
      this.addSuggestion(
        "Add error handling nodes or enable 'Continue On Fail' for critical nodes"
      );
    }
  }

  validateRequiredApps(workflow, requiredApps) {
    const foundApps = new Set();

    workflow.nodes.forEach((node) => {
      requiredApps.forEach((app) => {
        if (node.type.toLowerCase().includes(app.toLowerCase())) {
          foundApps.add(app);
        }
      });
    });

    const missingApps = requiredApps.filter((app) => !foundApps.has(app));
    if (missingApps.length > 0) {
      this.addWarning(
        "MISSING_REQUIRED_APPS",
        `Workflow missing expected apps: ${missingApps.join(", ")}`,
        { missing: missingApps }
      );
    }
  }

  validateComplexity(workflow, expectedComplexity) {
    const actualComplexity = this.assessComplexity(workflow);

    if (
      expectedComplexity === COMPLEXITY_LEVELS.SIMPLE &&
      actualComplexity > 30
    ) {
      this.addWarning(
        "COMPLEXITY_MISMATCH",
        "Workflow is more complex than expected for 'simple' level",
        { expected: expectedComplexity, actual: actualComplexity }
      );
    }

    if (
      expectedComplexity === COMPLEXITY_LEVELS.COMPLEX &&
      actualComplexity < 50
    ) {
      this.addSuggestion(
        "Consider adding more advanced features like loops, error handling, or conditional logic"
      );
    }
  }

  assessComplexity(workflow) {
    let score = 0;

    // Base complexity from node count
    score += workflow.nodes.length * 5;

    // Conditional nodes
    const conditionalNodes = workflow.nodes.filter(
      (n) =>
        n.type.includes("if") ||
        n.type.includes("switch") ||
        n.type.includes("router")
    );
    score += conditionalNodes.length * 10;

    // Loop nodes
    const loopNodes = workflow.nodes.filter(
      (n) => n.type.includes("loop") || n.type.includes("splitInBatches")
    );
    score += loopNodes.length * 15;

    // Code nodes (custom logic)
    const codeNodes = workflow.nodes.filter(
      (n) => n.type.includes("code") || n.type.includes("function")
    );
    score += codeNodes.length * 8;

    // Connection complexity
    const totalConnections = Object.values(workflow.connections).reduce(
      (sum, outputs) => {
        return (
          sum + (outputs.main?.reduce((s, o) => s + (o?.length || 0), 0) || 0)
        );
      },
      0
    );
    score += Math.floor(totalConnections * 2);

    return Math.min(100, score);
  }

  detectLoops(workflow) {
    const graph = this.buildGraph(workflow);
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (node, path = []) => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor, [...path])) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          this.addWarning(
            "POTENTIAL_LOOP",
            `Potential infinite loop detected`,
            { path: [...path, neighbor].join(" -> ") }
          );
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    // Check each component
    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        hasCycle(node);
      }
    }
  }

  buildGraph(workflow) {
    const graph = new Map();

    // Initialize nodes
    workflow.nodes.forEach((node) => {
      graph.set(node.name, []);
    });

    // Build edges
    Object.entries(workflow.connections).forEach(([source, outputs]) => {
      const targets = [];
      outputs.main?.forEach((output) => {
        output?.forEach((conn) => {
          if (conn.node) targets.push(conn.node);
        });
      });
      graph.set(source, targets);
    });

    return graph;
  }

  nodeExists(nodeName) {
    // This is called during validation, so we need access to the current workflow
    // In a real implementation, this would be stored as instance state
    return true; // Simplified for this example
  }

  calculateScore(workflow) {
    let score = 100;

    // Deduct for errors
    score -= this.errors.filter((e) => e.severity === "critical").length * 20;
    score -= this.errors.filter((e) => e.severity === "error").length * 10;
    score -= this.warnings.length * 5;

    // Bonus for good practices
    if (workflow.nodes.some((n) => n.parameters?.continueOnFail)) {
      score += 5; // Error handling
    }

    if (workflow.settings?.executionOrder === "v1") {
      score += 3; // Using newer execution order
    }

    // Complexity bonus/penalty
    const complexity = this.assessComplexity(workflow);
    if (complexity > 20 && complexity < 80) {
      score += 5; // Well-balanced complexity
    }

    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Validate workflow against examples
   */
  async validateAgainstExamples(workflow) {
    try {
      // Get relevant examples for this workflow
      const relevantExamples = await exampleLoader.getRelevantExamples(workflow);
      
      if (relevantExamples.length === 0) return;
      
      // Check for node parameter structure matches
      this.validateNodeParameterStructures(workflow, relevantExamples);
      
      // Check for connection patterns
      this.validateConnectionPatterns(workflow, relevantExamples);
      
      // Check for missing best practices
      this.suggestBestPractices(workflow, relevantExamples);
      
    } catch (error) {
      console.error('Error validating against examples:', error);
    }
  }
  
  validateNodeParameterStructures(workflow, examples) {
    for (const node of workflow.nodes) {
      // Find examples with the same node type
      const nodeExamples = examples.filter(example => 
        example.nodes?.some(exampleNode => exampleNode.type === node.type)
      );
      
      if (nodeExamples.length === 0) continue;
      
      // Get the reference node from examples
      const referenceNode = nodeExamples[0].nodes.find(n => n.type === node.type);
      
      // Check for common parameter structure issues
      this.validateParameterStructure(node, referenceNode);
    }
  }
  
  validateParameterStructure(node, referenceNode) {
    if (!node.parameters || !referenceNode.parameters) return;
    
    // Check if node has deprecated or invalid parameter structures
    const nodeParams = JSON.stringify(node.parameters);
    const refParams = JSON.stringify(referenceNode.parameters);
    
    // Check for nested parameter issues (common in HTTP Request nodes)
    if (node.type === 'n8n-nodes-base.httpRequest') {
      if (node.parameters.queryParameters?.parameters && 
          !referenceNode.parameters.queryParameters?.parameters) {
        this.addError(
          'NESTED_QUERY_PARAMS',
          `HTTP Request node ${node.name} has nested queryParameters structure which causes errors`,
          { node: node.name }
        );
      }
    }
    
    // Check Set node structure
    if (node.type === 'n8n-nodes-base.set') {
      if (node.parameters.options && !referenceNode.parameters.options) {
        this.addError(
          'INVALID_SET_STRUCTURE',
          `Set node ${node.name} has 'options' field which should be removed`,
          { node: node.name }
        );
      }
      
      if (node.parameters.keepOnlySet !== undefined && 
          referenceNode.parameters.keepOnlySet === undefined) {
        this.addError(
          'INVALID_SET_PARAM',
          `Set node ${node.name} has 'keepOnlySet' parameter which causes import issues`,
          { node: node.name }
        );
      }
    }
    
    // Check Google Sheets node
    if (node.type === 'n8n-nodes-base.googleSheets') {
      if (node.parameters.options && !referenceNode.parameters.options) {
        this.addError(
          'INVALID_SHEETS_STRUCTURE',
          `Google Sheets node ${node.name} has 'options' field which causes import errors`,
          { node: node.name }
        );
      }
    }
    
    // Check OpenAI node structure
    if (node.type === '@n8n/n8n-nodes-langchain.openAi') {
      const criticalParams = ['model', 'temperature', 'maxTokens'];
      
      criticalParams.forEach(param => {
        const nodeHasInOptions = node.parameters.options?.[param] !== undefined;
        const refHasAtRoot = referenceNode.parameters[param] !== undefined;
        
        if (nodeHasInOptions && refHasAtRoot) {
          this.addError(
            'INCORRECT_OPENAI_STRUCTURE',
            `OpenAI node ${node.name} has '${param}' in options instead of root level`,
            { node: node.name, param }
          );
        }
      });
    }
  }
  
  validateConnectionPatterns(workflow, examples) {
    // Check if workflow follows common connection patterns
    const workflowNodeTypes = workflow.nodes.map(n => n.type);
    
    for (const example of examples) {
      const exampleNodeTypes = example.nodes?.map(n => n.type) || [];
      
      // Check if it's a common pair pattern
      if (exampleNodeTypes.length === 2 && workflowNodeTypes.length === 2) {
        const hasMatchingPair = exampleNodeTypes.every(type => workflowNodeTypes.includes(type));
        
        if (hasMatchingPair) {
          // Validate connection structure matches example
          this.validatePairConnectionStructure(workflow, example);
        }
      }
    }
  }
  
  validatePairConnectionStructure(workflow, example) {
    const workflowConnections = workflow.connections;
    const exampleConnections = example.connections;
    
    // Check if connections follow the expected pattern
    const exampleSourceNames = Object.keys(exampleConnections);
    const workflowSourceNames = Object.keys(workflowConnections);
    
    if (exampleSourceNames.length === 1 && workflowSourceNames.length === 0) {
      this.addWarning(
        'MISSING_CONNECTIONS',
        'Workflow nodes are not connected. Expected connection pattern found in examples.',
        { expectedPattern: 'node1 -> node2' }
      );
    }
  }
  
  suggestBestPractices(workflow, examples) {
    // Suggest improvements based on examples
    const workflowNodeTypes = workflow.nodes.map(n => n.type);
    
    // Check for error handling patterns
    const hasErrorHandling = workflow.nodes.some(n => n.continueOnFail);
    const exampleHasErrorHandling = examples.some(ex => 
      ex.nodes?.some(n => n.continueOnFail)
    );
    
    if (!hasErrorHandling && exampleHasErrorHandling) {
      this.addSuggestion(
        'Consider adding error handling (continueOnFail) to critical nodes, as shown in similar examples'
      );
    }
    
    // Check for missing IF nodes in conditional workflows
    const hasConditional = workflowNodeTypes.some(t => t.includes('if') || t.includes('switch'));
    const exampleHasConditional = examples.some(ex => 
      ex.nodes?.some(n => n.type.includes('if') || n.type.includes('switch'))
    );
    
    if (!hasConditional && exampleHasConditional && workflow.nodes.length > 2) {
      this.addSuggestion(
        'Consider adding conditional logic (IF/Switch nodes) for better workflow control, as shown in similar examples'
      );
    }
    
    // Check for data validation patterns
    const hasValidation = workflowNodeTypes.some(t => t.includes('code')) && 
      workflow.nodes.some(n => JSON.stringify(n.parameters).includes('validate'));
    const exampleHasValidation = examples.some(ex => 
      ex.nodes?.some(n => n.type.includes('code') && JSON.stringify(n.parameters).includes('validate'))
    );
    
    if (!hasValidation && exampleHasValidation) {
      this.addSuggestion(
        'Consider adding data validation steps as shown in similar workflow examples'
      );
    }
  }
}

/**
 * Zapier specific validator
 */
class ZapierValidator extends BaseValidator {
  validateSchema(workflow) {
    if (!workflow.trigger || typeof workflow.trigger !== "object") {
      this.addError(
        "MISSING_TRIGGER",
        "Zapier workflow must have a trigger",
        null,
        "critical"
      );
      return false;
    }

    if (!Array.isArray(workflow.actions)) {
      this.addError(
        "MISSING_ACTIONS",
        "Zapier workflow must have actions array",
        null,
        "critical"
      );
      return false;
    }

    return true;
  }

  validateStructure(workflow) {
    // Validate trigger
    if (!workflow.trigger.app || !workflow.trigger.event) {
      this.addError(
        "INVALID_TRIGGER",
        "Trigger must have app and event",
        workflow.trigger
      );
    }

    // Validate actions
    workflow.actions.forEach((action, index) => {
      if (!action.app || !action.action) {
        this.addError(
          "INVALID_ACTION",
          `Action ${index} must have app and action`,
          { action, index }
        );
      }

      // Validate field mappings
      this.validateFieldMappings(action, index);
    });
  }

  validateFieldMappings(action, index) {
    const mappingPattern = /\{\{([^}]+)\}\}/g;

    const checkMappings = (obj, path = "") => {
      if (typeof obj === "string") {
        const matches = obj.match(mappingPattern);
        if (matches) {
          matches.forEach((match) => {
            const field = match.slice(2, -2).trim();
            if (!field.includes(".")) {
              this.addWarning(
                "INVALID_MAPPING",
                `Invalid field mapping in action ${index}: ${match}`,
                { action: index, field, path }
              );
            }
          });
        }
      } else if (typeof obj === "object" && obj !== null) {
        Object.entries(obj).forEach(([key, value]) => {
          checkMappings(value, path ? `${path}.${key}` : key);
        });
      }
    };

    if (action.input) {
      checkMappings(action.input);
    }
  }

  validateLogic(workflow) {
    // Check for filters
    const hasFilters = workflow.actions.some((a) => a.conditions?.length > 0);
    if (!hasFilters && workflow.actions.length > 2) {
      this.addSuggestion(
        "Consider adding filters to prevent unnecessary action executions"
      );
    }
  }

  validateErrorHandling(workflow) {
    const hasErrorHandling = workflow.actions.some(
      (a) => a.errorHandler || a.continueOnError
    );

    if (!hasErrorHandling) {
      this.addWarning("NO_ERROR_HANDLING", "No error handling configured");
      this.addSuggestion(
        "Enable error handling for critical actions to prevent workflow failures"
      );
    }
  }

  calculateScore(workflow) {
    let score = 100;

    // Basic scoring
    score -= this.errors.length * 15;
    score -= this.warnings.length * 5;

    // Bonus for best practices
    if (workflow.actions.some((a) => a.conditions?.length > 0)) {
      score += 5; // Using filters
    }

    if (workflow.actions.some((a) => a.errorHandler)) {
      score += 5; // Error handling
    }

    return Math.max(0, Math.min(100, score));
  }
}

/**
 * Make (Integromat) specific validator
 */
class MakeValidator extends BaseValidator {
  validateSchema(workflow) {
    if (!Array.isArray(workflow.modules) || workflow.modules.length === 0) {
      this.addError(
        "MISSING_MODULES",
        "Make scenario must have modules array",
        null,
        "critical"
      );
      return false;
    }

    return true;
  }

  validateStructure(workflow) {
    const moduleIds = new Set();

    // Validate modules
    workflow.modules.forEach((module, index) => {
      if (
        typeof module.id !== "number" ||
        !module.module ||
        typeof module.version !== "number"
      ) {
        this.addError(
          "INVALID_MODULE",
          `Module ${index} missing required fields`,
          { module, index }
        );
      }

      // Check for duplicate IDs
      if (moduleIds.has(module.id)) {
        this.addError(
          "DUPLICATE_MODULE_ID",
          `Duplicate module ID: ${module.id}`
        );
      }
      moduleIds.add(module.id);

      // Validate data mappings
      this.validateDataMappings(module);
    });

    // Validate routes if present
    if (workflow.routes) {
      this.validateRoutes(workflow.routes, moduleIds);
    }
  }

  validateDataMappings(module) {
    if (!module.mapper) return;

    const mappingPattern = /\{\{(\d+)\.([^}]+)\}\}/g;

    const checkMappings = (obj) => {
      if (typeof obj === "string") {
        const matches = obj.match(mappingPattern);
        if (matches) {
          matches.forEach((match) => {
            const [, moduleId] = match.match(/\{\{(\d+)\./) || [];
            if (moduleId && parseInt(moduleId) >= module.id) {
              this.addWarning(
                "FORWARD_REFERENCE",
                `Module ${module.id} references future module ${moduleId}`,
                { module: module.id, reference: moduleId }
              );
            }
          });
        }
      } else if (typeof obj === "object" && obj !== null) {
        Object.values(obj).forEach(checkMappings);
      }
    };

    checkMappings(module.mapper);
  }

  validateRoutes(routes, moduleIds) {
    routes.forEach((route, index) => {
      if (!Array.isArray(route.flow)) {
        this.addError("INVALID_ROUTE", `Route ${index} must have flow array`, {
          route,
          index,
        });
        return;
      }

      route.flow.forEach((moduleId) => {
        if (!moduleIds.has(moduleId)) {
          this.addError(
            "INVALID_ROUTE_MODULE",
            `Route ${index} references non-existent module ${moduleId}`
          );
        }
      });
    });
  }

  validateLogic(workflow) {
    // Check for routers and aggregators
    const hasRouters = workflow.modules.some((m) =>
      m.module.includes("router")
    );
    const hasAggregators = workflow.modules.some((m) =>
      m.module.includes("aggregator")
    );

    if (workflow.modules.length > 5 && !hasRouters) {
      this.addSuggestion(
        "Consider using routers for complex scenarios with multiple paths"
      );
    }

    if (
      workflow.modules.some((m) => m.module.includes("iterator")) &&
      !hasAggregators
    ) {
      this.addSuggestion(
        "Consider using aggregators to collect results from iterators"
      );
    }
  }

  calculateScore(workflow) {
    let score = 100;

    score -= this.errors.length * 15;
    score -= this.warnings.length * 5;

    // Bonus for advanced features
    if (workflow.modules.some((m) => m.module.includes("router"))) {
      score += 5;
    }

    if (workflow.routes?.length > 0) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }
}

// Export singleton instance
export const workflowValidator = new WorkflowValidator();
