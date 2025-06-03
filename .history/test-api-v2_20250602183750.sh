#!/bin/bash
# FlowForge V2 API - Curl Examples
# Save as: test-api-v2.sh
# Run with: bash test-api-v2.sh

API_URL="http://localhost:3000/api/generate/v2"

echo "🚀 FlowForge V2 API Test Suite"
echo "=============================="

# 1. Health Check
echo -e "\n1️⃣ Health Check"
curl -s -X GET $API_URL | jq '.'

# 2. Simple n8n Workflow
echo -e "\n\n2️⃣ Simple n8n Workflow (Gmail to Slack)"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "input": "When I receive a new email in Gmail, send a notification to Slack channel #general with the subject and sender"
  }' | jq '{
    success: .success,
    workflowName: .workflow.name,
    nodeCount: (.workflow.nodes | length),
    validationScore: .validation.score,
    cost: .metadata.cost,
    model: .metadata.model
  }'

# 3. Complex n8n Workflow with Options
echo -e "\n\n3️⃣ Complex n8n Workflow with Error Handling"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Monitor Gmail for emails with attachments. If PDF, save to Google Drive in PDFs folder. If image, resize and save to Images folder. Send Slack notification with file details. Handle errors by sending email to admin.",
    "platform": "n8n",
    "complexity": "complex",
    "errorHandling": true,
    "optimization": 80,
    "useRAG": true,
    "validateOutput": true
  }' | jq '{
    success: .success,
    nodeCount: (.workflow.nodes | length),
    hasErrorHandling: (.workflow.nodes | map(select(.type | contains("errorTrigger"))) | length > 0),
    validationScore: .validation.score,
    warnings: .validation.warnings,
    ragDocsUsed: .metadata.docsFound
  }'

# 4. Zapier Workflow
echo -e "\n\n4️⃣ Zapier Workflow"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "input": "When someone fills out my Typeform survey, create a contact in HubSpot, add them to a Mailchimp list, and send a welcome email",
    "platform": "zapier",
    "complexity": "moderate"
  }' | jq '{
    success: .success,
    platform: .metadata.platform,
    triggerApp: .workflow.steps[0].app,
    actionCount: (.workflow.steps | length - 1),
    validationScore: .validation.score
  }'

# 5. Make (Integromat) Workflow
echo -e "\n\n5️⃣ Make Scenario"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Every hour, check RSS feed for new posts. For each new post, create a tweet with the title and link, and save the post to Notion database",
    "platform": "make",
    "complexity": "simple"
  }' | jq '{
    success: .success,
    platform: .metadata.platform,
    moduleCount: (.workflow.blueprint.modules | length),
    hasScheduleTrigger: (.workflow.blueprint.modules[0].type | contains("rss") or contains("schedule"))
  }'

# 6. Test Error Handling
echo -e "\n\n6️⃣ Test Error Handling (Invalid Input)"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "input": "",
    "platform": "n8n"
  }' | jq '.'

# 7. Test with Disabled Features
echo -e "\n\n7️⃣ Workflow without RAG or Validation"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Send daily weather report from OpenWeather API to Discord",
    "platform": "n8n",
    "useRAG": false,
    "validateOutput": false
  }' | jq '{
    success: .success,
    ragEnhanced: .metadata.ragEnhanced,
    hasValidation: (.validation != null),
    generationTime: .metadata.generationTime
  }'

# 8. Save Workflow to File
echo -e "\n\n8️⃣ Generate and Save Workflow"
WORKFLOW_RESPONSE=$(curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Every morning at 9 AM, fetch top stories from Hacker News and post a summary to Slack",
    "platform": "n8n"
  }')

if [ "$(echo $WORKFLOW_RESPONSE | jq -r '.success')" = "true" ]; then
  echo $WORKFLOW_RESPONSE | jq '.workflow' > generated-workflow.json
  echo "✅ Workflow saved to: generated-workflow.json"
  echo "📋 Instructions:"
  echo $WORKFLOW_RESPONSE | jq -r '.instructions[]' | while IFS= read -r line; do
    echo "   $line"
  done
else
  echo "❌ Failed to generate workflow"
fi

# 9. Performance Test
echo -e "\n\n9️⃣ Performance Comparison (with/without RAG)"
echo "Testing with RAG enabled..."
START_TIME=$(date +%s%N)
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Create a customer onboarding workflow",
    "useRAG": true
  }' > /dev/null
WITH_RAG_TIME=$(($(date +%s%N) - START_TIME))

echo "Testing without RAG..."
START_TIME=$(date +%s%N)
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Create a customer onboarding workflow",
    "useRAG": false
  }' > /dev/null
WITHOUT_RAG_TIME=$(($(date +%s%N) - START_TIME))

echo "With RAG: $((WITH_RAG_TIME / 1000000))ms"
echo "Without RAG: $((WITHOUT_RAG_TIME / 1000000))ms"

# 10. Batch Test Different Complexities
echo -e "\n\n🔟 Testing Different Complexity Levels"
for COMPLEXITY in simple moderate complex; do
  echo -e "\nComplexity: $COMPLEXITY"
  RESULT=$(curl -s -X POST $API_URL \
    -H "Content-Type: application/json" \
    -d "{
      \"input\": \"Process customer orders from Shopify and update inventory\",
      \"platform\": \"n8n\",
      \"complexity\": \"$COMPLEXITY\"
    }")
  
  echo "- Nodes: $(echo $RESULT | jq '.workflow.nodes | length')"
  echo "- Validation Score: $(echo $RESULT | jq '.validation.score')"
  echo "- Generation Time: $(echo $RESULT | jq '.metadata.generationTime')ms"
  echo "- Cost: \$$(echo $RESULT | jq '.metadata.cost')"
done

echo -e "\n\n✅ All tests completed!"