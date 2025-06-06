import { anthropicClient } from '../ai/anthropicClient.js';
import { platformTemplates } from '../prompts/platformTemplates.js';
import crypto from 'crypto';

// Validation cache with TTL
class ValidationCache {
  constructor(ttlMinutes = 60, maxSize = 100) {
    this.cache = new Map();
    this.ttl = ttlMinutes * 60 * 1000; // Convert to milliseconds
    this.maxSize = maxSize;
    this.hits = 0;
    this.misses = 0;
  }

  generateKey(workflow) {
    // Create a deterministic hash of the workflow structure
    const normalized = JSON.stringify(workflow, Object.keys(workflow).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  get(workflow) {
    const key = this.generateKey(workflow);
    const cached = this.cache.get(key);
    
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.ttl) {
        this.hits++;
        console.log(`📦 Cache hit (${this.getHitRate()}% hit rate)`);
        return cached.result;
      } else {
        // Expired
        this.cache.delete(key);
      }
    }
    
    this.misses++;
    return null;
  }

  set(workflow, result) {
    const key = this.generateKey(workflow);
    
    // Implement LRU eviction if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  getHitRate() {
    const total = this.hits + this.misses;
    return total > 0 ? ((this.hits / total) * 100).toFixed(1) : 0;
  }

  getStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.getHitRate()
    };
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

export class N8nValidationLoop {
  constructor() {
    this.apiUrl = process.env.N8N_API_URL;
    this.apiKey = process.env.N8N_API_KEY;
    this.webhookUrl = process.env.N8N_WEBHOOK_URL;
    
    // Initialize cache
    this.validationCache = new ValidationCache();
    
    this.errorPatterns = {
      'unknown_node': {
        regex: /Unknown node "([^"]+)"/i,
        fix: 'fix_node_type',
        hint: 'Check node type casing and naming'
      },
      'invalid_parameter': {
        regex: /Invalid parameter "([^"]+)" for node "([^"]+)"/i,
        fix: 'fix_parameters',
        hint: 'Remove or correct invalid parameters'
      },
      'missing_parameter': {
        regex: /Missing required parameter "([^"]+)" for node "([^"]+)"/i,
        fix: 'add_missing_parameters',
        hint: 'Add required parameters for the node'
      },
      'invalid_connection': {
        regex: /Node "([^"]+)" references non-existent node "([^"]+)"/i,
        fix: 'fix_connections',
        hint: 'Ensure all connected nodes exist'
      },
      'credential_error': {
        regex: /Invalid credential/i,
        fix: 'fix_credentials',
        hint: 'Check credential structure and naming'
      },
      'json_parse_error': {
        regex: /JSON parse error/i,
        fix: 'fix_json_structure',
        hint: 'Fix JSON syntax errors'
      },
      'node_not_found': {
        regex: /Node type "([^"]+)" is not known/i,
        fix: 'fix_node_type',
        hint: 'Use valid n8n node types'
      },
      // New error patterns
      'duplicate_node_name': {
        regex: /Duplicate node name: "([^"]+)"/i,
        fix: 'fix_duplicate_names',
        hint: 'Ensure all node names are unique'
      },
      'invalid_expression': {
        regex: /Invalid expression in "([^"]+)"/i,
        fix: 'fix_expressions',
        hint: 'Check expression syntax and references'
      },
      'missing_node_reference': {
        regex: /Node "([^"]+)" doesn't exist/i,
        fix: 'fix_missing_references',
        hint: 'Ensure all referenced nodes exist in the workflow'
      },
      'invalid_credentials_reference': {
        regex: /Credentials "([^"]+)" not found/i,
        fix: 'fix_credential_references',
        hint: 'Use generic credential references'
      },
      'circular_reference': {
        regex: /Circular reference detected/i,
        fix: 'fix_circular_references',
        hint: 'Remove circular dependencies between nodes'
      },
      'invalid_webhook_method': {
        regex: /Invalid HTTP method/i,
        fix: 'fix_webhook_method',
        hint: 'Use valid HTTP methods (GET, POST, etc.)'
      }
    };

    this.nodeTypeMap = {
      'gmailtrigger': 'gmailTrigger',
      'gmail trigger': 'gmailTrigger',
      'slackmessage': 'slack',
      'slack message': 'slack',
      'httpwebrequest': 'httpRequest',
      'http request': 'httpRequest',
      'googlesheets': 'googleSheets',
      'google sheets': 'googleSheets',
      'github': 'github',
      'githubTrigger': 'github',
      'webhook': 'webhook',
      'webhooktrigger': 'webhook',
      'code': 'code',
      'function': 'code',
      'setdata': 'set',
      'set data': 'set',
      'ifelse': 'if',
      'if else': 'if',
      'merge': 'merge',
      'splitinbatches': 'splitInBatches',
      'split in batches': 'splitInBatches'
    };
  }

  async validateAndFix(workflow, originalPrompt, options = {}) {
    const { maxAttempts = 3, platform = 'n8n', bypassCache = false } = options;
    
    // Check cache first unless bypassed
    if (!bypassCache) {
      const cached = this.validationCache.get(workflow);
      if (cached) {
        return {
          ...cached,
          fromCache: true,
          cacheStats: this.validationCache.getStats()
        };
      }
    }
    
    // Early exit for simple workflows
    if (this.isSimpleWorkflow(workflow)) {
      console.log('✅ Skipping validation for simple workflow');
      const result = {
        success: true,
        workflow,
        attempts: 0,
        history: [],
        validated: true,
        skipped: true,
        reason: 'Simple workflow unlikely to have issues'
      };
      
      // Cache the result
      this.validationCache.set(workflow, result);
      return result;
    }
    
    const history = [];
    let currentWorkflow = workflow;
    let isValid = false;
    let attempts = 0;

    console.log('Starting n8n validation loop...');

    while (!isValid && attempts < maxAttempts) {
      attempts++;
      console.log(`Validation attempt ${attempts}/${maxAttempts}`);

      try {
        const testResult = await this.testInN8n(currentWorkflow);
        
        if (testResult.success) {
          isValid = true;
          history.push({
            attempt: attempts,
            success: true,
            message: 'Workflow validated successfully'
          });
          console.log('Workflow validated successfully!');
        } else {
          const errorAnalysis = this.analyzeN8nError(testResult);
          history.push({
            attempt: attempts,
            success: false,
            error: testResult.error,
            errorType: errorAnalysis.type,
            details: errorAnalysis.details
          });

          console.log(`Error detected: ${errorAnalysis.type}`);
          console.log(`Details: ${JSON.stringify(errorAnalysis.details)}`);

          // Try specific fixes first
          currentWorkflow = await this.applySpecificFixes(currentWorkflow, errorAnalysis);

          // If specific fixes didn't work, regenerate with error context
          if (attempts < maxAttempts) {
            const regenerationResult = await this.regenerateWithFix(
              currentWorkflow,
              originalPrompt,
              errorAnalysis,
              platform
            );
            
            if (regenerationResult.workflow) {
              currentWorkflow = regenerationResult.workflow;
            }
          }
        }
      } catch (error) {
        console.error(`Validation error: ${error.message}`);
        history.push({
          attempt: attempts,
          success: false,
          error: error.message,
          errorType: 'validation_error'
        });
        
        if (attempts >= maxAttempts) {
          break;
        }
      }
    }

    const result = {
      success: isValid,
      workflow: currentWorkflow,
      attempts,
      history,
      validated: true,
      lastError: !isValid && history.length > 0 ? history[history.length - 1].error : null,
      suggestions: this.generateSuggestions(history)
    };
    
    // Cache successful validations
    if (isValid && !bypassCache) {
      this.validationCache.set(workflow, result);
    }
    
    return result;
  }

  async testInN8n(workflow) {
    if (this.apiKey && this.apiUrl) {
      return await this.testViaAPI(workflow);
    } else if (this.webhookUrl) {
      return await this.testViaWebhook(workflow);
    } else {
      console.log('No n8n validation endpoint configured');
      return { success: true, message: 'Skipping n8n validation - no endpoint configured' };
    }
  }

  async testViaAPI(workflow) {
    try {
      const testWorkflow = {
        ...workflow,
        name: `Test_${Date.now()}`,
        active: false
      };

      const response = await fetch(`${this.apiUrl}/api/v1/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': this.apiKey
        },
        body: JSON.stringify(testWorkflow)
      });

      const result = await response.json();

      if (response.ok) {
        // Clean up test workflow
        if (result.data?.id) {
          await this.deleteTestWorkflow(result.data.id);
        }
        return { success: true, data: result.data };
      } else {
        return {
          success: false,
          error: result.message || 'Unknown error',
          details: result
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: { type: 'api_error' }
      };
    }
  }

  async testViaWebhook(workflow) {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ workflow })
      });

      const result = await response.json();
      
      return {
        success: result.valid || false,
        error: result.error,
        details: result.details || {}
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: { type: 'webhook_error' }
      };
    }
  }

  async deleteTestWorkflow(workflowId) {
    try {
      await fetch(`${this.apiUrl}/api/v1/workflows/${workflowId}`, {
        method: 'DELETE',
        headers: {
          'X-N8N-API-KEY': this.apiKey
        }
      });
    } catch (error) {
      console.error(`Failed to delete test workflow: ${error.message}`);
    }
  }

  async cleanup() {
    // This method can be extended to clean up any remaining test workflows
    // For now, it's a placeholder since we clean up immediately after each test
    console.log('Cleanup completed');
  }

  analyzeN8nError(testResult) {
    const errorMessage = testResult.error || '';
    
    for (const [type, pattern] of Object.entries(this.errorPatterns)) {
      const match = errorMessage.match(pattern.regex);
      if (match) {
        return {
          type,
          fix: pattern.fix,
          details: {
            fullMatch: match[0],
            captures: match.slice(1),
            originalError: errorMessage
          }
        };
      }
    }

    return {
      type: 'unknown_error',
      fix: 'regenerate',
      details: {
        originalError: errorMessage
      }
    };
  }

  async applySpecificFixes(workflow, errorAnalysis) {
    console.log(`Applying fix: ${errorAnalysis.fix}`);
    
    switch (errorAnalysis.fix) {
      case 'fix_node_type':
        return this.fixNodeTypes(workflow, errorAnalysis);
      
      case 'fix_parameters':
        return this.fixParameters(workflow, errorAnalysis);
      
      case 'add_missing_parameters':
        return this.addMissingParameters(workflow, errorAnalysis);
      
      case 'fix_connections':
        return this.fixConnections(workflow, errorAnalysis);
      
      case 'fix_credentials':
        return this.fixCredentials(workflow, errorAnalysis);
      
      case 'fix_json_structure':
        return this.fixJsonStructure(workflow);
        
      case 'fix_duplicate_names':
        return this.fixDuplicateNames(workflow, errorAnalysis);
        
      case 'fix_expressions':
        return this.fixExpressions(workflow, errorAnalysis);
        
      case 'fix_missing_references':
        return this.fixMissingReferences(workflow, errorAnalysis);
        
      case 'fix_credential_references':
        return this.fixCredentialReferences(workflow, errorAnalysis);
        
      case 'fix_circular_references':
        return this.fixCircularReferences(workflow, errorAnalysis);
        
      case 'fix_webhook_method':
        return this.fixWebhookMethod(workflow, errorAnalysis);
      
      default:
        return workflow;
    }
  }

  fixNodeTypes(workflow, errorAnalysis) {
    const workflowCopy = JSON.parse(JSON.stringify(workflow));
    const [unknownNodeType] = errorAnalysis.details.captures;
    
    // Check if it's a casing issue
    const lowerNodeType = unknownNodeType.toLowerCase();
    const correctType = this.nodeTypeMap[lowerNodeType] || this.findCorrectNodeType(unknownNodeType);
    
    if (correctType) {
      console.log(`Fixing node type: ${unknownNodeType} -> ${correctType}`);
      
      workflowCopy.nodes = workflowCopy.nodes.map(node => {
        if (node.type === unknownNodeType) {
          return { ...node, type: correctType };
        }
        return node;
      });
    }
    
    return workflowCopy;
  }

  findCorrectNodeType(unknownType) {
    const lower = unknownType.toLowerCase();
    
    // Common patterns
    if (lower.includes('gmail') && lower.includes('trigger')) return 'gmailTrigger';
    if (lower.includes('slack')) return 'slack';
    if (lower.includes('http')) return 'httpRequest';
    if (lower.includes('sheet')) return 'googleSheets';
    if (lower.includes('webhook')) return 'webhook';
    if (lower.includes('code') || lower.includes('function')) return 'code';
    if (lower.includes('set')) return 'set';
    if (lower.includes('if')) return 'if';
    if (lower.includes('merge')) return 'merge';
    if (lower.includes('split')) return 'splitInBatches';
    
    // Try to find by prefix
    if (!unknownType.includes('.')) {
      return `n8n-nodes-base.${unknownType}`;
    }
    
    return null;
  }

  fixParameters(workflow, errorAnalysis) {
    const workflowCopy = JSON.parse(JSON.stringify(workflow));
    const [parameterName, nodeName] = errorAnalysis.details.captures;
    
    console.log(`Fixing parameter: ${parameterName} in node: ${nodeName}`);
    
    workflowCopy.nodes = workflowCopy.nodes.map(node => {
      if (node.name === nodeName && node.parameters) {
        // Remove invalid parameter
        delete node.parameters[parameterName];
        
        // Add common fixes
        if (parameterName === 'webhookId' && node.type === 'webhook') {
          node.parameters.httpMethod = node.parameters.httpMethod || 'POST';
          node.parameters.path = node.parameters.path || 'webhook';
        }
      }
      return node;
    });
    
    return workflowCopy;
  }

  addMissingParameters(workflow, errorAnalysis) {
    const workflowCopy = JSON.parse(JSON.stringify(workflow));
    const [parameterName, nodeName] = errorAnalysis.details.captures;
    
    console.log(`Adding missing parameter: ${parameterName} to node: ${nodeName}`);
    
    workflowCopy.nodes = workflowCopy.nodes.map(node => {
      if (node.name === nodeName) {
        node.parameters = node.parameters || {};
        
        // Add common required parameters based on node type
        switch (node.type) {
          case 'webhook':
            if (parameterName === 'httpMethod') node.parameters.httpMethod = 'POST';
            if (parameterName === 'path') node.parameters.path = 'webhook';
            break;
          
          case 'httpRequest':
            if (parameterName === 'url') node.parameters.url = '';
            if (parameterName === 'method') node.parameters.method = 'GET';
            break;
          
          case 'set':
            if (parameterName === 'values') node.parameters.values = { values: [] };
            break;
          
          case 'code':
            if (parameterName === 'functionCode') node.parameters.functionCode = 'return items;';
            break;
        }
      }
      return node;
    });
    
    return workflowCopy;
  }

  fixConnections(workflow, errorAnalysis) {
    const workflowCopy = JSON.parse(JSON.stringify(workflow));
    const [sourceNode, targetNode] = errorAnalysis.details.captures;
    
    console.log(`Fixing connection: ${sourceNode} -> ${targetNode}`);
    
    // Remove invalid connections
    workflowCopy.connections = {};
    
    // Rebuild connections based on node positions
    const nodeMap = {};
    workflowCopy.nodes.forEach(node => {
      nodeMap[node.name] = node;
    });
    
    // Sort nodes by position to determine flow
    const sortedNodes = workflowCopy.nodes.sort((a, b) => {
      return (a.position[0] - b.position[0]) || (a.position[1] - b.position[1]);
    });
    
    // Connect nodes in sequence
    for (let i = 0; i < sortedNodes.length - 1; i++) {
      const currentNode = sortedNodes[i];
      const nextNode = sortedNodes[i + 1];
      
      if (!workflowCopy.connections[currentNode.name]) {
        workflowCopy.connections[currentNode.name] = {};
      }
      
      workflowCopy.connections[currentNode.name].main = [[{
        node: nextNode.name,
        type: 'main',
        index: 0
      }]];
    }
    
    return workflowCopy;
  }

  fixCredentials(workflow, errorAnalysis) {
    const workflowCopy = JSON.parse(JSON.stringify(workflow));
    
    // Remove credential references for now
    workflowCopy.nodes = workflowCopy.nodes.map(node => {
      if (node.credentials) {
        console.log(`Removing credentials from node: ${node.name}`);
        delete node.credentials;
      }
      return node;
    });
    
    return workflowCopy;
  }

  fixJsonStructure(workflow) {
    try {
      // Ensure valid JSON structure
      const workflowString = JSON.stringify(workflow);
      const parsedWorkflow = JSON.parse(workflowString);
      
      // Ensure required fields
      parsedWorkflow.name = parsedWorkflow.name || 'Untitled Workflow';
      parsedWorkflow.nodes = parsedWorkflow.nodes || [];
      parsedWorkflow.connections = parsedWorkflow.connections || {};
      parsedWorkflow.active = false;
      parsedWorkflow.settings = parsedWorkflow.settings || {};
      parsedWorkflow.tags = parsedWorkflow.tags || [];
      
      return parsedWorkflow;
    } catch (error) {
      console.error('Failed to fix JSON structure:', error);
      return workflow;
    }
  }

  async regenerateWithFix(currentWorkflow, originalPrompt, errorAnalysis, platform) {
    console.log('Regenerating workflow with error context...');
    
    const errorContext = `
The previous workflow generation had the following error:
Error Type: ${errorAnalysis.type}
Error Message: ${errorAnalysis.details.originalError}

Please regenerate the workflow fixing this specific issue:
${this.getFixInstructions(errorAnalysis)}

Current workflow that needs fixing:
${JSON.stringify(currentWorkflow, null, 2)}
`;

    try {
      const messages = [
        {
          role: 'user',
          content: `${originalPrompt}\n\n${errorContext}`
        }
      ];

      const response = await anthropicClient.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.3,
        system: platformTemplates[platform].system,
        messages
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      
      if (jsonMatch) {
        const workflowData = JSON.parse(jsonMatch[1]);
        return { workflow: workflowData };
      }
    } catch (error) {
      console.error('Regeneration failed:', error);
    }

    return { workflow: currentWorkflow };
  }

  getFixInstructions(errorAnalysis) {
    switch (errorAnalysis.type) {
      case 'unknown_node':
      case 'node_not_found':
        return `
IMPORTANT: Use the correct node type. Common node types in n8n:
- webhook (not webhookTrigger)
- gmailTrigger (not gmailtrigger or "Gmail Trigger")
- slack (not slackMessage)
- httpRequest (not httpWebRequest)
- googleSheets (not "Google Sheets")
- code (not function)
- set (not setData)
- if (not ifElse)
- splitInBatches (not "Split In Batches")

Ensure all node types use the exact casing and format.`;

      case 'invalid_parameter':
        return `
Remove invalid parameters. Common issues:
- webhook nodes don't have a 'webhookId' parameter
- Use 'httpMethod' not 'method' for webhook nodes
- Ensure all parameter names match the n8n documentation exactly`;

      case 'missing_parameter':
        return `
Add all required parameters for each node type:
- webhook: requires 'httpMethod' and 'path'
- httpRequest: requires 'url' and 'method'
- set: requires 'values' object
- code: requires 'functionCode' string`;

      case 'invalid_connection':
        return `
Fix node connections:
- Ensure all referenced nodes exist in the workflow
- Use exact node names in connections
- Check that connection structure matches n8n format`;

      case 'duplicate_node_name':
        return `
Ensure all node names are unique. If you have multiple nodes of the same type,
add numbers or descriptive suffixes (e.g., "Webhook 1", "Webhook 2")`;

      case 'invalid_expression':
        return `
Fix expression syntax. Common issues:
- Use double quotes in expressions: {{$json["field"]}}
- Escape quotes properly in complex expressions
- Ensure referenced fields exist`;

      case 'missing_node_reference':
      case 'invalid_credentials_reference':
        return `
Fix node and credential references:
- Ensure all referenced nodes exist
- Use generic credential structures without specific IDs
- Check spelling and casing of node names`;

      default:
        return 'Fix any structural issues and ensure the workflow follows n8n format exactly.';
    }
  }

  // Check if workflow is simple enough to skip validation
  isSimpleWorkflow(workflow) {
    if (!workflow.nodes || workflow.nodes.length > 3) return false;
    
    // Check for complex node types
    const complexNodeTypes = ['if', 'switch', 'merge', 'splitInBatches', 'code'];
    const hasComplexNodes = workflow.nodes.some(node => 
      complexNodeTypes.some(type => node.type.includes(type))
    );
    
    if (hasComplexNodes) return false;
    
    // Check for complex expressions
    return !this.hasComplexExpressions(workflow);
  }

  hasComplexExpressions(workflow) {
    const expressionPattern = /\{\{.*\}\}/;
    const workflowString = JSON.stringify(workflow);
    return expressionPattern.test(workflowString);
  }

  // Generate user-friendly suggestions based on validation history
  generateSuggestions(history) {
    if (!history || history.length === 0) return [];
    
    const suggestions = [];
    const errorTypes = new Set();
    
    history.forEach(attempt => {
      if (!attempt.success && attempt.errorType) {
        errorTypes.add(attempt.errorType);
      }
    });
    
    errorTypes.forEach(errorType => {
      const pattern = this.errorPatterns[errorType];
      if (pattern && pattern.hint) {
        suggestions.push(pattern.hint);
      }
    });
    
    return suggestions;
  }

  // New fix methods for additional error patterns
  async fixDuplicateNames(workflow, errorAnalysis) {
    const workflowCopy = JSON.parse(JSON.stringify(workflow));
    const [duplicateName] = errorAnalysis.details.captures;
    
    console.log(`Fixing duplicate node name: ${duplicateName}`);
    
    const nameCount = {};
    workflowCopy.nodes = workflowCopy.nodes.map(node => {
      if (!nameCount[node.name]) {
        nameCount[node.name] = 1;
      } else {
        nameCount[node.name]++;
        const newName = `${node.name} ${nameCount[node.name]}`;
        
        // Update connections that reference this node
        this.updateNodeReferences(workflowCopy, node.name, newName);
        
        node.name = newName;
      }
      return node;
    });
    
    return workflowCopy;
  }

  fixExpressions(workflow, errorAnalysis) {
    const workflowCopy = JSON.parse(JSON.stringify(workflow));
    
    // Fix common expression issues
    const fixExpression = (expr) => {
      if (typeof expr !== 'string') return expr;
      
      // Fix unescaped quotes in JSON paths
      return expr.replace(/\$json\[([^"\]]+)\]/g, '$json["$1"]');
    };
    
    // Recursively fix expressions in parameters
    const fixObject = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      
      for (const key in obj) {
        if (typeof obj[key] === 'string' && obj[key].includes('{{')) {
          obj[key] = fixExpression(obj[key]);
        } else if (typeof obj[key] === 'object') {
          fixObject(obj[key]);
        }
      }
    };
    
    workflowCopy.nodes.forEach(node => {
      if (node.parameters) {
        fixObject(node.parameters);
      }
    });
    
    return workflowCopy;
  }

  fixMissingReferences(workflow, errorAnalysis) {
    const workflowCopy = JSON.parse(JSON.stringify(workflow));
    const [missingNode] = errorAnalysis.details.captures;
    
    console.log(`Fixing missing reference to node: ${missingNode}`);
    
    // Remove connections to non-existent nodes
    for (const nodeName in workflowCopy.connections) {
      if (workflowCopy.connections[nodeName]) {
        for (const outputType in workflowCopy.connections[nodeName]) {
          if (workflowCopy.connections[nodeName][outputType]) {
            workflowCopy.connections[nodeName][outputType] = 
              workflowCopy.connections[nodeName][outputType].map(outputs => 
                outputs.filter(connection => {
                  const nodeExists = workflowCopy.nodes.some(n => n.name === connection.node);
                  if (!nodeExists) {
                    console.log(`Removing connection to non-existent node: ${connection.node}`);
                  }
                  return nodeExists;
                })
              );
          }
        }
      }
    }
    
    return workflowCopy;
  }

  fixCredentialReferences(workflow, errorAnalysis) {
    const workflowCopy = JSON.parse(JSON.stringify(workflow));
    
    // Remove all credential references to let n8n handle them
    workflowCopy.nodes = workflowCopy.nodes.map(node => {
      if (node.credentials) {
        console.log(`Removing credential references from node: ${node.name}`);
        delete node.credentials;
      }
      return node;
    });
    
    return workflowCopy;
  }

  fixCircularReferences(workflow, errorAnalysis) {
    const workflowCopy = JSON.parse(JSON.stringify(workflow));
    
    // Detect and break circular references
    const visited = new Set();
    const recursionStack = new Set();
    
    const hasCircularDependency = (nodeName, connections) => {
      visited.add(nodeName);
      recursionStack.add(nodeName);
      
      const nodeConnections = connections[nodeName];
      if (nodeConnections && nodeConnections.main) {
        for (const outputConnections of nodeConnections.main) {
          if (outputConnections) {
            for (const connection of outputConnections) {
              if (!visited.has(connection.node)) {
                if (hasCircularDependency(connection.node, connections)) {
                  return true;
                }
              } else if (recursionStack.has(connection.node)) {
                console.log(`Circular reference detected: ${nodeName} -> ${connection.node}`);
                return true;
              }
            }
          }
        }
      }
      
      recursionStack.delete(nodeName);
      return false;
    };
    
    // Check each node for circular dependencies
    workflowCopy.nodes.forEach(node => {
      visited.clear();
      recursionStack.clear();
      if (hasCircularDependency(node.name, workflowCopy.connections)) {
        // Remove the last connection that creates the cycle
        // This is a simplified approach - in practice, you might want more sophisticated logic
        console.log(`Breaking circular reference at node: ${node.name}`);
        delete workflowCopy.connections[node.name];
      }
    });
    
    return workflowCopy;
  }

  fixWebhookMethod(workflow, errorAnalysis) {
    const workflowCopy = JSON.parse(JSON.stringify(workflow));
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    
    workflowCopy.nodes = workflowCopy.nodes.map(node => {
      if (node.type === 'n8n-nodes-base.webhook' && node.parameters?.httpMethod) {
        const method = node.parameters.httpMethod.toUpperCase();
        if (!validMethods.includes(method)) {
          console.log(`Fixing invalid HTTP method: ${node.parameters.httpMethod} -> POST`);
          node.parameters.httpMethod = 'POST';
        } else {
          node.parameters.httpMethod = method;
        }
      }
      return node;
    });
    
    return workflowCopy;
  }

  updateNodeReferences(workflow, oldName, newName) {
    // Update connections
    if (workflow.connections[oldName]) {
      workflow.connections[newName] = workflow.connections[oldName];
      delete workflow.connections[oldName];
    }
    
    // Update references in other connections
    for (const nodeName in workflow.connections) {
      if (workflow.connections[nodeName]) {
        for (const outputType in workflow.connections[nodeName]) {
          if (workflow.connections[nodeName][outputType]) {
            workflow.connections[nodeName][outputType] = 
              workflow.connections[nodeName][outputType].map(outputs => 
                outputs.map(connection => {
                  if (connection.node === oldName) {
                    connection.node = newName;
                  }
                  return connection;
                })
              );
          }
        }
      }
    }
  }

  // Bulk validation support
  async validateBulk(workflows, options = {}) {
    const { batchSize = 5 } = options;
    const results = [];
    
    console.log(`Starting bulk validation of ${workflows.length} workflows...`);
    
    for (let i = 0; i < workflows.length; i += batchSize) {
      const batch = workflows.slice(i, i + batchSize);
      const batchPromises = batch.map(({ workflow, prompt }) => 
        this.validateAndFix(workflow, prompt || 'Bulk validation', options)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      console.log(`Completed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(workflows.length/batchSize)}`);
    }
    
    console.log(`Bulk validation complete. Success rate: ${
      (results.filter(r => r.success).length / results.length * 100).toFixed(1)
    }%`);
    
    return results;
  }

  // Get cache statistics
  getCacheStats() {
    return this.validationCache.getStats();
  }

  // Clear validation cache
  clearCache() {
    this.validationCache.clear();
    console.log('Validation cache cleared');
  }
}