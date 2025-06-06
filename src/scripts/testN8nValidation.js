import { N8nValidationLoop } from '../lib/validation/n8nValidationLoop.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

// Test workflows with common issues
const testWorkflows = {
  // Valid workflow
  valid: {
    name: "Valid Test Workflow",
    nodes: [
      {
        parameters: {
          httpMethod: "POST",
          path: "webhook-test"
        },
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        position: [250, 300],
        webhookId: "test-webhook-id"
      },
      {
        parameters: {
          values: {
            values: [
              {
                name: "message",
                value: "Hello World"
              }
            ]
          }
        },
        name: "Set",
        type: "n8n-nodes-base.set",
        position: [450, 300]
      }
    ],
    connections: {
      "Webhook": {
        main: [[{
          node: "Set",
          type: "main",
          index: 0
        }]]
      }
    }
  },

  // Workflow with lowercase node type
  lowercaseNodeType: {
    name: "Lowercase Node Type Test",
    nodes: [
      {
        parameters: {
          operation: "send",
          channel: "#general",
          messageType: "text",
          text: "Test message"
        },
        name: "Slack",
        type: "slackmessage", // Wrong: should be 'slack'
        position: [250, 300]
      }
    ],
    connections: {}
  },

  // Workflow with missing parameters
  missingParameters: {
    name: "Missing Parameters Test",
    nodes: [
      {
        parameters: {}, // Missing required parameters
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        position: [250, 300]
      }
    ],
    connections: {}
  },

  // Workflow with invalid connection
  invalidConnection: {
    name: "Invalid Connection Test",
    nodes: [
      {
        parameters: {
          httpMethod: "POST",
          path: "test"
        },
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        position: [250, 300]
      }
    ],
    connections: {
      "Webhook": {
        main: [[{
          node: "NonExistentNode", // References non-existent node
          type: "main",
          index: 0
        }]]
      }
    }
  },

  // Workflow with invalid parameters
  invalidParameters: {
    name: "Invalid Parameters Test",
    nodes: [
      {
        parameters: {
          httpMethod: "POST",
          path: "test",
          webhookId: "should-not-exist" // Invalid parameter for webhook node
        },
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        position: [250, 300]
      }
    ],
    connections: {}
  },

  // Complex workflow with multiple issues
  multipleIssues: {
    name: "Multiple Issues Test",
    nodes: [
      {
        parameters: {},
        name: "Gmail Trigger",
        type: "gmailtrigger", // Wrong casing
        position: [250, 300],
        credentials: {
          gmailOAuth2Api: { // Wrong credential name
            id: "1",
            name: "Gmail account"
          }
        }
      },
      {
        parameters: {
          operation: "send",
          channel: "#general",
          text: "New email received",
          otherOptions: { // Invalid field for slack
            username: "EmailBot"
          }
        },
        name: "Send Slack Message",
        type: "n8n-nodes-base.slack",
        position: [450, 300]
      },
      {
        parameters: {
          conditions: {
            conditions: [
              {
                leftValue: "={{$json[\"subject\"]}}", // Needs proper escaping
                rightValue: "Important",
                operation: "contains"
              }
            ]
          }
        },
        name: "If",
        type: "ifelse", // Wrong: should be 'if'
        position: [650, 300]
      }
    ],
    connections: {
      "Gmail Trigger": {
        main: [[{
          node: "Send Slack Message",
          type: "main",
          index: 0
        }]]
      },
      "Send Slack Message": {
        main: [[{
          node: "If",
          type: "main",
          index: 0
        }]]
      }
    }
  }
};

async function runTests() {
  console.log('🧪 Starting n8n Validation Tests\n');
  
  const validator = new N8nValidationLoop();
  
  // Check configuration
  console.log('📋 Configuration Check:');
  console.log(`  - N8N_API_URL: ${process.env.N8N_API_URL ? '✅ Set' : '❌ Not set'}`);
  console.log(`  - N8N_API_KEY: ${process.env.N8N_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`  - N8N_WEBHOOK_URL: ${process.env.N8N_WEBHOOK_URL ? '✅ Set' : '❌ Not set'}`);
  console.log();

  if (!process.env.N8N_API_KEY && !process.env.N8N_WEBHOOK_URL) {
    console.log('⚠️  Warning: No n8n validation endpoint configured.');
    console.log('   Set either N8N_API_KEY or N8N_WEBHOOK_URL in .env.local\n');
  }

  // Test each workflow
  for (const [testName, workflow] of Object.entries(testWorkflows)) {
    console.log(`\n📍 Test: ${testName}`);
    console.log('─'.repeat(50));
    
    try {
      const startTime = Date.now();
      
      const result = await validator.validateAndFix(
        workflow,
        `Test workflow: ${testName}`,
        {
          platform: 'n8n',
          maxAttempts: 3
        }
      );
      
      const duration = Date.now() - startTime;
      
      console.log(`  Result: ${result.success ? '✅ Success' : '❌ Failed'}`);
      console.log(`  Attempts: ${result.attempts}`);
      console.log(`  Duration: ${duration}ms`);
      
      if (result.history && result.history.length > 0) {
        console.log('  History:');
        result.history.forEach((attempt, index) => {
          console.log(`    Attempt ${index + 1}: ${attempt.success ? '✅' : '❌'} ${attempt.error || attempt.message || ''}`);
          if (attempt.errorType) {
            console.log(`      Error Type: ${attempt.errorType}`);
          }
        });
      }
      
      // Check if specific issues were fixed
      if (testName === 'lowercaseNodeType' && result.success) {
        const fixedNode = result.workflow.nodes.find(n => n.name === 'Slack');
        console.log(`  Fixed node type: ${fixedNode?.type === 'n8n-nodes-base.slack' ? '✅' : '❌'}`);
      }
      
      if (testName === 'multipleIssues' && result.success) {
        const gmailNode = result.workflow.nodes.find(n => n.name === 'Gmail Trigger');
        const slackNode = result.workflow.nodes.find(n => n.name === 'Send Slack Message');
        const ifNode = result.workflow.nodes.find(n => n.name === 'If');
        
        console.log('  Fixed issues:');
        console.log(`    - Gmail node type: ${gmailNode?.type === 'n8n-nodes-base.gmailTrigger' ? '✅' : '❌'}`);
        console.log(`    - Gmail credentials: ${gmailNode?.credentials?.gmailOAuth2 ? '✅' : '❌'}`);
        console.log(`    - Slack otherOptions removed: ${!slackNode?.parameters?.otherOptions ? '✅' : '❌'}`);
        console.log(`    - If node type: ${ifNode?.type === 'n8n-nodes-base.if' ? '✅' : '❌'}`);
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n\n✅ All tests completed');
  
  // Test connection to n8n if configured
  if (process.env.N8N_API_KEY && process.env.N8N_API_URL) {
    console.log('\n🔌 Testing n8n API connection...');
    try {
      const response = await fetch(`${process.env.N8N_API_URL}/api/v1/workflows`, {
        headers: {
          'X-N8N-API-KEY': process.env.N8N_API_KEY
        }
      });
      
      if (response.ok) {
        console.log('  ✅ Successfully connected to n8n API');
        const data = await response.json();
        console.log(`  📊 Found ${data.data?.length || 0} workflows in n8n`);
      } else {
        console.log(`  ❌ Failed to connect: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`  ❌ Connection error: ${error.message}`);
    }
  }
}

// Run tests
runTests().catch(console.error);