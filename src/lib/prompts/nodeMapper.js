export class NodeMapper {
  constructor() {
    this.nodeMappings = {
      // Audio/Voice/TTS
      audio: {
        patterns: [
          /\b(text to speech|tts|voice|audio|speak|say|eleven ?labs?|elevenlabs)\b/i,
          /\b(read aloud|read out|narrate|voice over)\b/i,
          /\b(generate voice|create audio|make it speak)\b/i
        ],
        nodes: [{
          type: "n8n-nodes-base.elevenlabs",
          name: "ElevenLabs",
          hint: "Use ElevenLabs for text-to-speech/audio generation",
          parameters: {
            voice: "rachel", // Default voice
            model: "eleven_monolingual_v1"
          }
        }],
        requiredCredentials: ["elevenlabsApi"]
      },

      // Scheduling/Cron
      schedule: {
        patterns: [
          /\b(schedule|cron|every|daily|weekly|monthly|hourly)\b/i,
          /\b(at \d{1,2}(?::\d{2})?\s*(?:am|pm)?|recurring|periodically)\b/i,
          /\b(every \d+ (?:hour|minute|day|week|month)s?)\b/i,
          /\b(trigger at|run at|execute at)\b/i
        ],
        nodes: [{
          type: "n8n-nodes-base.scheduleTrigger",
          name: "Schedule Trigger",
          hint: "Use Schedule Trigger for time-based automation",
          parameters: {
            rule: { interval: [{}] },
            timezone: "America/Los_Angeles" // Default timezone
          }
        }],
        extractors: {
          timezone: /\b(UTC|EST|PST|GMT|[A-Z]{3,4}T|America\/\w+|Europe\/\w+)\b/i,
          time: /\b(\d{1,2}):?(\d{2})?\s*(am|pm)?\b/i,
          frequency: /\b(daily|weekly|monthly|hourly|every \d+ \w+)\b/i
        }
      },

      // AI/LLM Operations
      ai: {
        patterns: [
          /\b(chatgpt|gpt|openai|anthropic|claude|ai|llm)\b/i,
          /\b(analyze|summarize|extract|generate text|write)\b/i,
          /\b(ask ai|ai response|artificial intelligence)\b/i
        ],
        nodes: [
          {
            type: "n8n-nodes-base.openAi",
            name: "OpenAI",
            hint: "Use OpenAI for ChatGPT/GPT operations",
            when: /\b(chatgpt|gpt|openai)\b/i
          },
          {
            type: "@n8n/n8n-nodes-anthropic.anthropic",
            name: "Anthropic",
            hint: "Use Anthropic for Claude operations",
            when: /\b(claude|anthropic)\b/i
          }
        ],
        defaultNode: "n8n-nodes-base.openAi"
      },

      // Database Operations
      database: {
        patterns: [
          /\b(database|mysql|postgres|postgresql|mongodb|sql)\b/i,
          /\b(query|select from|insert into|update|delete from)\b/i,
          /\b(store in db|save to database|fetch from db)\b/i
        ],
        nodes: [
          {
            type: "n8n-nodes-base.postgres",
            name: "Postgres",
            when: /\b(postgres|postgresql|pg)\b/i
          },
          {
            type: "n8n-nodes-base.mysql",
            name: "MySQL",
            when: /\bmysql\b/i
          },
          {
            type: "n8n-nodes-base.mongoDb",
            name: "MongoDB",
            when: /\bmongo(db)?\b/i
          }
        ]
      },

      // Image Operations
      image: {
        patterns: [
          /\b(image|photo|picture|screenshot|graphic)\b/i,
          /\b(resize|crop|convert|compress|optimize image)\b/i,
          /\b(generate image|create image|dall-?e|midjourney|stable diffusion)\b/i
        ],
        nodes: [
          {
            type: "n8n-nodes-base.imageResize",
            name: "Edit Image",
            when: /\b(resize|crop|convert|compress)\b/i
          },
          {
            type: "n8n-nodes-base.openAi",
            name: "OpenAI Image",
            when: /\b(dall-?e|generate image|create image)\b/i,
            parameters: {
              resource: "image",
              operation: "generate"
            }
          }
        ]
      },

      // PDF Operations
      pdf: {
        patterns: [
          /\b(pdf|document|extract text|merge pdf|split pdf)\b/i,
          /\b(read pdf|parse pdf|create pdf|generate pdf)\b/i
        ],
        nodes: [
          {
            type: "n8n-nodes-base.pdf",
            name: "PDF",
            hint: "Use PDF node for PDF operations"
          }
        ]
      },

      // Messaging/Chat Platforms
      messaging: {
        patterns: [
          /\b(discord|telegram|whatsapp|sms|text message|twilio)\b/i,
          /\b(send message|chat|messenger)\b/i
        ],
        nodes: [
          {
            type: "n8n-nodes-base.discord",
            name: "Discord",
            when: /\bdiscord\b/i
          },
          {
            type: "n8n-nodes-base.telegram",
            name: "Telegram",
            when: /\btelegram\b/i
          },
          {
            type: "n8n-nodes-base.twilio",
            name: "Twilio",
            when: /\b(sms|text message|twilio|whatsapp)\b/i
          }
        ]
      },

      // CRM/Sales Tools
      crm: {
        patterns: [
          /\b(crm|customer|contact|lead|deal|opportunity)\b/i,
          /\b(hubspot|salesforce|pipedrive|airtable|notion)\b/i
        ],
        nodes: [
          {
            type: "n8n-nodes-base.hubspot",
            name: "HubSpot",
            when: /\bhubspot\b/i
          },
          {
            type: "n8n-nodes-base.salesforce",
            name: "Salesforce", 
            when: /\bsalesforce\b/i
          },
          {
            type: "n8n-nodes-base.airtable",
            name: "Airtable",
            when: /\bairtable\b/i
          },
          {
            type: "n8n-nodes-base.notion",
            name: "Notion",
            when: /\bnotion\b/i
          }
        ]
      },

      // Data Transformation
      transform: {
        patterns: [
          /\b(transform|convert|format|parse|extract)\b/i,
          /\b(json|xml|csv|data manipulation)\b/i,
          /\b(map|filter|reduce|aggregate)\b/i
        ],
        nodes: [
          {
            type: "n8n-nodes-base.code",
            name: "Code",
            hint: "Use Code node for complex transformations"
          },
          {
            type: "n8n-nodes-base.itemLists",
            name: "Item Lists",
            when: /\b(split|aggregate|group|batch)\b/i
          },
          {
            type: "n8n-nodes-base.set",
            name: "Set",
            when: /\b(set|assign|add field)\b/i
          }
        ]
      },

      // Conditional Logic
      conditional: {
        patterns: [
          /\b(if|when|condition|check|verify|validate)\b/i,
          /\b(branch|route|decision|choose)\b/i,
          /\b(equals?|contains?|greater than|less than)\b/i
        ],
        nodes: [
          {
            type: "n8n-nodes-base.if",
            name: "IF",
            hint: "Use IF node for conditional logic"
          },
          {
            type: "n8n-nodes-base.switch",
            name: "Switch",
            when: /\b(multiple conditions|switch|case)\b/i
          }
        ]
      },

      // API/HTTP Requests
      api: {
        patterns: [
          /\b(api|http|rest|graphql|webhook|endpoint)\b/i,
          /\b(get|post|put|delete|patch|request)\b/i,
          /\b(call api|fetch|send request)\b/i
        ],
        nodes: [
          {
            type: "n8n-nodes-base.httpRequest",
            name: "HTTP Request",
            hint: "Use HTTP Request for API calls"
          },
          {
            type: "n8n-nodes-base.webhook",
            name: "Webhook",
            when: /\b(receive|incoming|listen|webhook trigger)\b/i
          }
        ]
      },

      // File Operations
      file: {
        patterns: [
          /\b(file|folder|directory|upload|download)\b/i,
          /\b(ftp|sftp|ssh|scp|dropbox|box|onedrive)\b/i,
          /\b(read file|write file|move file|copy file)\b/i
        ],
        nodes: [
          {
            type: "n8n-nodes-base.ftp",
            name: "FTP",
            when: /\b(ftp|sftp)\b/i
          },
          {
            type: "n8n-nodes-base.ssh",
            name: "SSH",
            when: /\b(ssh|scp)\b/i
          },
          {
            type: "n8n-nodes-base.dropbox",
            name: "Dropbox",
            when: /\bdropbox\b/i
          },
          {
            type: "n8n-nodes-base.microsoftOneDrive",
            name: "OneDrive",
            when: /\bonedrive\b/i
          }
        ]
      },

      // E-commerce
      ecommerce: {
        patterns: [
          /\b(shop|store|product|order|customer|payment)\b/i,
          /\b(shopify|woocommerce|stripe|paypal|square)\b/i,
          /\b(inventory|shipping|checkout)\b/i
        ],
        nodes: [
          {
            type: "n8n-nodes-base.shopify",
            name: "Shopify",
            when: /\bshopify\b/i
          },
          {
            type: "n8n-nodes-base.wooCommerce",
            name: "WooCommerce",
            when: /\bwoocommerce\b/i
          },
          {
            type: "n8n-nodes-base.stripe",
            name: "Stripe",
            when: /\b(stripe|payment)\b/i
          }
        ]
      },

      // Calendar/Events
      calendar: {
        patterns: [
          /\b(calendar|event|meeting|appointment|schedule meeting)\b/i,
          /\b(google calendar|outlook calendar|cal\.com|calendly)\b/i
        ],
        nodes: [
          {
            type: "n8n-nodes-base.googleCalendar",
            name: "Google Calendar",
            when: /\bgoogle calendar\b/i
          },
          {
            type: "n8n-nodes-base.microsoftOutlook",
            name: "Outlook Calendar",
            when: /\boutlook\b/i
          },
          {
            type: "n8n-nodes-base.calCom",
            name: "Cal.com",
            when: /\bcal\.com\b/i
          }
        ]
      },

      // Email Operations (beyond Gmail)
      email: {
        patterns: [
          /\b(email|mail|smtp|imap|outlook|sendgrid)\b/i,
          /\b(send email|receive email|email notification)\b/i
        ],
        nodes: [
          {
            type: "n8n-nodes-base.emailSend",
            name: "Send Email",
            when: /\b(send email|smtp)\b/i
          },
          {
            type: "n8n-nodes-base.emailReadImap",
            name: "Email Trigger (IMAP)",
            when: /\b(receive email|imap|email trigger)\b/i
          },
          {
            type: "n8n-nodes-base.sendGrid",
            name: "SendGrid",
            when: /\bsendgrid\b/i
          }
        ]
      },

      // Form/Survey Tools
      forms: {
        patterns: [
          /\b(form|survey|typeform|google forms|jotform)\b/i,
          /\b(submission|response|feedback)\b/i
        ],
        nodes: [
          {
            type: "n8n-nodes-base.typeform",
            name: "Typeform",
            when: /\btypeform\b/i
          },
          {
            type: "n8n-nodes-base.googleForms",
            name: "Google Forms",
            when: /\bgoogle forms\b/i
          },
          {
            type: "n8n-nodes-base.jotform",
            name: "JotForm",
            when: /\bjotform\b/i
          }
        ]
      }
    };
  }

  /**
   * Analyze prompt and return suggested nodes
   */
  analyzePrompt(prompt) {
    const suggestions = {
      nodes: [],
      hints: [],
      warnings: [],
      requiredCredentials: new Set()
    };

    // Check each mapping category
    for (const [category, mapping] of Object.entries(this.nodeMappings)) {
      // Check if any pattern matches
      const matches = mapping.patterns.some(pattern => pattern.test(prompt));
      
      if (matches) {
        // Find the best node for this category
        let selectedNode = null;
        
        if (mapping.nodes) {
          // Check for specific node matches
          for (const node of mapping.nodes) {
            if (node.when && node.when.test(prompt)) {
              selectedNode = node;
              break;
            }
          }
          
          // Use default or first node if no specific match
          if (!selectedNode) {
            selectedNode = mapping.defaultNode 
              ? mapping.nodes.find(n => n.type === mapping.defaultNode)
              : mapping.nodes[0];
          }
        }
        
        if (selectedNode) {
          suggestions.nodes.push({
            category,
            ...selectedNode,
            confidence: this.calculateConfidence(prompt, mapping.patterns)
          });
          
          if (selectedNode.hint) {
            suggestions.hints.push(selectedNode.hint);
          }
        }
        
        // Add required credentials
        if (mapping.requiredCredentials) {
          mapping.requiredCredentials.forEach(cred => 
            suggestions.requiredCredentials.add(cred)
          );
        }
        
        // Extract additional parameters if extractors exist
        if (mapping.extractors) {
          const extracted = this.extractParameters(prompt, mapping.extractors);
          if (selectedNode && extracted) {
            selectedNode.extractedParams = extracted;
          }
        }
      }
    }

    // Add warnings for conflicting requirements
    this.addWarnings(suggestions, prompt);
    
    return suggestions;
  }

  /**
   * Calculate confidence score for a match
   */
  calculateConfidence(prompt, patterns) {
    let matchCount = 0;
    patterns.forEach(pattern => {
      if (pattern.test(prompt)) matchCount++;
    });
    return matchCount / patterns.length;
  }

  /**
   * Extract parameters from prompt using regex patterns
   */
  extractParameters(prompt, extractors) {
    const params = {};
    
    for (const [param, pattern] of Object.entries(extractors)) {
      const match = prompt.match(pattern);
      if (match) {
        params[param] = match[0];
      }
    }
    
    return Object.keys(params).length > 0 ? params : null;
  }

  /**
   * Add warnings for potential issues
   */
  addWarnings(suggestions, prompt) {
    // Check for multiple scheduling patterns
    const scheduleCount = suggestions.nodes.filter(n => 
      n.category === 'schedule'
    ).length;
    
    if (scheduleCount > 1) {
      suggestions.warnings.push(
        'Multiple scheduling patterns detected - ensure clear timing'
      );
    }
    
    // Check for missing credentials
    if (suggestions.requiredCredentials.size > 3) {
      suggestions.warnings.push(
        `This workflow requires ${suggestions.requiredCredentials.size} different credentials`
      );
    }
    
    // Check for complex multi-platform workflows
    const platformCount = new Set(suggestions.nodes.map(n => n.category)).size;
    if (platformCount > 5) {
      suggestions.warnings.push(
        'Complex workflow detected - consider breaking into smaller workflows'
      );
    }
  }

  /**
   * Generate enhanced prompt with node suggestions
   */
  enhancePromptWithNodes(originalPrompt, suggestions) {
    let enhanced = originalPrompt;
    
    if (suggestions.nodes.length > 0) {
      enhanced += '\n\n## Suggested n8n Nodes:';
      suggestions.nodes.forEach(node => {
        enhanced += `\n- ${node.name} (${node.type})`;
        if (node.confidence < 0.5) {
          enhanced += ' [consider if applicable]';
        }
      });
    }
    
    if (suggestions.hints.length > 0) {
      enhanced += '\n\n## Implementation Hints:';
      suggestions.hints.forEach(hint => {
        enhanced += `\n- ${hint}`;
      });
    }
    
    if (suggestions.requiredCredentials.size > 0) {
      enhanced += '\n\n## Required Credentials:';
      suggestions.requiredCredentials.forEach(cred => {
        enhanced += `\n- ${cred}`;
      });
    }
    
    return enhanced;
  }
}