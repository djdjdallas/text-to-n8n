import { NextResponse } from 'next/server';
import { N8nValidationLoop } from '@/lib/validation/n8nValidationLoop';

export async function POST(req) {
  try {
    const { workflow, prompt = "Test workflow" } = await req.json();
    
    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow is required' },
        { status: 400 }
      );
    }

    const validator = new N8nValidationLoop();
    
    // Check configuration
    const hasConfig = !!(process.env.N8N_API_KEY || process.env.N8N_WEBHOOK_URL);
    
    if (!hasConfig) {
      return NextResponse.json({
        success: false,
        error: 'n8n validation not configured',
        details: 'Set N8N_API_KEY or N8N_WEBHOOK_URL in environment variables'
      });
    }

    console.log('🔍 Testing workflow validation...');
    
    const result = await validator.validateAndFix(
      workflow,
      prompt,
      {
        platform: 'n8n',
        maxAttempts: 3
      }
    );

    return NextResponse.json({
      success: result.success,
      validated: result.validated,
      attempts: result.attempts,
      history: result.history,
      workflow: result.workflow,
      configuration: {
        method: process.env.N8N_API_KEY ? 'api' : 'webhook',
        url: process.env.N8N_API_URL || process.env.N8N_WEBHOOK_URL ? 'configured' : 'not configured'
      }
    });

  } catch (error) {
    console.error('Validation test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const hasApiConfig = !!(process.env.N8N_API_KEY && process.env.N8N_API_URL);
  const hasWebhookConfig = !!process.env.N8N_WEBHOOK_URL;
  
  return NextResponse.json({
    status: 'ready',
    endpoint: '/api/test/n8n-validation',
    method: 'POST',
    configuration: {
      api: {
        configured: hasApiConfig,
        url: process.env.N8N_API_URL ? 'set' : 'not set',
        key: process.env.N8N_API_KEY ? 'set' : 'not set'
      },
      webhook: {
        configured: hasWebhookConfig,
        url: process.env.N8N_WEBHOOK_URL ? 'set' : 'not set'
      },
      enabled: hasApiConfig || hasWebhookConfig
    },
    usage: {
      description: 'POST a workflow JSON to validate and auto-fix it',
      example: {
        workflow: {
          name: "Test Workflow",
          nodes: [{
            name: "Webhook",
            type: "n8n-nodes-base.webhook",
            parameters: {
              httpMethod: "POST",
              path: "test"
            },
            position: [250, 300]
          }],
          connections: {}
        },
        prompt: "Optional: Original prompt used to generate workflow"
      }
    }
  });
}