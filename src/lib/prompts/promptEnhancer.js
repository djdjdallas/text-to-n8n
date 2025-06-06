/**
 * Prompt Enhancement Layer for Workflow Generation
 * Pre-processes user input to create explicit, structured prompts
 * that ensure Claude returns complete workflow JSON structures
 */

export class PromptEnhancer {
  constructor() {
    // Common workflow patterns by trigger type
    this.workflowPatterns = {
      gmail: {
        nodes: ['Gmail Trigger', 'Filter', 'Data Transform', 'Action'],
        complexity: 'moderate',
        description: 'Email-based automation workflow'
      },
      webhook: {
        nodes: ['Webhook', 'Data Validation', 'Process', 'Response'],
        complexity: 'moderate',  
        description: 'API endpoint workflow'
      },
      schedule: {
        nodes: ['Schedule Trigger', 'Fetch Data', 'Process', 'Store/Notify'],
        complexity: 'simple',
        description: 'Time-based automation'
      },
      form: {
        nodes: ['Form Trigger', 'Validate', 'Process', 'Store', 'Notify'],
        complexity: 'moderate',
        description: 'Form submission workflow'
      },
      database: {
        nodes: ['Database Trigger', 'Transform', 'Process', 'Update'],
        complexity: 'complex',
        description: 'Database operation workflow'
      }
    };

    // Keywords to identify workflow intent
    this.intentKeywords = {
      triggers: {
        email: ['email', 'gmail', 'outlook', 'mail'],
        webhook: ['webhook', 'api', 'http request', 'endpoint'],
        schedule: ['schedule', 'cron', 'every', 'daily', 'weekly', 'hourly'],
        form: ['form', 'typeform', 'google form', 'survey', 'submission'],
        database: ['database', 'mysql', 'postgres', 'mongodb', 'airtable']
      },
      actions: {
        notify: ['notify', 'alert', 'send', 'slack', 'discord', 'teams'],
        store: ['store', 'save', 'database', 'sheet', 'airtable'],
        process: ['process', 'transform', 'filter', 'analyze', 'calculate'],
        integrate: ['integrate', 'connect', 'sync', 'update']
      }
    };
  }

  /**
   * Main enhancement function
   */
  enhance(userInput, options = {}) {
    const {
      platform = 'n8n',
      complexity = 'moderate',
      includeExamples = true,
      ragContext = []
    } = options;

    // Parse user intent
    const intent = this.parseIntent(userInput);
    
    // Identify workflow pattern
    const pattern = this.identifyPattern(intent, userInput);
    
    // Build enhanced prompt
    const enhancedPrompt = this.buildEnhancedPrompt(
      userInput,
      intent,
      pattern,
      platform,
      complexity,
      ragContext
    );

    return {
      original: userInput,
      enhanced: enhancedPrompt,
      metadata: {
        intent,
        pattern,
        expectedNodes: pattern.nodes || [],
        complexity: pattern.complexity || complexity,
        validationRules: this.getValidationRules(pattern)
      }
    };
  }

  /**
   * Parse user intent from input text
   */
  parseIntent(userInput) {
    const input = userInput.toLowerCase();
    const intent = {
      triggers: [],
      actions: [],
      services: [],
      conditions: []
    };

    // Identify triggers
    for (const [type, keywords] of Object.entries(this.intentKeywords.triggers)) {
      if (keywords.some(keyword => input.includes(keyword))) {
        intent.triggers.push(type);
      }
    }

    // Identify actions
    for (const [type, keywords] of Object.entries(this.intentKeywords.actions)) {
      if (keywords.some(keyword => input.includes(keyword))) {
        intent.actions.push(type);
      }
    }

    // Extract service names (common ones)
    const services = [
      'gmail', 'slack', 'discord', 'airtable', 'sheets', 'drive',
      'dropbox', 'notion', 'hubspot', 'salesforce', 'mailchimp',
      'stripe', 'shopify', 'twitter', 'facebook', 'instagram'
    ];
    
    services.forEach(service => {
      if (input.includes(service)) {
        intent.services.push(service);
      }
    });

    // Identify conditions
    if (input.includes('if') || input.includes('when') || input.includes('filter')) {
      intent.conditions.push('conditional');
    }

    return intent;
  }

  /**
   * Identify the best workflow pattern based on intent
   */
  identifyPattern(intent, userInput) {
    // Check for explicit pattern matches
    for (const [key, pattern] of Object.entries(this.workflowPatterns)) {
      if (intent.triggers.includes(key)) {
        return { ...pattern, type: key };
      }
    }

    // Default pattern for complex workflows
    return {
      type: 'custom',
      nodes: ['Trigger', 'Process', 'Action'],
      complexity: 'moderate',
      description: 'Custom workflow based on user requirements'
    };
  }

  /**
   * Build the enhanced prompt with explicit structure requirements
   */
  buildEnhancedPrompt(userInput, intent, pattern, platform, complexity, ragContext) {
    const contextDocs = ragContext.length > 0 
      ? `\nRELEVANT DOCUMENTATION:\n${ragContext.slice(0, 3).map(doc => doc.content).join('\n\n')}\n`
      : '';

    return `You are an expert ${platform} workflow automation engineer. Create a complete, production-ready workflow.

USER REQUEST: ${userInput}

${contextDocs}

CRITICAL REQUIREMENTS:
1. You MUST return a complete ${platform} workflow JSON structure
2. The workflow MUST include ALL necessary nodes for a functioning automation
3. Each node MUST have proper parameters and connections
4. Return ONLY valid JSON - no explanations, no markdown, no comments

WORKFLOW STRUCTURE REQUIREMENTS:
- Minimum nodes required: ${pattern.nodes.length || 3}
- Expected node types: ${pattern.nodes.join(', ')}
- Complexity level: ${complexity}
- All nodes must be properly connected
- Include error handling where appropriate

MANDATORY JSON STRUCTURE:
{
  "name": "descriptive_workflow_name",
  "nodes": [
    {
      "id": "unique_id",
      "name": "Node Name",
      "type": "n8n-nodes-base.nodetype",
      "position": [x, y],
      "parameters": {
        // All required parameters for this node type
      },
      "typeVersion": 1
    }
    // ... more nodes
  ],
  "connections": {
    "Node Name": {
      "main": [
        [
          {
            "node": "Next Node Name",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
    // ... more connections
  },
  "settings": {
    "executionOrder": "v1"
  },
  "staticData": null,
  "pinData": {}
}

EXAMPLE OF A COMPLETE WORKFLOW:
${this.getExampleWorkflow(pattern.type, platform)}

VALIDATION CHECKLIST:
✓ The workflow has a clear trigger node
✓ All nodes are connected in a logical flow
✓ Each node has all required parameters
✓ The final action completes the automation goal
✓ Error paths are handled (if complexity is moderate/complex)

IMPORTANT: The user expects a COMPLETE, WORKING workflow. Do not return partial node configurations or incomplete structures.`;
  }

  /**
   * Get an example workflow based on pattern type
   */
  getExampleWorkflow(patternType, platform) {
    if (platform !== 'n8n') return ''; // Only n8n examples for now

    const examples = {
      gmail: `{
  "name": "Gmail to Slack Notification",
  "nodes": [
    {
      "id": "1",
      "name": "Gmail Trigger",
      "type": "n8n-nodes-base.gmailTrigger",
      "position": [250, 300],
      "parameters": {
        "labels": ["INBOX"]
      }
    },
    {
      "id": "2", 
      "name": "Slack",
      "type": "n8n-nodes-base.slack",
      "position": [450, 300],
      "parameters": {
        "operation": "post",
        "channel": "#notifications",
        "text": "New email from: {{$json.from}}"
      }
    }
  ],
  "connections": {
    "Gmail Trigger": {
      "main": [[{"node": "Slack", "type": "main", "index": 0}]]
    }
  }
}`,
      webhook: `{
  "name": "Webhook to Database",
  "nodes": [
    {
      "id": "1",
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300],
      "parameters": {
        "path": "my-webhook",
        "responseMode": "onReceived",
        "responseData": "success"
      }
    }
  ]
}`
    };

    return examples[patternType] || examples.gmail;
  }

  /**
   * Get validation rules for the pattern
   */
  getValidationRules(pattern) {
    return {
      minNodes: pattern.nodes?.length || 2,
      requiredNodeTypes: pattern.nodes || [],
      mustHaveTrigger: true,
      mustHaveConnections: true,
      allowedComplexity: pattern.complexity || 'moderate'
    };
  }

  /**
   * Validate if the generated workflow meets expectations
   */
  validateGeneratedWorkflow(workflow, metadata) {
    const errors = [];
    const warnings = [];

    // Check basic structure
    if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
      errors.push('Workflow must have a nodes array');
    }

    if (!workflow.connections || typeof workflow.connections !== 'object') {
      errors.push('Workflow must have a connections object');
    }

    // Check node count
    if (workflow.nodes && workflow.nodes.length < metadata.validationRules.minNodes) {
      warnings.push(`Expected at least ${metadata.validationRules.minNodes} nodes, found ${workflow.nodes.length}`);
    }

    // Check for trigger node
    if (metadata.validationRules.mustHaveTrigger && workflow.nodes) {
      const hasTrigger = workflow.nodes.some(node => 
        node.type.includes('trigger') || 
        node.type.includes('webhook') ||
        node.type.includes('cron')
      );
      if (!hasTrigger) {
        errors.push('Workflow must have at least one trigger node');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Export singleton instance
export const promptEnhancer = new PromptEnhancer();