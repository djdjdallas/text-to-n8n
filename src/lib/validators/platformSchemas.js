// src/lib/validators/platformSchemas.js
import n8nSchema from "@/lib/ai/schemas/n8n.schema.json";

// Import the n8n workflow schema from docs
const n8nWorkflowSchema = require("/Users/dominickhill/ai-automation/docs/n8n/schemas/workflow-schema.json");

export const platformSchemas = {
  n8n: {
    workflow: n8nWorkflowSchema,
    // Keep the original schema as a fallback
    workflowLegacy: {
      type: "object",
      required: ["name", "nodes", "connections", "settings"],
      properties: {
        name: { type: "string" },
        nodes: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "name", "type", "typeVersion", "position"],
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              type: { type: "string" },
              typeVersion: { type: "number" },
              position: {
                type: "array",
                items: { type: "number" },
                minItems: 2,
                maxItems: 2,
              },
              parameters: { type: "object" },
              credentials: { type: "object" },
            },
          },
        },
        connections: {
          type: "object",
          patternProperties: {
            "^.*$": {
              type: "object",
              patternProperties: {
                "^.*$": {
                  type: "array",
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        node: { type: "string" },
                        type: { type: "string" },
                        index: { type: "number" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        settings: {
          type: "object",
          properties: {
            executionOrder: { type: "string" },
            saveManualExecutions: { type: "boolean" },
            callerPolicy: { type: "string" },
            errorWorkflow: { type: "string" },
          },
        },
      },
    },
  },
  zapier: {
    zap: {
      type: "object",
      required: ["trigger", "actions"],
      properties: {
        trigger: {
          type: "object",
          required: ["app", "event"],
          properties: {
            app: { type: "string" },
            event: { type: "string" },
            input: { type: "object" },
          },
        },
        actions: {
          type: "array",
          items: {
            type: "object",
            required: ["app", "action"],
            properties: {
              app: { type: "string" },
              action: { type: "string" },
              input: { type: "object" },
              conditions: { type: "array" },
            },
          },
        },
      },
    },
  },
  make: {
    scenario: {
      type: "object",
      required: ["name", "modules", "routes"],
      properties: {
        name: { type: "string" },
        modules: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "module", "version"],
            properties: {
              id: { type: "number" },
              module: { type: "string" },
              version: { type: "number" },
              parameters: { type: "object" },
              mapper: { type: "object" },
              metadata: { type: "object" },
            },
          },
        },
        routes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              flow: { type: "array" },
              filter: { type: "object" },
            },
          },
        },
      },
    },
  },
};
