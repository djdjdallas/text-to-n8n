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
                <h3 className="text-lg font-medium mb-2">No Workflow Generated Yet</h3>
                <p className="text-muted-foreground">
                  Enter your workflow description on the left and click "Generate Workflow" to create your automation
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border p-4 gap-3">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold">Output</h2>
          {status === "success" && <Badge variant="success">Generated</Badge>}
          {isGenerating && <Badge>Generating...</Badge>}
          {status === "error" && <Badge variant="error">Error</Badge>}
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyJson}
            disabled={!output || isGenerating}
            className="min-w-[90px] h-9"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!output || isGenerating}
            className="min-w-[90px] h-9"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </Button>
          <Button 
            size="sm" 
            disabled={!output || isGenerating}
            className="min-w-[90px] h-9"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
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
              className={`px-4 py-2 text-sm font-medium relative ${
                activeTab === tab.id
                  ? "text-primary"
                  : "text-muted hover:text-foreground"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" style={{ bottom: '-1px' }}>
                  <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-2/3 h-0.5 bg-primary" style={{ height: '2px' }}></span>
                </span>
              )}
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
