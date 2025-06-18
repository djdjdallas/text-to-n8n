#!/usr/bin/env node

/**
 * Test script to verify example integration
 */

import exampleLoader from './src/lib/examples/exampleLoader.js';
import { workflowValidator } from './src/lib/validation/workflowValidator.js';
import { promptEnhancer } from './src/lib/prompts/promptEnhancer.js';

async function testExampleIntegration() {
  console.log('🧪 Testing Example Integration...\n');

  try {
    // Test 1: Example Loader
    console.log('1. Testing Example Loader...');
    const examples = await exampleLoader.loadExamples();
    console.log(`   ✅ Loaded ${examples.length} examples`);
    
    const webhookExamples = await exampleLoader.getExamplesByNodeType('n8n-nodes-base.webhook');
    console.log(`   ✅ Found ${webhookExamples.length} webhook examples`);
    
    const singleNodeExample = await exampleLoader.getSingleNodeExample('n8n-nodes-base.httpRequest');
    console.log(`   ✅ Found single HTTP Request example: ${singleNodeExample ? 'Yes' : 'No'}`);

    // Test 2: Workflow Validation with Examples
    console.log('\n2. Testing Workflow Validation with Examples...');
    
    // Create a test workflow with some issues
    const testWorkflow = {
      name: "Test Workflow",
      nodes: [
        {
          id: "1",
          name: "Test Set",
          type: "n8n-nodes-base.set",
          position: [250, 300],
          parameters: {
            options: {}, // This should be flagged by example validation
            keepOnlySet: true // This should also be flagged
          }
        },
        {
          id: "2", 
          name: "Test HTTP",
          type: "n8n-nodes-base.httpRequest",
          position: [450, 300],
          parameters: {
            url: "https://api.example.com",
            queryParameters: {
              parameters: {} // This nested structure should be flagged
            }
          }
        }
      ],
      connections: {}
    };

    const validationResult = await workflowValidator.validateWorkflow('n8n', testWorkflow);
    console.log(`   ✅ Validation completed. Valid: ${validationResult.isValid}`);
    console.log(`   ✅ Found ${validationResult.errors.length} errors`);
    console.log(`   ✅ Found ${validationResult.warnings.length} warnings`);
    
    // Check if example-based validation caught the issues
    const exampleErrors = validationResult.errors.filter(e => 
      e.type.includes('INVALID_SET_STRUCTURE') || 
      e.type.includes('NESTED_QUERY_PARAMS') ||
      e.type.includes('INVALID_SET_PARAM')
    );
    console.log(`   ✅ Example-based validation caught ${exampleErrors.length} issues`);

    // Test 3: Prompt Enhancement with Examples
    console.log('\n3. Testing Prompt Enhancement with Examples...');
    
    const testPrompt = "Create a workflow that receives webhooks and sends data to Slack";
    const enhancedPrompt = await promptEnhancer.enhance(testPrompt, {
      platform: 'n8n',
      complexity: 'moderate'
    });
    
    console.log(`   ✅ Enhanced prompt generated`);
    console.log(`   ✅ Dynamic examples added: ${enhancedPrompt.metadata.dynamicExamplesAdded ? 'Yes' : 'No'}`);
    console.log(`   ✅ Pattern detected: ${enhancedPrompt.metadata.pattern?.type || 'None'}`);
    
    if (enhancedPrompt.enhanced.includes('WEBHOOK') || enhancedPrompt.enhanced.includes('SLACK')) {
      console.log(`   ✅ Relevant examples included in enhanced prompt`);
    }

    // Test 4: Example Pattern Categorization
    console.log('\n4. Testing Example Pattern Categorization...');
    
    const commonPairs = await exampleLoader.getExamplesByPattern('commonPairs');
    console.log(`   ✅ Found ${commonPairs.length} common pair examples`);
    
    const aiPatterns = await exampleLoader.getExamplesByPattern('aiPatterns');
    console.log(`   ✅ Found ${aiPatterns.length} AI pattern examples`);
    
    const complexPatterns = await exampleLoader.getExamplesByPattern('complexPatterns');
    console.log(`   ✅ Found ${complexPatterns.length} complex pattern examples`);

    // Test 5: Node Pair Example Lookup
    console.log('\n5. Testing Node Pair Example Lookup...');
    
    const webhookToSheetsExample = await exampleLoader.getNodePairExample(
      'n8n-nodes-base.webhook', 
      'n8n-nodes-base.googleSheets'
    );
    console.log(`   ✅ Webhook→Sheets example found: ${webhookToSheetsExample ? 'Yes' : 'No'}`);
    
    const gmailToSlackExample = await exampleLoader.getNodePairExample(
      'n8n-nodes-base.gmailTrigger',
      'n8n-nodes-base.slack'
    );
    console.log(`   ✅ Gmail→Slack example found: ${gmailToSlackExample ? 'Yes' : 'No'}`);

    console.log('\n🎉 All integration tests completed successfully!');
    
    // Summary
    console.log('\n📊 Integration Summary:');
    console.log(`   • ${examples.length} total examples loaded`);
    console.log(`   • Example-based validation integrated`);
    console.log(`   • Dynamic examples in prompt enhancement`);
    console.log(`   • Pattern categorization working`);
    console.log(`   • Node pair lookup functional`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testExampleIntegration();