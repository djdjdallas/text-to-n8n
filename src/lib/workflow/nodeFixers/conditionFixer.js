// src/lib/workflow/nodeFixers/conditionFixer.js
import { logger } from '@/lib/utils/logger';

/**
 * Fixes IF node conditions based on context and previous nodes
 */
export class ConditionFixer {
  constructor() {
    // Common condition patterns based on node context
    this.conditionPatterns = {
      urgent: {
        gmail: {
          leftValue: '={{$json["headers"]["subject"]}}',
          rightValue: 'urgent',
          operation: 'contains'
        },
        default: {
          leftValue: '={{$json["subject"]}}',
          rightValue: 'urgent', 
          operation: 'contains'
        }
      },
      priority: {
        gmail: {
          leftValue: '={{$json["headers"]["subject"]}}',
          rightValue: 'priority',
          operation: 'contains'
        },
        default: {
          leftValue: '={{$json["priority"]}}',
          rightValue: 'high',
          operation: 'equal'
        }
      },
      label: {
        gmail: {
          // Gmail labels require Code node, not IF node
          suggestedReplacement: 'code',
          reason: 'Gmail label checking requires array operations'
        }
      },
      rating: {
        default: {
          leftValue: '={{$json["rating"]}}',
          rightValue: 4,
          operation: 'largerEqual'
        }
      },
      status: {
        default: {
          leftValue: '={{$json["status"]}}',
          rightValue: 'active',
          operation: 'equal'
        }
      },
      amount: {
        default: {
          leftValue: '={{$json["amount"]}}',
          rightValue: 100,
          operation: 'largerThan'
        }
      }
    };
  }

  /**
   * Fix condition based on context
   */
  fixConditionBasedOnContext(node, previousNode, workflowContext = {}) {
    logger.info(`🔧 ConditionFixer: Analyzing condition for node "${node.name}"`);
    
    const nodeName = node.name.toLowerCase();
    const previousNodeType = previousNode?.type || '';
    const workflowName = workflowContext.workflowName?.toLowerCase() || '';
    
    // Detect the intent based on node name
    const intent = this.detectIntent(nodeName, workflowName);
    logger.info(`  🎯 Detected intent: ${intent}`);
    
    // Get source context (Gmail, Sheets, etc.)
    const sourceContext = this.getSourceContext(previousNodeType);
    logger.info(`  📋 Source context: ${sourceContext}`);
    
    // Generate appropriate condition
    const condition = this.generateCondition(intent, sourceContext, node, previousNode);
    
    if (condition.suggestedReplacement) {
      logger.warn(`  ⚠️ Suggestion: Replace IF node with ${condition.suggestedReplacement} node - ${condition.reason}`);
      return {
        replace: true,
        nodeType: condition.suggestedReplacement,
        reason: condition.reason,
        condition: null
      };
    }
    
    logger.info(`  ✅ Generated condition:`, condition);
    return {
      replace: false,
      condition: condition
    };
  }

  /**
   * Detect intent from node name and workflow context
   */
  detectIntent(nodeName, workflowName) {
    const combinedText = `${nodeName} ${workflowName}`;
    
    // Check for specific keywords
    if (combinedText.includes('urgent') || combinedText.includes('emergency')) {
      return 'urgent';
    }
    if (combinedText.includes('priority') || combinedText.includes('important')) {
      return 'priority';
    }
    if (combinedText.includes('label') || combinedText.includes('tag')) {
      return 'label';
    }
    if (combinedText.includes('rating') || combinedText.includes('score') || combinedText.includes('stars')) {
      return 'rating';
    }
    if (combinedText.includes('status') || combinedText.includes('state')) {
      return 'status';
    }
    if (combinedText.includes('amount') || combinedText.includes('price') || combinedText.includes('cost')) {
      return 'amount';
    }
    if (combinedText.includes('contains') || combinedText.includes('includes')) {
      return 'contains';
    }
    if (combinedText.includes('equals') || combinedText.includes('matches')) {
      return 'equals';
    }
    
    return 'default';
  }

  /**
   * Get source context from previous node type
   */
  getSourceContext(previousNodeType) {
    if (previousNodeType.includes('gmail')) {
      return 'gmail';
    }
    if (previousNodeType.includes('googleSheets')) {
      return 'sheets';
    }
    if (previousNodeType.includes('webhook')) {
      return 'webhook';
    }
    if (previousNodeType.includes('form')) {
      return 'form';
    }
    
    return 'default';
  }

  /**
   * Generate appropriate condition based on intent and source
   */
  generateCondition(intent, sourceContext, node, previousNode) {
    // Check for pattern match
    const pattern = this.conditionPatterns[intent];
    if (pattern) {
      const contextPattern = pattern[sourceContext] || pattern.default;
      if (contextPattern) {
        return contextPattern;
      }
    }

    // Generate context-specific condition
    return this.generateContextSpecificCondition(intent, sourceContext, node, previousNode);
  }

  /**
   * Generate context-specific condition when no pattern matches
   */
  generateContextSpecificCondition(intent, sourceContext, node, previousNode) {
    const nodeName = node.name.toLowerCase();
    
    // Gmail-specific conditions
    if (sourceContext === 'gmail') {
      if (nodeName.includes('subject')) {
        return {
          leftValue: '={{$json["headers"]["subject"]}}',
          rightValue: this.extractSearchTerm(nodeName),
          operation: 'contains'
        };
      }
      if (nodeName.includes('from') || nodeName.includes('sender')) {
        return {
          leftValue: '={{$json["headers"]["from"]}}',
          rightValue: this.extractSearchTerm(nodeName),
          operation: 'contains'
        };
      }
      if (nodeName.includes('attachment')) {
        return {
          leftValue: '={{$json["attachments"].length}}',
          rightValue: 0,
          operation: 'largerThan'
        };
      }
    }

    // Sheets-specific conditions
    if (sourceContext === 'sheets') {
      // Try to extract column name from node name
      const columnName = this.extractColumnName(nodeName);
      return {
        leftValue: `={{$json["${columnName}"]}}`,
        rightValue: this.extractSearchTerm(nodeName),
        operation: this.detectOperation(nodeName)
      };
    }

    // Webhook/Form-specific conditions
    if (sourceContext === 'webhook' || sourceContext === 'form') {
      const fieldName = this.extractFieldName(nodeName);
      return {
        leftValue: `={{$json["${fieldName}"]}}`,
        rightValue: this.extractSearchTerm(nodeName),
        operation: this.detectOperation(nodeName)
      };
    }

    // Default fallback - but try to be smart about field names
    const fieldName = this.extractFieldName(nodeName);
    return {
      leftValue: `={{$json["${fieldName}"]}}`,
      rightValue: this.extractSearchTerm(nodeName),
      operation: this.detectOperation(nodeName)
    };
  }

  /**
   * Extract search term from node name
   */
  extractSearchTerm(nodeName) {
    // Remove common words and extract meaningful terms
    const cleanName = nodeName
      .replace(/check|if|when|contains|equals|matches|is/g, '')
      .trim();
    
    // Look for quoted strings
    const quotedMatch = cleanName.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      return quotedMatch[1];
    }
    
    // Extract last word as likely search term
    const words = cleanName.split(/\s+/).filter(w => w.length > 0);
    return words[words.length - 1] || 'value';
  }

  /**
   * Extract field name from node name
   */
  extractFieldName(nodeName) {
    // Common field patterns
    if (nodeName.includes('subject')) return 'subject';
    if (nodeName.includes('title')) return 'title';
    if (nodeName.includes('name')) return 'name';
    if (nodeName.includes('email')) return 'email';
    if (nodeName.includes('status')) return 'status';
    if (nodeName.includes('priority')) return 'priority';
    if (nodeName.includes('rating')) return 'rating';
    if (nodeName.includes('amount')) return 'amount';
    if (nodeName.includes('price')) return 'price';
    if (nodeName.includes('type')) return 'type';
    if (nodeName.includes('category')) return 'category';
    
    // Extract from patterns like "check_field_name"
    const underscoreMatch = nodeName.match(/check[_\s]+([a-zA-Z]+)/);
    if (underscoreMatch) {
      return underscoreMatch[1];
    }
    
    // Default to a common field name
    return 'value';
  }

  /**
   * Extract column name for sheets
   */
  extractColumnName(nodeName) {
    // Look for common column patterns
    const columnPatterns = [
      'name', 'email', 'status', 'priority', 'amount', 'date', 
      'title', 'description', 'category', 'type', 'id'
    ];
    
    for (const pattern of columnPatterns) {
      if (nodeName.includes(pattern)) {
        return pattern;
      }
    }
    
    return 'value';
  }

  /**
   * Detect operation from node name
   */
  detectOperation(nodeName) {
    if (nodeName.includes('contains') || nodeName.includes('includes')) {
      return 'contains';
    }
    if (nodeName.includes('starts') || nodeName.includes('begins')) {
      return 'startsWith';
    }
    if (nodeName.includes('ends')) {
      return 'endsWith';
    }
    if (nodeName.includes('greater') || nodeName.includes('more') || nodeName.includes('>')) {
      return 'largerThan';
    }
    if (nodeName.includes('less') || nodeName.includes('<')) {
      return 'smallerThan';
    }
    if (nodeName.includes('not') && nodeName.includes('equal')) {
      return 'notEqual';
    }
    
    return 'equal';
  }

  /**
   * Check if array operations are needed (suggest Code node)
   */
  shouldUseCodeNode(intent, sourceContext, nodeName) {
    // Gmail label checking requires array operations
    if (sourceContext === 'gmail' && (intent === 'label' || nodeName.includes('label'))) {
      return {
        suggested: true,
        reason: 'Gmail label checking requires array operations - use Code node with: return items.filter(item => item.json.labelIds?.includes("LABEL_NAME"))'
      };
    }
    
    // Any array length checking
    if (nodeName.includes('count') || nodeName.includes('length') || nodeName.includes('multiple')) {
      return {
        suggested: true,
        reason: 'Array operations are better handled with Code node'
      };
    }
    
    return { suggested: false };
  }
}

export const conditionFixer = new ConditionFixer();