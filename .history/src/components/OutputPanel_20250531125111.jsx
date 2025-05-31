import React, { useState, useEffect } from "react";
import Button from "./ui/button";
import Badge from "./ui/Badge";

// Mock Monaco Editor component - in a real app, you'd use the actual Monaco Editor
const MonacoEditor = ({ value, language }) => {
  return (
    <pre className="h-full overflow-auto rounded-md bg-card/50 p-4 text-sm">
      <code>{value}</code>
    </pre>
  );
};

const OutputPanel = ({ output, isGenerating, generationTime }) => {
  const [activeTab, setActiveTab] = useState("json");
  const [status, setStatus] = useState("idle"); // idle, success, error

  useEffect(() => {
    if (output) {
      setStatus("success");
    }
  }, [output]);

  const handleCopyJson = () => {
    if (output) {
      navigator.clipboard.writeText(JSON.stringify(output, null, 2));
    }
  };

  const handleDownload = () => {
    if (output) {
      const blob = new Blob([JSON.stringify(output, null, 2)], {
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
            value={JSON.stringify(output, null, 2)}
            language="json"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            {isGenerating ? (
              <div className="flex flex-col items-center">
                <svg
                  className="mb-4 h-12 w-12 animate-spin text-primary"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <p>Generating your workflow...</p>
              </div>
            ) : (
              <p>
                Enter your workflow description and click "Generate Workflow"
              </p>
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
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold">Output</h2>
          {status === "success" && <Badge variant="success">Generated</Badge>}
          {isGenerating && <Badge>Generating...</Badge>}
          {status === "error" && <Badge variant="error">Error</Badge>}
        </div>

        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyJson}
            disabled={!output || isGenerating}
          >
            Copy JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!output || isGenerating}
          >
            Download
          </Button>
          <Button size="sm" disabled={!output || isGenerating}>
            Deploy
          </Button>
        </div>
      </div>

      <div className="border-b border-border">
        <nav className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === tab.id
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted hover:text-foreground"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 p-4 overflow-auto">{renderTabContent()}</div>

      {output && !isGenerating && (
        <div className="border-t border-border p-4">
          <div className="rounded-md bg-card/50 p-4">
            <h3 className="mb-2 font-medium">Optimization Suggestions</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start">
                <svg
                  className="mr-2 h-5 w-5 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 12.5l3 3 5-6"
                  ></path>
                </svg>
                <span>Consider adding error handling for API rate limits</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="mr-2 h-5 w-5 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 12.5l3 3 5-6"
                  ></path>
                </svg>
                <span>Implement data validation before processing</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutputPanel;
