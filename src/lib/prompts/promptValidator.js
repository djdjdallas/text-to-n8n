export class PromptValidator {
  constructor() {
    this.integrationPatterns = {
      slack: {
        detect: /slack|notify team|send message/i,
        required: /#[\w-]+|channel\s*[:=]\s*["']?[\w-]+/i,
        missing: "Slack channel name (e.g., #general)",
        examples: ["#general", "#alerts", "#team-updates"]
      },
      gmail: {
        detect: /gmail|email|inbox/i,
        required: /label\s*[:=]|folder\s*[:=]|inbox|important|starred/i,
        missing: "Gmail label or folder (e.g., INBOX, Important)",
        examples: ["INBOX", "Important", "Starred", "Work/Projects"]
      },
      googleDrive: {
        detect: /drive|upload file|save to folder/i,
        required: /folder\s*[:=]\s*["']|\/[\w\s-]+\/|root folder|drive folder/i,
        missing: "Google Drive folder path",
        examples: ["/Reports/2024", "/Team Documents", "root folder"]
      },
      schedule: {
        detect: /daily|weekly|hourly|every|cron|schedule|at \d+/i,
        required: /timezone|UTC|[A-Z]{3,4}T|America\/|Europe\/|Asia\//i,
        missing: "timezone specification",
        examples: ["9 AM PST", "14:00 UTC", "daily at 10 AM America/New_York"]
      },
      webhook: {
        detect: /webhook|http endpoint|api endpoint/i,
        required: /path\s*[:=]|endpoint\s*[:=]|\/api\/|webhook-[\w]+/i,
        missing: "webhook path",
        examples: ["/webhook/orders", "/api/form-submit", "/hooks/github"]
      }
    };
  }

  validate(prompt) {
    const issues = [];
    const warnings = [];
    const suggestions = [];

    // Check each integration pattern
    for (const [integration, pattern] of Object.entries(this.integrationPatterns)) {
      if (pattern.detect.test(prompt) && !pattern.required.test(prompt)) {
        issues.push({
          type: 'missing_required_detail',
          integration,
          message: `Missing ${pattern.missing}`,
          examples: pattern.examples
        });
        
        // Generate suggestion
        suggestions.push(`Add ${pattern.missing}: "${pattern.examples[0]}"`);
      }
    }

    // Check for ambiguous references
    if (/this|that|it|them/i.test(prompt)) {
      warnings.push({
        type: 'ambiguous_reference',
        message: 'Prompt contains ambiguous references (this, that, it)',
        suggestion: 'Be more specific about what you\'re referring to'
      });
    }

    // Check for complex workflows without clear steps
    const stepIndicators = prompt.match(/then|after that|next|finally|step \d+/gi);
    if (stepIndicators && stepIndicators.length > 3) {
      if (!prompt.match(/\d+\.|step \d+:|first.*second.*third/i)) {
        warnings.push({
          type: 'unclear_workflow_steps',
          message: 'Complex workflow without clear step delineation',
          suggestion: 'Consider numbering steps: "1. First do X, 2. Then do Y"'
        });
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
      suggestions,
      enhancedPrompt: this.enhancePrompt(prompt, suggestions)
    };
  }

  enhancePrompt(originalPrompt, suggestions) {
    let enhanced = originalPrompt;
    
    // Add missing details based on suggestions
    if (suggestions.length > 0) {
      enhanced += '\n\nAdditional details:\n' + suggestions.join('\n');
    }
    
    return enhanced;
  }
}