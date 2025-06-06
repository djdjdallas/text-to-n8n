import React, { useState, useEffect } from "react";
import Button from "./ui/button";
import Badge from "./ui/Badge";
import { DynamicLoadingText } from "./DynamicLoadingText";
import styles from "@/app/dashboard/dashboard.module.css";

// Mock Monaco Editor component - in a real app, you'd use the actual Monaco Editor
const MonacoEditor = ({ value, language }) => {
  return (
    <pre className={`h-full overflow-auto rounded-md p-4 text-sm ${styles.codeBlock}`}>
      <code>{value}</code>
    </pre>
  );
};

const OutputPanel = ({ output, isGenerating, generationTime, generationStartTime }) => {
  const [activeTab, setActiveTab] = useState("json");
  const [status, setStatus] = useState("idle"); // idle, success, error

  useEffect(() => {
    if (output) {
      setStatus("success");
    }
  }, [output]);

  const handleCopyJson = () => {
    if (output) {
      // EMERGENCY FIX: Debug what's in the output
      console.log("Output structure:", Object.keys(output));
      
      let contentToCopy = null;
      
      // Use copyableJSON if available (this contains only the workflow without metadata)
      if (output.copyableJSON) {
        console.log("Using copyableJSON for copy");
        contentToCopy = output.copyableJSON;
      } else if (output.workflow) {
        console.log("Using workflow object for copy");
        contentToCopy = JSON.stringify(output.workflow, null, 2);
      } else {
        console.log("Using fallback for copy");
        // EMERGENCY FIX: Just create a clean workflow object directly
        const minimalWorkflow = {
          name: "Generated Workflow",
          nodes: output.nodes || [],
          connections: output.connections || {},
          settings: { executionOrder: "v1" },
          meta: { instanceId: "workflow_instance_id" }
        };
        contentToCopy = JSON.stringify(minimalWorkflow, null, 2);
      }
      
      // EMERGENCY FIX: Check for metadata before copying
      if (contentToCopy.includes("_metadata")) {
        console.error("METADATA FOUND IN COPY CONTENT!");
        // Strip it out manually
        try {
          const parsed = JSON.parse(contentToCopy);
          delete parsed._metadata;
          delete parsed.metadata;
          delete parsed.instructions;
          delete parsed.validation;
          contentToCopy = JSON.stringify(parsed, null, 2);
        } catch (e) {
          console.error("Failed to clean JSON:", e);
        }
      }
      
      // Copy to clipboard
      navigator.clipboard.writeText(contentToCopy);
    }
  };

  const handleDownload = () => {
    if (output) {
      // EMERGENCY FIX: Same logic as copy function
      console.log("Output structure for download:", Object.keys(output));
      
      let contentToDownload = null;
      
      // Use copyableJSON if available (this contains only the workflow without metadata)
      if (output.copyableJSON) {
        console.log("Using copyableJSON for download");
        contentToDownload = output.copyableJSON;
      } else if (output.workflow) {
        console.log("Using workflow object for download");
        contentToDownload = JSON.stringify(output.workflow, null, 2);
      } else {
        console.log("Using fallback for download");
        // EMERGENCY FIX: Just create a clean workflow object directly
        const minimalWorkflow = {
          name: "Generated Workflow",
          nodes: output.nodes || [],
          connections: output.connections || {},
          settings: { executionOrder: "v1" },
          meta: { instanceId: "workflow_instance_id" }
        };
        contentToDownload = JSON.stringify(minimalWorkflow, null, 2);
      }
      
      // EMERGENCY FIX: Check for metadata before downloading
      if (contentToDownload.includes("_metadata")) {
        console.error("METADATA FOUND IN DOWNLOAD CONTENT!");
        // Strip it out manually
        try {
          const parsed = JSON.parse(contentToDownload);
          delete parsed._metadata;
          delete parsed.metadata;
          delete parsed.instructions;
          delete parsed.validation;
          contentToDownload = JSON.stringify(parsed, null, 2);
        } catch (e) {
          console.error("Failed to clean JSON:", e);
        }
      }
      
      const blob = new Blob([contentToDownload], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "workflow.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const tabs = [
    { id: "json", label: "JSON Output" },
    { id: "visual", label: "Visual Preview" },
    { id: "docs", label: "Documentation" },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "json":
        return output ? (
          <MonacoEditor
            value={
              (() => {
                // EMERGENCY FIX: Always ensure clean JSON display
                let displayContent;
                
                // First choice: Use copyableJSON field (ultra-clean version for n8n import)
                if (output.copyableJSON) {
                  displayContent = output.copyableJSON;
                } 
                // Second choice: Use the workflow object (should be clean)
                else if (output.workflow) {
                  displayContent = JSON.stringify(output.workflow, null, 2);
                }
                // Last resort: Use entire response (not recommended)
                else {
                  displayContent = JSON.stringify(output, null, 2);
                }
                
                // Final safety check - remove any metadata
                if (displayContent.includes("_metadata")) {
                  try {
                    const parsed = JSON.parse(displayContent);
                    delete parsed._metadata;
                    delete parsed.metadata;
                    delete parsed.instructions;
                    delete parsed.validation;
                    return JSON.stringify(parsed, null, 2);
                  } catch (e) {
                    console.error("Failed to clean display JSON:", e);
                  }
                }
                
                return displayContent;
              })()
            }
            language="json"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            {isGenerating ? (
              <DynamicLoadingText 
                isLoading={isGenerating} 
                startTime={generationStartTime || Date.now()} 
              />
            ) : (
              <div className="flex flex-col items-center text-center max-w-md mx-auto">
                <svg
                  width="80"
                  height="80"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="mb-4 text-muted-foreground/50"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                  <path d="M7.5 12h9" />
                  <path d="M12 7.5v9" />
                </svg>
                <h3 className="text-lg font-medium mb-2">
                  No Workflow Generated Yet
                </h3>
                <p className="text-muted-foreground">
                  Enter your workflow description on the left and click
                  "Generate Workflow" to create your automation
                </p>
              </div>
            )}
          </div>
        );
      case "visual":
        return (
          <div className="flex h-full items-center justify-center text-muted">
            <p>Visual preview coming soon</p>
          </div>
        );
      case "docs":
        return (
          <div className="flex h-full items-center justify-center text-muted">
            <p>Documentation coming soon</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between border-b border-border p-4 gap-3 ${styles.panelHeader}`}>
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold text-foreground">Output</h2>
          {status === "success" && <Badge variant="success" className={styles.badge}>Generated</Badge>}
          {isGenerating && <Badge className={styles.badge}>Generating...</Badge>}
          {status === "error" && <Badge variant="error" className={styles.badge}>Error</Badge>}
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyJson}
            disabled={!output || isGenerating}
            className={`min-w-[130px] h-9 ${styles.outlineButton}`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {output && output.copyableJSON ? "Copy for Import" : "Copy"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!output || isGenerating}
            className={`min-w-[90px] h-9 ${styles.outlineButton}`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </Button>
          <Button
            size="sm"
            disabled={!output || isGenerating}
            className={`min-w-[90px] h-9 ${styles.primaryButton}`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1"
            >
              <path d="M12 2v6" />
              <path d="M21 8v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8" />
              <path d="M12 10v10" />
              <path d="m3 8 9-6 9 6" />
            </svg>
            Deploy
          </Button>
        </div>
      </div>

      <div className="border-b border-border">
        <nav className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-2 text-sm font-medium ${styles.tabButton} ${
                activeTab === tab.id ? styles.active : ""
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 p-4 overflow-auto">{renderTabContent()}</div>

      {output && output.metadata && (
        <div className="border-t border-border p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted">Model:</span>
              <p className="font-medium">{output.metadata.model}</p>
            </div>
            <div>
              <span className="text-muted">Validation Score:</span>
              <p className="font-medium">
                {output.validation?.score}/100
              </p>
            </div>
            <div>
              <span className="text-muted">RAG Docs Used:</span>
              <p className="font-medium">{output.metadata.docsFound || 0}</p>
            </div>
            <div>
              <span className="text-muted">Valid:</span>
              <p className="font-medium">
                {output.validation?.isValid ? "✅ Yes" : "❌ No"}
              </p>
            </div>
          </div>

          {output.instructions && output.instructions.length > 0 && (
            <div className="mt-4 rounded-md bg-blue-500/10 p-3">
              <h4 className="font-medium mb-2">Import Instructions:</h4>
              <ol className="list-decimal list-inside text-sm space-y-1">
                {output.instructions.map((instruction, i) => (
                  <li key={i}>{instruction}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OutputPanel;
