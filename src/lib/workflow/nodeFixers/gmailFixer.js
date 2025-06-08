// src/lib/workflow/nodeFixers/gmailFixer.js
import { logger } from '@/lib/utils/logger';

/**
 * Specialized fixer for Gmail-related workflow issues
 */
export class GmailFixer {
  constructor() {
    // Gmail field mapping - how fields appear in n8n Gmail trigger output
    this.gmailFieldMap = {
      'subject': 'headers.subject',
      'from': 'headers.from', 
      'to': 'headers.to',
      'date': 'headers.date',
      'body': 'textPlain',
      'html': 'textHtml',
      'attachments': 'attachments',
      'messageId': 'id',
      'threadId': 'threadId',
      'labels': 'labelIds'
    };
  }

  /**
   * Fix Gmail-related workflow patterns
   */
  fixGmailWorkflow(workflow) {
    logger.info('🔧 GmailFixer: Analyzing Gmail workflow patterns');
    
    const fixes = [];
    const nodes = workflow.nodes || [];
    
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const previousNode = i > 0 ? nodes[i - 1] : null;
      
      // Check for Gmail → IF node patterns
      if (this.isGmailToIfPattern(previousNode, node)) {
        const fix = this.fixGmailIfNode(node, previousNode, workflow);
        if (fix) {
          fixes.push(fix);
        }
      }
      
      // Check for label checking patterns
      if (this.isLabelCheckPattern(node, previousNode)) {
        const fix = this.fixLabelCheckPattern(node, previousNode, workflow);
        if (fix) {
          fixes.push(fix);
        }
      }
    }
    
    // Apply fixes
    this.applyFixes(workflow, fixes);
    
    return {
      fixesApplied: fixes.length,
      fixes: fixes
    };
  }

  /**
   * Check if this is a Gmail → IF node pattern
   */
  isGmailToIfPattern(previousNode, currentNode) {
    return previousNode?.type?.includes('gmail') && 
           currentNode?.type === 'n8n-nodes-base.if';
  }

  /**
   * Check if this is a label checking pattern
   */
  isLabelCheckPattern(node, previousNode) {
    if (!previousNode?.type?.includes('gmail')) return false;
    
    const nodeName = node.name?.toLowerCase() || '';
    return nodeName.includes('label') || 
           nodeName.includes('tag') ||
           (node.type === 'n8n-nodes-base.if' && this.hasLabelCondition(node));
  }

  /**
   * Check if IF node has label-related conditions
   */
  hasLabelCondition(node) {
    const conditions = node.parameters?.conditions?.conditions || [];
    return conditions.some(condition => 
      condition.leftValue?.includes('label') ||
      condition.leftValue?.includes('tag')
    );
  }

  /**
   * Fix Gmail IF node with proper field references
   */
  fixGmailIfNode(node, previousNode, workflow) {
    logger.info(`🔧 Fixing Gmail IF node: ${node.name}`);
    
    const nodeName = node.name.toLowerCase();
    const conditions = node.parameters?.conditions?.conditions || [];
    
    if (conditions.length === 0) {
      // Create condition based on node name
      const newCondition = this.createGmailConditionFromName(nodeName);
      node.parameters.conditions.conditions = [newCondition];
      
      return {
        type: 'gmail_if_condition_created',
        node: node.name,
        condition: newCondition,
        description: `Created Gmail-specific condition for ${node.name}`
      };
    }
    
    // Fix existing conditions
    let fixed = false;
    for (const condition of conditions) {
      if (this.fixGmailCondition(condition)) {
        fixed = true;
      }
    }
    
    if (fixed) {
      return {
        type: 'gmail_if_condition_fixed',
        node: node.name,
        description: `Fixed Gmail field references in ${node.name}`
      };
    }
    
    return null;
  }

  /**
   * Create Gmail condition based on node name
   */
  createGmailConditionFromName(nodeName) {
    // Urgent email check
    if (nodeName.includes('urgent') || nodeName.includes('emergency')) {
      return {
        leftValue: '={{$json["headers"]["subject"]}}',
        rightValue: 'urgent',
        operation: 'contains'
      };
    }
    
    // Priority email check
    if (nodeName.includes('priority') || nodeName.includes('important')) {
      return {
        leftValue: '={{$json["headers"]["subject"]}}',
        rightValue: 'priority',
        operation: 'contains'
      };
    }
    
    // VIP sender check
    if (nodeName.includes('vip') || nodeName.includes('important')) {
      return {
        leftValue: '={{$json["headers"]["from"]}}',
        rightValue: 'vip',
        operation: 'contains'
      };
    }
    
    // Attachment check
    if (nodeName.includes('attachment') || nodeName.includes('file')) {
      return {
        leftValue: '={{$json["attachments"].length}}',
        rightValue: 0,
        operation: 'largerThan'
      };
    }
    
    // Subject contains check (default)
    return {
      leftValue: '={{$json["headers"]["subject"]}}',
      rightValue: this.extractKeywordFromName(nodeName),
      operation: 'contains'
    };
  }

  /**
   * Fix Gmail condition to use proper field references
   */
  fixGmailCondition(condition) {
    let fixed = false;
    
    // Fix generic field references
    if (condition.leftValue?.includes('$json["field"]')) {
      condition.leftValue = '={{$json["headers"]["subject"]}}';
      fixed = true;
    }
    
    // Fix common Gmail field references
    const leftValue = condition.leftValue || '';
    
    // Map simple field names to Gmail structure
    for (const [simple, gmail] of Object.entries(this.gmailFieldMap)) {
      const pattern = new RegExp(`\\$json\\["${simple}"\\]`, 'g');
      if (pattern.test(leftValue)) {
        condition.leftValue = leftValue.replace(pattern, `$json["${gmail}"]`);
        fixed = true;
      }
    }
    
    return fixed;
  }

  /**
   * Fix label checking pattern - replace IF with Code node
   */
  fixLabelCheckPattern(node, previousNode, workflow) {
    logger.info(`🔧 Replacing label check IF node with Code node: ${node.name}`);
    
    // Create Code node to replace IF node
    const codeNode = this.createLabelCheckCodeNode(node);
    
    // Replace the node in workflow
    const nodeIndex = workflow.nodes.findIndex(n => n.id === node.id);
    if (nodeIndex !== -1) {
      workflow.nodes[nodeIndex] = codeNode;
      
      // Update connections
      this.updateConnectionsForReplacedNode(workflow, node.name, codeNode.name);
      
      return {
        type: 'label_check_replaced',
        originalNode: node.name,
        newNode: codeNode.name,
        description: `Replaced IF node with Code node for Gmail label checking`
      };
    }
    
    return null;
  }

  /**
   * Create Code node for label checking
   */
  createLabelCheckCodeNode(originalNode) {
    const nodeName = originalNode.name;
    const labelName = this.extractLabelFromName(nodeName);
    
    const codeNode = {
      ...originalNode,
      type: 'n8n-nodes-base.code',
      name: nodeName.replace(/check|if/gi, 'Filter'),
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: `// Filter items by Gmail label
return items.filter(item => {
  const labels = item.json.labelIds || [];
  return labels.includes('${labelName}');
});`
      }
    };
    
    return codeNode;
  }

  /**
   * Extract label name from node name
   */
  extractLabelFromName(nodeName) {
    // Look for common label patterns
    if (nodeName.toLowerCase().includes('inbox')) return 'INBOX';
    if (nodeName.toLowerCase().includes('sent')) return 'SENT';
    if (nodeName.toLowerCase().includes('draft')) return 'DRAFT';
    if (nodeName.toLowerCase().includes('important')) return 'IMPORTANT';
    if (nodeName.toLowerCase().includes('starred')) return 'STARRED';
    
    // Extract custom label (assuming format like "Check Label: CustomLabel")
    const labelMatch = nodeName.match(/label[:\s]+([A-Za-z_]+)/i);
    if (labelMatch) {
      return labelMatch[1].toUpperCase();
    }
    
    return 'INBOX'; // Default fallback
  }

  /**
   * Extract keyword from node name for search
   */
  extractKeywordFromName(nodeName) {
    // Remove common words
    const cleanName = nodeName
      .replace(/check|if|when|contains|email|gmail/gi, '')
      .trim();
    
    // Look for quoted strings
    const quotedMatch = cleanName.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      return quotedMatch[1];
    }
    
    // Use remaining text or default
    return cleanName || 'keyword';
  }

  /**
   * Update connections when a node is replaced
   */
  updateConnectionsForReplacedNode(workflow, oldNodeName, newNodeName) {
    const connections = workflow.connections || {};
    
    // Update outgoing connections
    if (connections[oldNodeName]) {
      connections[newNodeName] = connections[oldNodeName];
      delete connections[oldNodeName];
    }
    
    // Update incoming connections
    for (const [sourceNode, outputs] of Object.entries(connections)) {
      if (outputs.main) {
        outputs.main = outputs.main.map(outputArray => {
          return outputArray.map(connection => {
            if (connection.node === oldNodeName) {
              return { ...connection, node: newNodeName };
            }
            return connection;
          });
        });
      }
    }
  }

  /**
   * Apply all fixes to the workflow
   */
  applyFixes(workflow, fixes) {
    logger.info(`🔧 GmailFixer: Applied ${fixes.length} fixes`);
    
    for (const fix of fixes) {
      logger.info(`  ✅ ${fix.type}: ${fix.description}`);
    }
  }

  /**
   * Get Gmail field structure examples for prompts
   */
  getGmailExamples() {
    return {
      fieldStructure: {
        "headers": {
          "subject": "Email subject line",
          "from": "sender@example.com", 
          "to": "recipient@example.com",
          "date": "2025-01-01T00:00:00Z"
        },
        "textPlain": "Email body text",
        "textHtml": "Email body HTML",
        "attachments": [
          {
            "id": "attachment123",
            "filename": "document.pdf",
            "mimeType": "application/pdf"
          }
        ],
        "labelIds": ["INBOX", "IMPORTANT"],
        "id": "message123",
        "threadId": "thread123"
      },
      commonConditions: {
        urgentEmail: {
          leftValue: '={{$json["headers"]["subject"]}}',
          rightValue: 'urgent',
          operation: 'contains'
        },
        hasAttachments: {
          leftValue: '={{$json["attachments"].length}}',
          rightValue: 0,
          operation: 'largerThan'
        },
        fromVIP: {
          leftValue: '={{$json["headers"]["from"]}}',
          rightValue: 'vip@company.com',
          operation: 'contains'
        }
      },
      labelChecking: {
        useCodeNode: true,
        example: `// Use Code node for label checking
return items.filter(item => {
  const labels = item.json.labelIds || [];
  return labels.includes('IMPORTANT');
});`
      }
    };
  }
}

export const gmailFixer = new GmailFixer();