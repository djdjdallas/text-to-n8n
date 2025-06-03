// test-v2-route.js
// Run with: node test-v2-route.js

async function testV2Route() {
  const testCases = [
    {
      name: "Simple Gmail to Slack workflow",
      request: {
        input:
          "When I receive a new email in Gmail, send a notification to Slack channel #general with the subject and sender",
        platform: "n8n",
        complexity: "simple",
        errorHandling: true,
        useRAG: true,
        validateOutput: true,
      },
    },
    {
      name: "Complex workflow with conditions",
      request: {
        input:
          "Monitor Gmail for emails with attachments. If the attachment is a PDF, save it to Google Drive in a 'PDFs' folder. If it's an image, resize it and save to a different folder. Send a Slack notification with details.",
        platform: "n8n",
        complexity: "moderate",
        errorHandling: true,
      },
    },
    {
      name: "Zapier workflow",
      request: {
        input:
          "When someone fills out my Typeform, create a contact in HubSpot and send a welcome email",
        platform: "zapier",
        complexity: "simple",
      },
    },
  ];

  console.log("🧪 Testing FlowForge V2 API...\n");

  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log(`Platform: ${testCase.request.platform}`);
    console.log(`Input: "${testCase.request.input}"`);

    try {
      const response = await fetch("http://localhost:3000/api/generate/v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testCase.request),
      });

      const result = await response.json();

      if (result.success) {
        console.log("✅ Success!");
        console.log(`- Model: ${result.metadata?.model}`);
        console.log(`- Generation time: ${result.metadata?.generationTime}ms`);
        console.log(
          `- Cost: $${result.metadata?.cost?.toFixed(4) || "0.0000"}`
        );
        console.log(`- RAG docs used: ${result.metadata?.docsFound || 0}`);

        if (result.validation) {
          console.log(`- Validation score: ${result.validation.score}/100`);
          console.log(`- Valid: ${result.validation.isValid ? "Yes" : "No"}`);

          if (result.validation.errors?.length > 0) {
            console.log(`- Errors: ${result.validation.errors.length}`);
          }
          if (result.validation.warnings?.length > 0) {
            console.log(`- Warnings: ${result.validation.warnings.length}`);
          }
        }

        // For n8n, show import instructions
        if (testCase.request.platform === "n8n" && result.instructions) {
          console.log("\n📝 Import Instructions:");
          result.instructions.forEach((instruction, i) => {
            console.log(`   ${instruction}`);
          });
        }

        // Show a preview of the workflow
        if (result.workflow) {
          const preview = JSON.stringify(result.workflow, null, 2);
          console.log(`\n📄 Workflow preview (first 500 chars):`);
          console.log(preview.substring(0, 500) + "...\n");
        }
      } else {
        console.log("❌ Failed:", result.error);
      }
    } catch (error) {
      console.error("❌ Request failed:", error.message);
    }
  }

  // Test the health check endpoint
  console.log("\n🏥 Testing health check...");
  try {
    const healthResponse = await fetch("http://localhost:3000/api/generate/v2");
    const health = await healthResponse.json();
    console.log("Health check response:", JSON.stringify(health, null, 2));
  } catch (error) {
    console.error("Health check failed:", error.message);
  }
}

// Run the tests
testV2Route().catch(console.error);
