// src/app/api/test/enhanced-fix/route.js
import { NextResponse } from "next/server";
import { workflowFixer } from "@/lib/workflow/formatFixer";
import { structureValidator } from "@/lib/validation/structureValidator";
import { conditionFixer } from "@/lib/workflow/nodeFixers/conditionFixer";
import { gmailFixer } from "@/lib/workflow/nodeFixers/gmailFixer";

export async function POST(req) {
  try {
    console.log("🧪 Testing enhanced n8n workflow fixes...");
    
    // Test case 1: Gmail workflow with generic IF condition
    const testWorkflow1 = {
      "name": "Test Gmail Urgent Email Check",
      "nodes": [
        {
          "id": "1",
          "name": "Gmail Trigger",
          "type": "n8n-nodes-base.gmailTrigger",
          "typeVersion": 1,
          "position": [250, 300],
          "parameters": {
            "labelIds": ["INBOX"]
          }
        },
        {
          "id": "2", 
          "name": "Check if Urgent",
          "type": "n8n-nodes-base.if",
          "typeVersion": 1,
          "position": [450, 300],
          "parameters": {
            "conditions": {
              "conditions": [
                {
                  "leftValue": "={{$json[\"field\"]}}",
                  "rightValue": "",
                  "operation": "equal"
                }
              ]
            }
          }
        },
        {
          "id": "3",
          "name": "Send Alert",
          "type": "n8n-nodes-base.slack",
          "typeVersion": 2.2,
          "position": [650, 300],
          "parameters": {
            "operation": "post",
            "channel": "#alerts",
            "text": "Urgent email received!"
          }
        }
      ],
      "connections": {
        "Gmail Trigger": {
          "main": [[{"node": "Check if Urgent", "type": "main", "index": 0}]]
        },
        "Check if Urgent": {
          "main": [[{"node": "Send Alert", "type": "main", "index": 0}]]
        }
      },
      "settings": {
        "executionOrder": "v1"
      }
    };

    console.log("📊 BEFORE fixes:");
    console.log("  IF condition:", JSON.stringify(testWorkflow1.nodes[1].parameters.conditions.conditions[0], null, 2));

    // Validate before fixes
    const validationBefore = structureValidator.validateWorkflowStructure(testWorkflow1);
    console.log("  Validation issues:", validationBefore.summary.totalIssues);

    // Apply fixes
    const fixResult = workflowFixer.fixN8nWorkflow(testWorkflow1);
    const fixedWorkflow = fixResult.workflow;

    console.log("📊 AFTER fixes:");
    console.log("  IF condition:", JSON.stringify(fixedWorkflow.nodes[1].parameters.conditions.conditions[0], null, 2));

    // Validate after fixes
    const validationAfter = structureValidator.validateWorkflowStructure(fixedWorkflow);
    console.log("  Validation issues:", validationAfter.summary.totalIssues);

    // Test case 2: Gmail label checking (should suggest Code node)
    const testWorkflow2 = {
      "name": "Test Gmail Label Check",
      "nodes": [
        {
          "id": "1",
          "name": "Gmail Trigger",
          "type": "n8n-nodes-base.gmailTrigger",
          "typeVersion": 1,
          "position": [250, 300],
          "parameters": {
            "labelIds": ["INBOX"]
          }
        },
        {
          "id": "2", 
          "name": "Check Label Important",
          "type": "n8n-nodes-base.if",
          "typeVersion": 1,
          "position": [450, 300],
          "parameters": {
            "conditions": {
              "conditions": [
                {
                  "leftValue": "={{$json[\"field\"]}}",
                  "rightValue": "IMPORTANT",
                  "operation": "equal"
                }
              ]
            }
          }
        }
      ],
      "connections": {
        "Gmail Trigger": {
          "main": [[{"node": "Check Label Important", "type": "main", "index": 0}]]
        }
      },
      "settings": {
        "executionOrder": "v1"
      }
    };

    console.log("\n🧪 Testing Gmail label checking pattern...");
    const labelFixResult = gmailFixer.fixGmailWorkflow(testWorkflow2);
    console.log("  Label fixes applied:", labelFixResult.fixesApplied);

    // Test case 3: Context-aware condition fixing
    const testNode = {
      name: "Check if Priority High",
      type: "n8n-nodes-base.if"
    };
    const previousNode = {
      name: "Google Sheets Trigger", 
      type: "n8n-nodes-base.googleSheets"
    };

    console.log("\n🧪 Testing context-aware condition generation...");
    const contextFix = conditionFixer.fixConditionBasedOnContext(testNode, previousNode, {
      workflowName: "Priority Task Processing"
    });
    console.log("  Generated condition:", contextFix.condition);

    return NextResponse.json({
      success: true,
      testResults: {
        gmailWorkflowFix: {
          before: testWorkflow1.nodes[1].parameters.conditions.conditions[0],
          after: fixedWorkflow.nodes[1].parameters.conditions.conditions[0],
          validationIssuesBefore: validationBefore.summary.totalIssues,
          validationIssuesAfter: validationAfter.summary.totalIssues
        },
        gmailLabelFix: {
          fixesApplied: labelFixResult.fixesApplied,
          fixes: labelFixResult.fixes
        },
        contextAwareFix: {
          condition: contextFix.condition,
          shouldReplace: contextFix.replace
        }
      },
      workflows: {
        original: testWorkflow1,
        fixed: fixedWorkflow,
        labelTest: testWorkflow2
      }
    });
  } catch (error) {
    console.error("❌ Enhanced fix test error:", error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Enhanced n8n workflow fix test endpoint. Use POST to run tests.",
    testCases: [
      "Gmail workflow with generic IF condition",
      "Gmail label checking pattern", 
      "Context-aware condition generation"
    ]
  });
}