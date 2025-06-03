// src/lib/workflow/formatFixer.js
export class WorkflowFormatFixer {
  /**
   * Fix n8n workflow format issues
   */
  fixN8nWorkflow(workflow) {
    // Create a copy to avoid mutations
    const fixed = JSON.parse(JSON.stringify(workflow));

    // 1. Add meta field if missing
    if (!fixed.meta) {
      fixed.meta = {
        instanceId: this.generateInstanceId(),
      };
    }

    // 2. Fix Gmail trigger parameters
    if (fixed.nodes) {
      fixed.nodes.forEach((node) => {
        if (node.type === "n8n-nodes-base.gmailTrigger") {
          // Convert 'label' to 'labelIds' array
          if (node.parameters?.label && !node.parameters.labelIds) {
            node.parameters.labelIds = [node.parameters.label];
            delete node.parameters.label;
          }
          // Ensure it's an array
          if (
            node.parameters?.labelIds &&
            !Array.isArray(node.parameters.labelIds)
          ) {
            node.parameters.labelIds = [node.parameters.labelIds];
          }
        }

        // Fix Slack node version
        if (node.type === "n8n-nodes-base.slack") {
          if (!node.typeVersion || node.typeVersion < 2) {
            node.typeVersion = 2.2;
          }
        }

        // Remove orphaned error handler nodes
        if (node.type === "n8n-nodes-base.errorTrigger") {
          // Check if it's connected
          const isConnected = this.isNodeConnected(
            node.name,
            fixed.connections
          );
          if (!isConnected) {
            // Remove from nodes array
            fixed.nodes = fixed.nodes.filter((n) => n.id !== node.id);
            // Remove from connections
            delete fixed.connections[node.name];
          }
        }
      });
    }

    // 3. Add required fields
    if (!fixed.versionId) {
      fixed.versionId = this.generateVersionId();
    }

    if (!fixed.pinData) {
      fixed.pinData = {};
    }

    if (fixed.staticData === undefined) {
      fixed.staticData = null;
    }

    // 4. Ensure proper settings
    if (!fixed.settings) {
      fixed.settings = {};
    }
    if (!fixed.settings.executionOrder) {
      fixed.settings.executionOrder = "v1";
    }

    return fixed;
  }

  /**
   * Check if a node is connected
   */
  isNodeConnected(nodeName, connections) {
    // Check if node has outgoing connections
    if (connections[nodeName]) {
      return true;
    }

    // Check if node has incoming connections
    for (const [sourceName, outputs] of Object.entries(connections)) {
      if (outputs.main) {
        for (const output of outputs.main) {
          if (output && Array.isArray(output)) {
            for (const connection of output) {
              if (connection.node === nodeName) {
                return true;
              }
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * Generate instance ID
   */
  generateInstanceId() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
      ""
    );
  }

  /**
   * Generate version ID
   */
  generateVersionId() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }
}

export const workflowFixer = new WorkflowFormatFixer();
