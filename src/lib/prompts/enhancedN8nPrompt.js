// src/lib/prompts/enhancedN8nPrompt.js
import { logger } from '@/lib/utils/logger';

/**
 * Enhanced n8n-specific prompt generation with detailed node examples
 */
export class EnhancedN8nPrompt {
  constructor() {
    this.nodeExamples = this.initializeNodeExamples();
    this.commonPatterns = this.initializeCommonPatterns();
  }

  /**
   * Generate enhanced prompt for n8n workflow creation
   */
  generatePrompt(userInput, context = {}) {
    logger.info('🎯 Generating enhanced n8n prompt');
    
    const sections = [
      this.getSystemInstructions(),
      this.getNodeSpecificExamples(context),
      this.getCommonPatternsSection(),
      this.getValidationRules(),
      this.getUserRequestSection(userInput),
      this.getOutputInstructions()
    ];
    
    return sections.join('\n\n');
  }

  /**
   * Get system instructions
   */
  getSystemInstructions() {
    return `# n8n Workflow Generator - Enhanced Instructions

You are an expert n8n workflow generator. Create valid, importable n8n workflows with proper node configurations and field references.

## CRITICAL REQUIREMENTS:
1. Use SPECIFIC field references, never generic placeholders like {{$json["field"]}}
2. Reference actual data structure from previous nodes
3. IF nodes must have meaningful conditions based on real data fields
4. Gmail conditions must use correct field structure (headers.subject, headers.from, etc.)
5. Array operations (like Gmail labels) should use Code nodes, not IF nodes`;
  }

  /**
   * Get node-specific examples
   */
  getNodeSpecificExamples(context) {
    const examples = [];
    
    // Always include Gmail examples since it's commonly used
    examples.push(this.getGmailExamples());
    
    // Add Google Sheets examples
    examples.push(this.getGoogleSheetsExamples());
    
    // Add IF node examples
    examples.push(this.getIfNodeExamples());
    
    // Add Code node examples for array operations
    examples.push(this.getCodeNodeExamples());
    
    return examples.join('\n\n');
  }

  /**
   * Gmail-specific examples and field structure
   */
  getGmailExamples() {
    return `## Gmail Node Examples and Field Structure

### Gmail Trigger Output Structure:
\`\`\`json
{
  "headers": {
    "subject": "Email subject line",
    "from": "sender@example.com",
    "to": "recipient@example.com", 
    "date": "2025-01-01T00:00:00Z"
  },
  "textPlain": "Email body as plain text",
  "textHtml": "<p>Email body as HTML</p>",
  "attachments": [
    {
      "id": "attachment123",
      "filename": "document.pdf",
      "mimeType": "application/pdf",
      "size": 12345
    }
  ],
  "labelIds": ["INBOX", "IMPORTANT", "CUSTOM_LABEL"],
  "id": "message123",
  "threadId": "thread123"
}
\`\`\`

### Gmail IF Node Examples:

#### Check Subject Contains Text:
\`\`\`json
{
  "type": "n8n-nodes-base.if",
  "parameters": {
    "conditions": {
      "conditions": [{
        "leftValue": "={{$json[\\"headers\\"][\\"subject\\"]}}",
        "rightValue": "urgent",
        "operation": "contains"
      }]
    }
  }
}
\`\`\`

#### Check for VIP Sender:
\`\`\`json
{
  "conditions": {
    "conditions": [{
      "leftValue": "={{$json[\\"headers\\"][\\"from\\"]}}",
      "rightValue": "vip@company.com", 
      "operation": "contains"
    }]
  }
}
\`\`\`

#### Check for Attachments:
\`\`\`json
{
  "conditions": {
    "conditions": [{
      "leftValue": "={{$json[\\"attachments\\"].length}}",
      "rightValue": 0,
      "operation": "largerThan"
    }]
  }
}
\`\`\`

### Gmail Label Checking - USE CODE NODE:
For Gmail triggers checking labels, use Code node instead of IF node:
\`\`\`json
{
  "type": "n8n-nodes-base.code",
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "// Filter emails by label\\nreturn items.filter(item => {\\n  const labels = item.json.labelIds || [];\\n  return labels.includes('IMPORTANT');\\n});"
  }
}
\`\`\`

### WRONG Gmail Examples (DO NOT USE):
❌ \`"leftValue": "={{$json[\\"from\\"]}}"\` (should be headers.from)
❌ \`"leftValue": "={{$json[\\"subject\\"]}}"\` (should be headers.subject)  
❌ \`"leftValue": "={{$json[\\"email\\"]}}"\` (field doesn't exist)
❌ Using IF node for label checking (use Code node)`;
  }

  /**
   * Google Sheets examples
   */
  getGoogleSheetsExamples() {
    return `## Google Sheets Examples

### Google Sheets Trigger Output Structure:
\`\`\`json
{
  "Name": "John Doe",
  "Email": "john@example.com",
  "Status": "Active",
  "Priority": "High",
  "Amount": 100,
  "Date": "2025-01-01"
}
\`\`\`

### Sheets IF Node Examples:

#### Check Status Column:
\`\`\`json
{
  "conditions": {
    "conditions": [{
      "leftValue": "={{$json[\\"Status\\"]}}",
      "rightValue": "Active",
      "operation": "equal"
    }]
  }
}
\`\`\`

#### Check Priority Level:
\`\`\`json
{
  "conditions": {
    "conditions": [{
      "leftValue": "={{$json[\\"Priority\\"]}}",
      "rightValue": "High",
      "operation": "equal"
    }]
  }
}
\`\`\`

#### Check Amount Threshold:
\`\`\`json
{
  "conditions": {
    "conditions": [{
      "leftValue": "={{$json[\\"Amount\\"]}}",
      "rightValue": 100,
      "operation": "largerEqual"
    }]
  }
}
\`\`\``;
  }

  /**
   * IF node specific examples
   */
  getIfNodeExamples() {
    return `## IF Node Best Practices

### Always Use Specific Field References:
✅ CORRECT:
- \`"leftValue": "={{$json[\\"headers\\"][\\"subject\\"]}}"\` for Gmail
- \`"leftValue": "={{$json[\\"Name\\"]}}"\` for Sheets column
- \`"leftValue": "={{$json[\\"status\\"]}}"\` for webhook data

❌ WRONG:
- \`"leftValue": "={{$json[\\"field\\"]}}"\` (generic placeholder)
- \`"leftValue": "={{$json.field}}"\` (generic placeholder)

### Common IF Operations:
- \`"operation": "equal"\` - Exact match
- \`"operation": "contains"\` - Text contains substring
- \`"operation": "largerThan"\` - Numeric comparison
- \`"operation": "exists"\` - Field exists check

### Context-Specific Examples:

#### Urgent Email Check:
\`\`\`json
{
  "leftValue": "={{$json[\\"headers\\"][\\"subject\\"]}}",
  "rightValue": "urgent",
  "operation": "contains"
}
\`\`\`

#### High Priority Item:
\`\`\`json
{
  "leftValue": "={{$json[\\"priority\\"]}}",
  "rightValue": "high",
  "operation": "equal"
}
\`\`\`

#### Rating Above Threshold:
\`\`\`json
{
  "leftValue": "={{$json[\\"rating\\"]}}",
  "rightValue": 4,
  "operation": "largerEqual"
}
\`\`\``;
  }

  /**
   * Code node examples for array operations
   */
  getCodeNodeExamples() {
    return `## Code Node for Array Operations

Use Code nodes instead of IF nodes for:
- Array filtering (Gmail labels, tags, categories)
- Complex data transformations
- Multiple condition checks

### Gmail Label Filtering:
\`\`\`javascript
// Filter by single label
return items.filter(item => {
  const labels = item.json.labelIds || [];
  return labels.includes('IMPORTANT');
});

// Filter by multiple labels
return items.filter(item => {
  const labels = item.json.labelIds || [];
  return labels.includes('IMPORTANT') && labels.includes('INBOX');
});
\`\`\`

### Array Length Checks:
\`\`\`javascript
// Items with attachments
return items.filter(item => {
  const attachments = item.json.attachments || [];
  return attachments.length > 0;
});
\`\`\`

### Complex Filtering:
\`\`\`javascript
// Urgent emails from VIPs with attachments
return items.filter(item => {
  const subject = item.json.headers?.subject || '';
  const from = item.json.headers?.from || '';
  const attachments = item.json.attachments || [];
  
  return subject.toLowerCase().includes('urgent') &&
         from.includes('vip') &&
         attachments.length > 0;
});
\`\`\``;
  }

  /**
   * Common workflow patterns
   */
  getCommonPatternsSection() {
    return `## Common Workflow Patterns

### Email Processing Pattern:
1. Gmail Trigger → 2. IF (Check Subject) → 3. Slack Notification
2. Gmail Trigger → 2. Code (Filter Labels) → 3. Google Sheets Update

### Form Processing Pattern:
1. Webhook Trigger → 2. IF (Check Required Fields) → 3. Database Update
1. Webhook Trigger → 2. IF (Check Priority) → 3. Email Alert

### Data Validation Pattern:
1. Trigger → 2. IF (Validate Data) → 3a. Process Valid Data / 3b. Error Handling

### When to Use IF vs Code Nodes:
- **IF Node**: Simple field comparisons, exists checks, basic conditions
- **Code Node**: Array operations, complex logic, multiple conditions, Gmail labels`;
  }

  /**
   * Validation rules
   */
  getValidationRules() {
    return `## Validation Rules

### Field Reference Rules:
1. Gmail fields: Always use \`headers.subject\`, \`headers.from\`, etc.
2. Sheets fields: Use actual column names from your sheet
3. Webhook fields: Use actual form field names
4. NEVER use generic placeholders like \`field\`, \`value\`, \`item\`

### IF Node Rules:
1. Must have at least one condition
2. leftValue must reference actual data field
3. operation must be valid n8n operation
4. rightValue should match expected data type

### Code Node Rules:
1. Use for array operations (labels, tags, lists)
2. Always return items array
3. Handle undefined/null values safely`;
  }

  /**
   * User request section
   */
  getUserRequestSection(userInput) {
    return `## User Request:
"${userInput}"

Analyze this request and:
1. Identify the trigger type needed
2. Determine what conditions/checks are required
3. Map to specific field names (not generic placeholders)
4. Choose appropriate node types (IF vs Code)`;
  }

  /**
   * Output instructions
   */
  getOutputInstructions() {
    return `## Output Requirements:

Generate a complete n8n workflow JSON with:
1. Proper node configurations using specific field references
2. Valid IF conditions with real field names
3. Appropriate use of Code nodes for array operations
4. Correct Gmail field structure when applicable
5. Working connections between all nodes

REMEMBER: 
- NO generic placeholders like {{$json["field"]}}
- Use context-appropriate field names
- Follow the examples provided above
- Validate that conditions make sense for the data flow`;
  }

  /**
   * Initialize node examples
   */
  initializeNodeExamples() {
    return {
      gmail: this.nodeExamples?.gmail || {},
      sheets: this.nodeExamples?.sheets || {},
      webhook: this.nodeExamples?.webhook || {}
    };
  }

  /**
   * Initialize common patterns
   */
  initializeCommonPatterns() {
    return {
      emailProcessing: ['gmail', 'if', 'slack'],
      formProcessing: ['webhook', 'if', 'sheets'],
      dataValidation: ['trigger', 'if', 'process']
    };
  }

  /**
   * Get context-specific field suggestions
   */
  getFieldSuggestions(nodeType, intent) {
    const suggestions = {
      gmail: {
        urgent: 'headers.subject',
        sender: 'headers.from',
        attachment: 'attachments.length',
        label: 'labelIds (use Code node)'
      },
      sheets: {
        status: 'Status',
        priority: 'Priority', 
        name: 'Name',
        email: 'Email',
        amount: 'Amount'
      },
      webhook: {
        name: 'name',
        email: 'email',
        phone: 'phone',
        message: 'message',
        priority: 'priority'
      }
    };
    
    return suggestions[nodeType] || {};
  }
}

export const enhancedN8nPrompt = new EnhancedN8nPrompt();