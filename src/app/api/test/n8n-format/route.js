// src/app/api/test/n8n-format/route.js
import { NextResponse } from "next/server";

export async function GET() {
  // Return a minimal valid n8n workflow
  const validN8nWorkflow = {
    meta: {
      instanceId:
        "2251580ff6d4d3c2d4a774d2ed12135db20e7ece2ee0b728a9996bb9056d6a68",
    },
    name: "Test Gmail to Slack",
    nodes: [
      {
        id: "7a0d2e27-5328-4679-8b12-7e36b48af7af",
        name: "Gmail Trigger",
        type: "n8n-nodes-base.gmailTrigger",
        typeVersion: 1,
        position: [250, 300],
        credentials: {
          gmailOAuth2: {
            id: "c5n3K4xLV6JTyPZE",
            name: "Gmail account",
          },
        },
        parameters: {
          labelIds: ["UNREAD", "INBOX"],
        },
      },
      {
        id: "65c7d9f7-c6a5-4799-a639-3df25de218f1",
        name: "Slack",
        type: "n8n-nodes-base.slack",
        typeVersion: 2.2,
        position: [450, 300],
        credentials: {
          slackApi: {
            id: "8EOLa7g2qj6JTtXM",
            name: "Slack account",
          },
        },
        parameters: {
          operation: "post",
          authentication: "accessToken",
          channel: "#general",
          text: '=📧 New Email!\\n*From:* {{$node["Gmail Trigger"].json["from"]}}\\n*Subject:* {{$node["Gmail Trigger"].json["subject"]}}',
          otherOptions: {},
        },
      },
    ],
    connections: {
      "Gmail Trigger": {
        main: [
          [
            {
              node: "Slack",
              type: "main",
              index: 0,
            },
          ],
        ],
      },
    },
    active: false,
    settings: {
      executionOrder: "v1",
    },
    versionId: "01234567-89ab-cdef-0123-456789abcdef",
    tags: [],
    pinData: {},
    staticData: null,
  };

  return NextResponse.json({
    message: "Copy the 'workflow' object below and paste it into n8n",
    workflow: validN8nWorkflow,
    instructions: [
      "1. Copy the entire 'workflow' JSON object below",
      "2. In n8n, click 'Import from URL' or press Ctrl+V",
      "3. The workflow should import successfully",
      "Note: You'll need to set up your own Gmail and Slack credentials",
    ],
    copyThis: JSON.stringify(validN8nWorkflow, null, 2),
  });
}
