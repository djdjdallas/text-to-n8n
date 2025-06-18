// src/lib/validation/structureValidator.js
import { logger } from '@/lib/utils/logger';

/**
 * Validates workflow structure and catches common issues
 */
export class StructureValidator {
  constructor() {
    // Common invalid patterns to detect
    this.invalidPatterns = {
      genericPlaceholders: [
        /\$json\["field"\]/g,
        /\$json\['field'\]/g,
        /\$json\.field(?!name|Name|_)/g, // field but not fieldname/fieldName/field_
        /\{\{\$json\["field"\]\}\}/g
      ],
      emptyConditions: [
        /conditions:\s*\[\]/g,
        /conditions:\s*{}/g
      ],
      invalidGmailFields: [
        /\$json\["email"\]/g, // Should be headers.from
        /\$json\["from"\]/g,  // Should be headers.from
        /\$json\["subject"\]/g // Should be headers.subject
      ]
    };
  }

  /**
   * Validate entire workflow structure
   */
  validateWorkflowStructure(workflow) {
    logger.info('🔍 StructureValidator: Validating workflow structure');
    
    const issues = [];
    const warnings = [];
    
    // Validate basic structure
    const basicValidation = this.validateBasicStructure(workflow);
    issues.push(...basicValidation.errors);
    warnings.push(...basicValidation.warnings);
    
    // Validate nodes
    if (workflow.nodes) {
      for (let i = 0; i < workflow.nodes.length; i++) {
        const node = workflow.nodes[i];
        const previousNode = i > 0 ? workflow.nodes[i - 1] : null;
        
        const nodeValidation = this.validateNode(node, previousNode, workflow);
        issues.push(...nodeValidation.errors);
        warnings.push(...nodeValidation.warnings);
      }
    }
    
    // Validate connections
    const connectionValidation = this.validateConnections(workflow);
    issues.push(...connectionValidation.errors);
    warnings.push(...connectionValidation.warnings);
    
    return {
      valid: issues.length === 0,
      errors: issues,
      warnings: warnings,
      summary: {
        totalIssues: issues.length,
        totalWarnings: warnings.length,
        criticalIssues: issues.filter(i => i.severity === 'critical').length
      }
    };
  }

  /**
   * Validate basic workflow structure
   */
  validateBasicStructure(workflow) {
    const errors = [];
    const warnings = [];
    
    if (!workflow.name) {
      warnings.push({
        type: 'missing_name',
        message: 'Workflow is missing a name',
        severity: 'low'
      });
    }
    
    if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
      errors.push({
        type: 'invalid_nodes',
        message: 'Workflow must have a nodes array',
        severity: 'critical'
      });
    }
    
    if (!workflow.connections || typeof workflow.connections !== 'object') {
      warnings.push({
        type: 'missing_connections',
        message: 'Workflow should have connections object',
        severity: 'medium'
      });
    }
    
    return { errors, warnings };
  }

  /**
   * Validate individual node
   */
  validateNode(node, previousNode, workflow) {
    const errors = [];
    const warnings = [];
    
    // Basic node validation
    if (!node.id) {
      errors.push({
        type: 'missing_node_id',
        node: node.name,
        message: 'Node is missing required ID',
        severity: 'critical'
      });
    }
    
    if (!node.type) {
      errors.push({
        type: 'missing_node_type',
        node: node.name,
        message: 'Node is missing required type',
        severity: 'critical'
      });
    }
    
    // Validate IF nodes specifically
    if (node.type === 'n8n-nodes-base.if') {
      const ifValidation = this.validateIfNode(node, previousNode);
      errors.push(...ifValidation.errors);
      warnings.push(...ifValidation.warnings);
    }
    
    // Validate Gmail nodes
    if (node.type?.includes('gmail')) {
      const gmailValidation = this.validateGmailNode(node);
      errors.push(...gmailValidation.errors);
      warnings.push(...gmailValidation.warnings);
    }
    
    return { errors, warnings };
  }

  /**
   * Validate IF node conditions
   */
  validateIfNode(node, previousNode) {
    logger.info(`🔍 Validating IF node: ${node.name}`);
    
    const errors = [];
    const warnings = [];
    const conditions = node.parameters?.conditions?.conditions || [];
    
    if (conditions.length === 0) {
      errors.push({
        type: 'empty_if_conditions',
        node: node.name,
        message: 'IF node has no conditions',
        severity: 'critical'
      });
      return { errors, warnings };
    }
    
    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      const conditionValidation = this.validateIfCondition(condition, node, previousNode, i);
      errors.push(...conditionValidation.errors);
      warnings.push(...conditionValidation.warnings);
    }
    
    return { errors, warnings };
  }

  /**
   * Validate Gmail node
   */
  validateGmailNode(node) {
    const errors = [];
    const warnings = [];
    
    // Check for generic field references in Gmail nodes
    const nodeStr = JSON.stringify(node);
    if (nodeStr.includes('$json["field"]')) {
      errors.push({
        node: node.name,
        type: 'gmail_generic_field',
        message: 'Gmail node contains generic field reference instead of proper Gmail structure',
        severity: 'high',
        suggestion: 'Use proper Gmail field references like $json["headers"]["subject"] or $json["headers"]["from"]'
      });
    }
    
    // Check for invalid Gmail field patterns
    for (const pattern of this.invalidPatterns.invalidGmailFields) {
      if (pattern.test(nodeStr)) {
        errors.push({
          node: node.name,
          type: 'invalid_gmail_field_reference',
          message: 'Gmail node uses incorrect field reference pattern',
          severity: 'high',
          suggestion: 'Gmail fields should be accessed via headers object: $json["headers"]["fieldname"]'
        });
      }
    }
    
    return { errors, warnings };
  }

  /**
   * Validate individual IF condition
   */
  validateIfCondition(condition, node, previousNode, index) {
    const errors = [];
    const warnings = [];
    
    // Check for generic placeholders
    if (condition.leftValue) {
      for (const pattern of this.invalidPatterns.genericPlaceholders) {
        if (pattern.test(condition.leftValue)) {
          errors.push({
            type: 'generic_placeholder',
            node: node.name,
            condition: index,
            message: `IF node condition ${index + 1} contains generic placeholder instead of specific field reference`,
            currentValue: condition.leftValue,
            severity: 'critical',
            fix: this.suggestFieldFix(condition.leftValue, previousNode)
          });
        }
      }
    }
    
    // Validate based on previous node context
    if (previousNode) {
      const contextValidation = this.validateConditionContext(condition, node, previousNode, index);
      errors.push(...contextValidation.errors);
      warnings.push(...contextValidation.warnings);
    }
    
    // Check for empty leftValue
    if (!condition.leftValue || condition.leftValue.trim() === '') {
      errors.push({
        type: 'empty_left_value',
        node: node.name,
        condition: index,
        message: `IF node condition ${index + 1} has empty leftValue`,
        severity: 'critical'
      });
    }
    
    // Check for invalid operations
    const validOperations = [
      'equal', 'notEqual', 'contains', 'notContains', 'startsWith', 
      'notStartsWith', 'endsWith', 'notEndsWith', 'regex', 'notRegex', 
      'larger', 'largerEqual', 'smaller', 'smallerEqual', 'exists', 'notExists'
    ];
    
    if (!validOperations.includes(condition.operation)) {
      errors.push({
        type: 'invalid_operation',
        node: node.name,
        condition: index,
        message: `IF node condition ${index + 1} has invalid operation: ${condition.operation}`,
        severity: 'high',
        validOperations: validOperations
      });
    }
    
    return { errors, warnings };
  }

  /**
   * Validate condition based on previous node context
   */
  validateConditionContext(condition, node, previousNode, index) {
    const errors = [];
    const warnings = [];
    
    // Gmail-specific validation
    if (previousNode.type?.includes('gmail')) {
      const gmailValidation = this.validateGmailCondition(condition, node, index);
      errors.push(...gmailValidation.errors);
      warnings.push(...gmailValidation.warnings);
    }
    
    // Google Sheets validation
    if (previousNode.type?.includes('googleSheets')) {
      const sheetsValidation = this.validateSheetsCondition(condition, node, index);
      errors.push(...sheetsValidation.errors);
      warnings.push(...sheetsValidation.warnings);
    }
    
    return { errors, warnings };
  }

  /**
   * Validate Gmail-specific conditions
   */
  validateGmailCondition(condition, node, index) {
    const errors = [];
    const warnings = [];
    
    // Check for invalid Gmail field references
    for (const pattern of this.invalidPatterns.invalidGmailFields) {
      if (pattern.test(condition.leftValue)) {
        errors.push({
          type: 'invalid_gmail_field',
          node: node.name,
          condition: index,
          message: `Gmail IF condition uses invalid field reference: ${condition.leftValue}`,
          currentValue: condition.leftValue,
          severity: 'high',
          fix: this.suggestGmailFieldFix(condition.leftValue)
        });
      }
    }
    
    // Check for label operations (should use Code node)
    if (condition.leftValue?.includes('label') && node.name.toLowerCase().includes('label')) {
      warnings.push({
        type: 'gmail_label_check',
        node: node.name,
        condition: index,
        message: 'Gmail label checking should use Code node instead of IF node',
        severity: 'medium',
        suggestion: 'Replace with Code node using: return items.filter(item => item.json.labelIds?.includes("LABEL_NAME"))'
      });
    }
    
    return { errors, warnings };
  }

  /**
   * Validate Google Sheets conditions
   */
  validateSheetsCondition(condition, node, index) {
    const errors = [];
    const warnings = [];
    
    // Check for common Sheets field patterns
    if (condition.leftValue?.includes('$json["field"]')) {
      warnings.push({
        type: 'sheets_generic_field',
        node: node.name,
        condition: index,
        message: 'Google Sheets condition should reference specific column names',
        severity: 'medium',
        suggestion: 'Use actual column names like $json["Name"] or $json["Email"]'
      });
    }
    
    return { errors, warnings };
  }

  /**
   * Validate workflow connections
   */
  validateConnections(workflow) {
    const errors = [];
    const warnings = [];
    
    if (!workflow.connections) {
      return { errors, warnings };
    }
    
    const nodeNames = new Set(workflow.nodes?.map(n => n.name) || []);
    
    // Check for connections to non-existent nodes
    for (const [sourceName, outputs] of Object.entries(workflow.connections)) {
      if (!nodeNames.has(sourceName)) {
        errors.push({
          type: 'invalid_source_connection',
          message: `Connection source "${sourceName}" does not exist`,
          severity: 'high'
        });
        continue;
      }
      
      if (outputs.main) {
        for (const outputArray of outputs.main) {
          if (Array.isArray(outputArray)) {
            for (const connection of outputArray) {
              if (!nodeNames.has(connection.node)) {
                errors.push({
                  type: 'invalid_target_connection',
                  message: `Connection target "${connection.node}" does not exist`,
                  severity: 'high'
                });
              }
            }
          }
        }
      }
    }
    
    return { errors, warnings };
  }

  /**
   * Suggest field fix based on context
   */
  suggestFieldFix(currentValue, previousNode) {
    if (!previousNode) {
      return 'Use specific field name instead of generic "field"';
    }
    
    if (previousNode.type?.includes('gmail')) {
      return 'For Gmail: use $json["headers"]["subject"], $json["headers"]["from"], etc.';
    }
    
    if (previousNode.type?.includes('googleSheets')) {
      return 'For Google Sheets: use column names like $json["Name"], $json["Email"]';
    }
    
    if (previousNode.type?.includes('webhook')) {
      return 'For Webhook: use form field names like $json["name"], $json["email"]';
    }
    
    return 'Use specific field name relevant to your data';
  }

  /**
   * Suggest Gmail field fix
   */
  suggestGmailFieldFix(currentValue) {
    if (currentValue.includes('email') || currentValue.includes('from')) {
      return 'Use $json["headers"]["from"] for Gmail sender';
    }
    
    if (currentValue.includes('subject')) {
      return 'Use $json["headers"]["subject"] for Gmail subject';
    }
    
    return 'Use proper Gmail field structure: $json["headers"]["fieldname"]';
  }

  /**
   * Get validation summary
   */
  getValidationSummary(result) {
    return {
      valid: result.valid,
      totalIssues: result.summary.totalIssues,
      criticalIssues: result.summary.criticalIssues,
      fixableIssues: result.errors.filter(e => e.fix).length,
      topIssues: result.errors
        .sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity))
        .slice(0, 5)
    };
  }

  /**
   * Get severity weight for sorting
   */
  getSeverityWeight(severity) {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    return weights[severity] || 0;
  }
}

export const structureValidator = new StructureValidator();