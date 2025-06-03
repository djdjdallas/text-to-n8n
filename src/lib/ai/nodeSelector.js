// src/lib/ai/nodeSelector.js

/**
 * NodeSelector class for choosing appropriate node types based on task context
 */
export class NodeSelector {
  /**
   * Select the most appropriate node type based on task description and context
   * @param {string} task - Description of the task to be performed
   * @param {object} context - Additional context about the workflow
   * @returns {object} - Selected node type with reason
   */
  static selectAppropriateNode(task, context = {}) {
    // Normalize task description
    const taskLower = task.toLowerCase();
    
    // For simple response creation
    if (taskLower.includes('response') || taskLower.includes('status') || 
        taskLower.includes('message') || taskLower.includes('create output')) {
      return {
        type: 'n8n-nodes-base.set',
        reason: 'Creating structured response data'
      };
    }
    
    // For binary conditions
    if (context.conditionCount === 1 && context.outputs <= 2) {
      return {
        type: 'n8n-nodes-base.switch',
        reason: 'Simple binary condition - switch is cleaner than if'
      };
    }
    
    // For multi-branch conditions
    if (context.conditionCount > 1 || context.outputs > 2) {
      return {
        type: 'n8n-nodes-base.if',
        reason: 'Complex multi-branch condition'
      };
    }
    
    // For actual email sending
    if (taskLower.includes('send') && taskLower.includes('email') && 
        (context.hasEmailData || taskLower.includes('subject'))) {
      return {
        type: 'n8n-nodes-base.emailSend',
        reason: 'Actually sending an email'
      };
    }
    
    // For data transformation
    if (taskLower.includes('transform') || taskLower.includes('format') || 
        taskLower.includes('convert')) {
      if (context.isComplex || taskLower.includes('complex')) {
        return {
          type: 'n8n-nodes-base.function',
          reason: 'Complex data transformation requiring custom logic'
        };
      } else {
        return {
          type: 'n8n-nodes-base.set',
          reason: 'Simple data transformation'
        };
      }
    }
    
    // For HTTP requests
    if (taskLower.includes('api') || taskLower.includes('http') || 
        taskLower.includes('request') || taskLower.includes('fetch')) {
      return {
        type: 'n8n-nodes-base.httpRequest',
        reason: 'Making HTTP request to external service'
      };
    }
    
    // For receiving webhooks
    if (taskLower.includes('webhook') || taskLower.includes('receive') || 
        taskLower.includes('incoming')) {
      return {
        type: 'n8n-nodes-base.webhook',
        reason: 'Receiving incoming webhook data'
      };
    }
    
    // For manipulating files
    if (taskLower.includes('file') || taskLower.includes('attachment') || 
        taskLower.includes('document')) {
      if (taskLower.includes('google') || taskLower.includes('drive')) {
        return {
          type: 'n8n-nodes-base.googleDrive',
          reason: 'Working with files in Google Drive'
        };
      } else {
        return {
          type: 'n8n-nodes-base.spreadsheetFile',
          reason: 'Working with generic files or attachments'
        };
      }
    }
    
    // Default to Set node as it's generally useful
    return {
      type: 'n8n-nodes-base.set',
      reason: 'Generic data handling (default choice)'
    };
  }
  
  /**
   * Get the correct parameters structure for a node type
   * @param {string} nodeType - The type of node
   * @param {object} inputs - Input data for parameter configuration
   * @returns {object} - Parameters object for the node
   */
  static getNodeParameters(nodeType, inputs = {}) {
    switch (nodeType) {
      case 'n8n-nodes-base.set':
        return this.getSetNodeParameters(inputs);
      
      case 'n8n-nodes-base.switch':
        return this.getSwitchNodeParameters(inputs);
        
      case 'n8n-nodes-base.if':
        return this.getIfNodeParameters(inputs);
        
      case 'n8n-nodes-base.webhook':
        return this.getWebhookNodeParameters(inputs);
        
      default:
        return {};
    }
  }
  
  /**
   * Get parameters for a Set node
   */
  static getSetNodeParameters(inputs = {}) {
    const parameters = {
      values: {
        string: []
      }
    };
    
    // Add values from inputs
    if (inputs.values) {
      Object.entries(inputs.values).forEach(([name, value]) => {
        parameters.values.string.push({
          name,
          value: typeof value === 'string' ? value : JSON.stringify(value)
        });
      });
    } else {
      // Default values if none provided
      parameters.values.string.push(
        { name: 'success', value: 'true' },
        { name: 'message', value: 'Operation completed successfully' }
      );
    }
    
    // NEVER include options or keepOnlySet - they cause problems
    // NEVER include dotNotation option - it's invalid
    
    return parameters;
  }
  
  /**
   * Get parameters for a Switch node
   */
  static getSwitchNodeParameters(inputs = {}) {
    const parameters = {
      dataType: 'string',
      value1: inputs.field ? `={{$json["${inputs.field}"]}}` : '={{$json["field"]}}',
      rules: {
        rules: [{
          value2: inputs.value || '',
          operation: inputs.operation || 'equal'
        }]
      },
      fallbackOutput: inputs.fallbackOutput || 1
    };
    
    return parameters;
  }
  
  /**
   * Get parameters for an IF node
   */
  static getIfNodeParameters(inputs = {}) {
    const parameters = {
      conditions: {
        conditions: []
      },
      combineOperation: inputs.combineOperation || 'all'
    };
    
    // Handle field existence check
    if (inputs.checkExistence) {
      parameters.conditions.conditions.push({
        leftValue: inputs.field ? `={{$json["${inputs.field}"]}}` : '={{$json["field"]}}',
        rightValue: '',
        operation: inputs.isNegated ? 'notExists' : 'exists'
      });
    } 
    // Regular condition check
    else if (inputs.conditions) {
      parameters.conditions.conditions = inputs.conditions;
    } 
    // Default condition
    else {
      parameters.conditions.conditions.push({
        leftValue: inputs.field ? `={{$json["${inputs.field}"]}}` : '={{$json["field"]}}',
        rightValue: inputs.value || '',
        operation: inputs.operation || 'equal'
      });
    }
    
    return parameters;
  }
  
  /**
   * Get parameters for a Webhook node
   */
  static getWebhookNodeParameters(inputs = {}) {
    const parameters = {
      httpMethod: inputs.method || 'POST',
      path: inputs.path || 'webhook',
      responseMode: inputs.responseMode || 'onReceived',
      options: {}
    };
    
    if (inputs.authentication) {
      parameters.authentication = inputs.authentication;
    }
    
    if (inputs.responseData) {
      parameters.responseData = inputs.responseData;
    }
    
    return parameters;
  }
  
  /**
   * Analyze a workflow and suggest better node choices
   * @param {object} workflow - The workflow to analyze
   * @returns {array} - Array of suggestions
   */
  static analyzeWorkflow(workflow) {
    const suggestions = [];
    
    if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
      return suggestions;
    }
    
    workflow.nodes.forEach(node => {
      // Analyze IF nodes
      if (node.type === 'n8n-nodes-base.if' && 
          node.parameters?.conditions?.conditions?.length === 1) {
        suggestions.push({
          node: node.name,
          currentType: 'if',
          suggestedType: 'switch',
          reason: 'Switch node is more appropriate for simple binary conditions',
          replaceParameters: true
        });
      }
      
      // Analyze EmailSend nodes
      if (node.type === 'n8n-nodes-base.emailSend' && 
          (!node.parameters?.toEmail || !node.parameters?.subject)) {
        suggestions.push({
          node: node.name,
          currentType: 'emailSend',
          suggestedType: 'set',
          reason: 'Set node is more appropriate for creating data without sending emails',
          replaceParameters: true
        });
      }
      
      // Analyze Function nodes
      if ((node.type === 'n8n-nodes-base.function' || node.type === 'n8n-nodes-base.functionItem') && 
          node.parameters?.functionCode) {
        const code = node.parameters.functionCode;
        // Simple function that just returns a structure
        if ((code.includes('return {') || code.includes('return [')) && 
            !code.includes('for') && !code.includes('while') && !code.includes('if ')) {
          suggestions.push({
            node: node.name,
            currentType: 'function',
            suggestedType: 'set',
            reason: 'Set node is more appropriate for simple data structure creation',
            replaceParameters: true
          });
        }
      }
      
      // Analyze NoOp nodes
      if (node.type === 'n8n-nodes-base.noOp') {
        suggestions.push({
          node: node.name,
          currentType: 'noOp',
          suggestedType: 'remove',
          reason: 'NoOp nodes do nothing and can be safely removed',
          replaceParameters: false
        });
      }
    });
    
    return suggestions;
  }
}

export default NodeSelector;