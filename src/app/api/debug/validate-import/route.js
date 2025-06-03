import { NextResponse } from "next/server";
import { workflowValidator } from "@/lib/validation/workflowValidator";

export async function POST(req) {
  try {
    const { workflow } = await req.json();
    
    // Check for common n8n import issues
    const issues = [];
    
    // Check for non-standard fields
    const allowedFields = ['name', 'nodes', 'connections', 'settings', 'meta', 
                           'versionId', 'pinData', 'staticData', 'tags', 'active',
                           'id', 'triggerCount', 'createdAt', 'updatedAt'];
    
    Object.keys(workflow).forEach(key => {
      if (!allowedFields.includes(key)) {
        issues.push(`Non-standard field found: ${key}`);
      }
    });
    
    // Check nodes
    workflow.nodes?.forEach((node, i) => {
      // Check for webhookId (common issue)
      if (node.webhookId) {
        issues.push(`Node ${node.name || i} has non-standard webhookId field`);
      }
      
      // Check Gmail trigger
      if (node.type === 'n8n-nodes-base.gmailTrigger') {
        if (node.parameters?.label && !node.parameters?.labelIds) {
          issues.push(`Gmail trigger using 'label' instead of 'labelIds'`);
        }
      }
      
      // Check node ID format
      if (!node.id || node.id.length < 6) {
        issues.push(`Node ${node.name || i} has invalid ID (should be 6+ chars)`);
      }
      
      // Check Set node
      if (node.type === 'n8n-nodes-base.set') {
        if (node.parameters?.keepOnlySet !== undefined) {
          issues.push(`Set node ${node.name || i} has keepOnlySet at root level - should be inside options`);
        }
        
        if (node.parameters?.options?.dotNotation !== undefined) {
          issues.push(`Set node ${node.name || i} has invalid dotNotation option`);
        }
      }
      
      // Check RespondToWebhook
      if (node.type === 'n8n-nodes-base.respondToWebhook') {
        if (node.parameters?.options?.responseCode !== undefined) {
          issues.push(`RespondToWebhook node ${node.name || i} has responseCode in options - should be at root level`);
        }
        
        if (typeof node.parameters?.responseCode === 'string' && node.parameters.responseCode.includes('{{')) {
          issues.push(`RespondToWebhook node ${node.name || i} has expression for responseCode - should be number`);
        }
      }
      
      // Check Webhook
      if (node.type === 'n8n-nodes-base.webhook') {
        if (node.parameters?.options?.responseData !== undefined) {
          issues.push(`Webhook node ${node.name || i} has invalid responseData in options`);
        }
        
        const validOptions = ['responseHeaders', 'rawBody'];
        Object.keys(node.parameters?.options || {}).forEach(opt => {
          if (!validOptions.includes(opt)) {
            issues.push(`Webhook node ${node.name || i} has invalid option: ${opt}`);
          }
        });
      }
      
      // Check for non-standard fields in node
      const standardNodeFields = ['id', 'name', 'type', 'typeVersion', 'position', 'parameters', 'credentials'];
      Object.keys(node).forEach(field => {
        if (!standardNodeFields.includes(field)) {
          issues.push(`Node ${node.name || i} has non-standard field: ${field}`);
        }
      });
    });
    
    // Get formal validation results
    const validationResult = await workflowValidator.validateWorkflow('n8n', workflow);
    
    return NextResponse.json({
      valid: issues.length === 0 && validationResult.isValid,
      importIssues: issues,
      validationResult,
      workflow
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}