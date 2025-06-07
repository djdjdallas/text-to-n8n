export const workflowTemplates = {
  patterns: [
    {
      name: "email_to_slack",
      match: /email.*slack|gmail.*notify|inbox.*message/i,
      requiredParams: ['slackChannel', 'gmailLabel'],
      template: {
        name: "Email to Slack Notification",
        nodes: [
          {
            id: "gmail_trigger_{{ID}}",
            name: "Gmail Trigger",
            type: "n8n-nodes-base.gmailTrigger",
            typeVersion: 1,
            position: [250, 300],
            credentials: {
              gmailOAuth2: {
                id: "{{GMAIL_CRED_ID}}",
                name: "Gmail account"
              }
            },
            parameters: {
              labelIds: ["{{GMAIL_LABEL}}"],
              includeAttachments: false
            }
          },
          {
            id: "slack_{{ID}}",
            name: "Send to Slack",
            type: "n8n-nodes-base.slack",
            typeVersion: 2,
            position: [450, 300],
            credentials: {
              slackApi: {
                id: "{{SLACK_CRED_ID}}",
                name: "Slack account"
              }
            },
            parameters: {
              authentication: "accessToken",
              channel: "{{SLACK_CHANNEL}}",
              text: "=New email from: {{$json[\"from\"][\"emailAddress\"][\"address\"]}}\nSubject: {{$json[\"subject\"]}}"
            }
          }
        ],
        connections: {
          "Gmail Trigger": {
            main: [[{ node: "Send to Slack", type: "main", index: 0 }]]
          }
        }
      }
    },
    {
      name: "scheduled_task",
      match: /daily|weekly|schedule|cron|every.*at/i,
      requiredParams: ['schedule', 'timezone'],
      template: {
        name: "Scheduled Task",
        nodes: [
          {
            id: "schedule_trigger_{{ID}}",
            name: "Schedule Trigger",
            type: "n8n-nodes-base.scheduleTrigger",
            typeVersion: 1,
            position: [250, 300],
            parameters: {
              rule: {
                interval: [{
                  field: "cronExpression",
                  expression: "{{CRON_EXPRESSION}}"
                }]
              },
              timezone: "{{TIMEZONE}}"
            }
          }
        ]
      }
    },
    {
      name: "drive_upload",
      match: /upload.*drive|save.*drive|file.*drive/i,
      requiredParams: ['folderPath'],
      template: {
        name: "Upload to Google Drive",
        nodes: [
          {
            id: "drive_upload_{{ID}}",
            name: "Upload to Drive",
            type: "n8n-nodes-base.googleDrive",
            typeVersion: 3,
            position: [250, 300],
            credentials: {
              googleDriveOAuth2Api: {
                id: "{{DRIVE_CRED_ID}}",
                name: "Google Drive account"
              }
            },
            parameters: {
              operation: "upload",
              driveId: {
                "__rl": true,
                "mode": "list",
                "value": "My Drive"
              },
              folderId: {
                "__rl": true,
                "mode": "list",
                "value": "{{FOLDER_ID}}",
                "cachedResultName": "{{FOLDER_PATH}}"
              },
              options: {}
            }
          }
        ]
      }
    },
    {
      name: "webhook_to_slack",
      match: /webhook.*slack|api.*notify/i,
      requiredParams: ['webhookPath', 'slackChannel'],
      template: {
        name: "Webhook to Slack",
        nodes: [
          {
            id: "webhook_{{ID}}",
            name: "Webhook",
            type: "n8n-nodes-base.webhook",
            typeVersion: 1,
            position: [250, 300],
            parameters: {
              path: "{{WEBHOOK_PATH}}",
              httpMethod: "POST",
              responseMode: "onReceived"
            }
          },
          {
            id: "slack_notify_{{ID}}",
            name: "Notify Slack",
            type: "n8n-nodes-base.slack",
            typeVersion: 2,
            position: [450, 300],
            credentials: {
              slackApi: {
                id: "{{SLACK_CRED_ID}}",
                name: "Slack account"
              }
            },
            parameters: {
              authentication: "accessToken",
              channel: "{{SLACK_CHANNEL}}",
              text: "=Webhook received: {{JSON.stringify($json)}}"
            }
          }
        ],
        connections: {
          "Webhook": {
            main: [[{ node: "Notify Slack", type: "main", index: 0 }]]
          }
        }
      }
    }
  ],

  findMatchingTemplate(prompt) {
    for (const pattern of this.patterns) {
      if (pattern.match.test(prompt)) {
        return pattern;
      }
    }
    return null;
  },

  applyTemplate(template, params) {
    let workflow = JSON.parse(JSON.stringify(template.template));
    
    // Generate unique IDs
    const timestamp = Date.now();
    params.ID = timestamp;
    params.GMAIL_CRED_ID = params.GMAIL_CRED_ID || "1";
    params.SLACK_CRED_ID = params.SLACK_CRED_ID || "2";
    params.DRIVE_CRED_ID = params.DRIVE_CRED_ID || "3";
    
    // Replace all placeholders
    const replacePlaceholders = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key].replace(/\{\{(\w+)\}\}/g, (match, param) => {
            return params[param] || match;
          });
        } else if (typeof obj[key] === 'object') {
          replacePlaceholders(obj[key]);
        }
      }
    };
    
    replacePlaceholders(workflow);
    return workflow;
  },

  extractParameters(prompt, template) {
    const params = {};
    
    // Extract Slack channel
    const slackChannelMatch = prompt.match(/#([\w-]+)|channel\s*[:=]\s*["']?([\w-]+)/i);
    if (slackChannelMatch) {
      params.SLACK_CHANNEL = '#' + (slackChannelMatch[1] || slackChannelMatch[2]);
    }
    
    // Extract Gmail label
    const gmailLabelMatch = prompt.match(/label\s*[:=]\s*["']?(\w+)|inbox|important|starred/i);
    if (gmailLabelMatch) {
      params.GMAIL_LABEL = gmailLabelMatch[1] || gmailLabelMatch[0].toUpperCase();
    }
    
    // Extract Drive folder
    const driveFolderMatch = prompt.match(/folder\s*[:=]\s*["']([^"']+)|\/([^\/\s]+(?:\/[^\/\s]+)*)/i);
    if (driveFolderMatch) {
      params.FOLDER_PATH = driveFolderMatch[1] || driveFolderMatch[2];
      params.FOLDER_ID = "root"; // Default to root, should be resolved by AI
    }
    
    // Extract webhook path
    const webhookMatch = prompt.match(/path\s*[:=]\s*["']?([\/\w-]+)|webhook[\/\s]+([\w-]+)/i);
    if (webhookMatch) {
      params.WEBHOOK_PATH = webhookMatch[1] || '/' + webhookMatch[2];
    }
    
    // Extract schedule/timezone
    const timezoneMatch = prompt.match(/(\w+\/\w+)|UTC|([A-Z]{3,4}T)/);
    if (timezoneMatch) {
      params.TIMEZONE = timezoneMatch[0];
    } else {
      params.TIMEZONE = "America/Los_Angeles"; // Default
    }
    
    // Extract cron expression (simplified)
    if (prompt.match(/daily/i)) {
      params.CRON_EXPRESSION = "0 9 * * *"; // Daily at 9 AM
    } else if (prompt.match(/weekly/i)) {
      params.CRON_EXPRESSION = "0 9 * * 1"; // Weekly on Monday at 9 AM
    } else if (prompt.match(/hourly/i)) {
      params.CRON_EXPRESSION = "0 * * * *"; // Every hour
    }
    
    return params;
  }
};