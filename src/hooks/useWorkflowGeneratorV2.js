// src/hooks/useWorkflowGeneratorV2.js
import { useState } from "react";
import { API_ENDPOINTS } from "@/lib/constants";

export function useWorkflowGeneratorV2() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const generateWorkflow = async (params) => {
    console.log('🎯 [CLIENT] Starting workflow generation...');
    setIsGenerating(true);
    setError(null);

    try {
      const requestBody = {
        input: params.input,
        platform: params.platform || "n8n",
        complexity: params.complexity || "simple",
        errorHandling: params.errorHandling ?? true,
        optimization: params.optimization || 50,
        provider: params.provider || "claude",
        useRAG: params.useRAG ?? true,
        validateOutput: params.validateOutput ?? true,
      };
      
      console.log('📝 [CLIENT] Request body:', requestBody);

      const response = await fetch("/api/generate/v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📡 [CLIENT] Response received:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [CLIENT] Error response:', errorText);
        throw new Error(errorText);
      }

      const data = await response.json();
      console.log('✅ [CLIENT] Data parsed successfully');

      if (!data.success) {
        throw new Error(data.error || "Failed to generate workflow");
      }

      setResult(data);
      return data;
    } catch (err) {
      console.error('❌ [CLIENT] Request failed:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  const copyWorkflowToClipboard = async () => {
    if (!result?.workflow) return false;

    try {
      const jsonString = JSON.stringify(result.workflow, null, 2);
      await navigator.clipboard.writeText(jsonString);
      return true;
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      return false;
    }
  };

  const downloadWorkflow = () => {
    if (!result?.workflow) return;

    const jsonString = JSON.stringify(result.workflow, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.workflow.name || "workflow"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return {
    generateWorkflow,
    copyWorkflowToClipboard,
    downloadWorkflow,
    isGenerating,
    error,
    result,
  };
}

// Example React component using the hook
// src/components/WorkflowGeneratorV2.jsx
import React, { useState } from "react";
import { useWorkflowGeneratorV2 } from "@/hooks/useWorkflowGeneratorV2";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/button";
import Textarea from "@/components/ui/Textarea";
import Badge from "@/components/ui/Badge";

export function WorkflowGeneratorV2() {
  const [input, setInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [options, setOptions] = useState({
    platform: "n8n",
    complexity: "simple",
    errorHandling: true,
    useRAG: true,
    validateOutput: true,
  });

  const {
    generateWorkflow,
    copyWorkflowToClipboard,
    downloadWorkflow,
    isGenerating,
    error,
    result,
  } = useWorkflowGeneratorV2();

  const handleGenerate = async () => {
    try {
      await generateWorkflow({
        input,
        ...options,
      });
    } catch (err) {
      // Error is already handled by the hook
    }
  };

  const handleCopy = async () => {
    const success = await copyWorkflowToClipboard();
    if (success) {
      // Show success notification
      alert("Workflow copied to clipboard!");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Workflow Generator V2</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Describe your workflow
            </label>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="When I receive an email in Gmail, send a notification to Slack..."
              rows={4}
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-primary hover:underline"
            >
              {showAdvanced ? "Hide" : "Show"} Advanced Options
            </button>

            <div className="flex gap-2">
              <span className="text-sm text-muted">Platform:</span>
              <select
                value={options.platform}
                onChange={(e) =>
                  setOptions({ ...options, platform: e.target.value })
                }
                className="text-sm border rounded px-2 py-1"
              >
                <option value="n8n">n8n</option>
                <option value="zapier">Zapier</option>
                <option value="make">Make</option>
              </select>
            </div>
          </div>

          {showAdvanced && (
            <div className="border rounded p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Complexity
                  </label>
                  <select
                    value={options.complexity}
                    onChange={(e) =>
                      setOptions({ ...options, complexity: e.target.value })
                    }
                    className="w-full border rounded px-2 py-1"
                  >
                    <option value="simple">Simple</option>
                    <option value="moderate">Moderate</option>
                    <option value="complex">Complex</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.errorHandling}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          errorHandling: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm">Include Error Handling</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.useRAG}
                      onChange={(e) =>
                        setOptions({ ...options, useRAG: e.target.checked })
                      }
                    />
                    <span className="text-sm">Use Documentation RAG</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.validateOutput}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          validateOutput: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm">Validate Output</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={!input.trim() || isGenerating}
            className="w-full"
          >
            {isGenerating ? "Generating..." : "Generate Workflow"}
          </Button>

          {error && (
            <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-500">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Generated Workflow</span>
              <div className="flex gap-2">
                {result.validation && (
                  <Badge
                    variant={result.validation.isValid ? "success" : "warning"}
                  >
                    Score: {result.validation.score}/100
                  </Badge>
                )}
                <Badge>{result.metadata?.model || "Unknown Model"}</Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Metadata */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted">Generation Time:</span>
                <p className="font-medium">
                  {result.metadata?.generationTime}ms
                </p>
              </div>
              <div>
                <span className="text-muted">Cost:</span>
                <p className="font-medium">
                  ${result.metadata?.cost?.toFixed(4) || "0.0000"}
                </p>
              </div>
              <div>
                <span className="text-muted">RAG Docs:</span>
                <p className="font-medium">{result.metadata?.docsFound || 0}</p>
              </div>
              <div>
                <span className="text-muted">Tokens:</span>
                <p className="font-medium">
                  {result.metadata?.inputTokens || 0} /{" "}
                  {result.metadata?.outputTokens || 0}
                </p>
              </div>
            </div>

            {/* Instructions for n8n */}
            {result.instructions && (
              <div className="rounded-md bg-blue-500/10 p-4">
                <h4 className="font-medium mb-2">Import Instructions:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  {result.instructions.map((instruction, i) => (
                    <li key={i}>{instruction}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Validation Results */}
            {result.validation && (
              <div className="space-y-2">
                {result.validation.errors?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-red-500 mb-1">Errors:</h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {result.validation.errors.map((error, i) => (
                        <li key={i}>{error.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.validation.warnings?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-yellow-500 mb-1">
                      Warnings:
                    </h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {result.validation.warnings.map((warning, i) => (
                        <li key={i}>{warning.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.validation.suggestions?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-blue-500 mb-1">
                      Suggestions:
                    </h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {result.validation.suggestions.map((suggestion, i) => (
                        <li key={i}>{suggestion.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Workflow Preview */}
            <div>
              <h4 className="font-medium mb-2">Workflow Preview:</h4>
              <pre className="bg-card/50 p-4 rounded-md overflow-auto max-h-96 text-xs">
                {JSON.stringify(result.workflow, null, 2)}
              </pre>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button onClick={handleCopy} variant="outline">
                Copy JSON
              </Button>
              <Button onClick={downloadWorkflow} variant="outline">
                Download JSON
              </Button>
              {options.platform === "n8n" && (
                <Button
                  onClick={() => {
                    // Open n8n import documentation
                    window.open(
                      "https://docs.n8n.io/workflows/import/",
                      "_blank"
                    );
                  }}
                  variant="outline"
                >
                  n8n Import Guide
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
