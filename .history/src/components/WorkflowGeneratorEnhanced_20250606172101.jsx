import { useState } from "react";
import { ValidationBadge } from "./ValidationBadge";
import { RetryValidation } from "./RetryValidation";
import { ValidationErrorSummary } from "./ValidationError";
import { Loader2 } from "lucide-react";
import Button from "./ui/Button";
// Example of how to integrate all the new validation features
export function WorkflowGeneratorEnhanced() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [input, setInput] = useState("");

  const generateWorkflow = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/generate/v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input,
          platform: "n8n",
          validateWithN8n: true,
          maxValidationAttempts: 3,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Generation error:", error);
      setResult({
        success: false,
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleValidationComplete = (validationResult) => {
    // Update the result with new validation data
    setResult((prev) => ({
      ...prev,
      validation: {
        ...prev.validation,
        n8nValidation: validationResult,
      },
    }));
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Input Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Workflow Generator</h2>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe the workflow you want to create..."
          className="w-full h-32 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Button
          variant="outline"
          onClick={generateWorkflow}
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border-2 border-blue-600"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Generate Workflow
        </Button>
      </div>

      {/* Results Section */}
      {result && (
        <div className="space-y-4">
          {/* Status and Validation Badge */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {result.success ? "Workflow Generated" : "Generation Failed"}
            </h3>
            {result.success && result.validation && (
              <div className="flex items-center gap-3">
                <ValidationBadge validation={result.validation} />
                {result.validation.n8nValidation &&
                  !result.validation.n8nValidation.success && (
                    <RetryValidation
                      workflow={result.workflow}
                      originalPrompt={input}
                      onValidationComplete={handleValidationComplete}
                    />
                  )}
              </div>
            )}
          </div>

          {/* Error Display */}
          {result.validation && !result.validation.n8nValidation?.success && (
            <ValidationErrorSummary validation={result.validation} />
          )}

          {/* Workflow Display */}
          {result.success && result.workflow && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Workflow JSON</h4>
                <Button
                  variant="outline"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      result.copyableJSON ||
                        JSON.stringify(result.workflow, null, 2)
                    )
                  }
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Copy to Clipboard
                </Button>
              </div>
              <pre className="p-4 bg-gray-100 rounded-lg overflow-x-auto text-sm">
                {result.copyableJSON ||
                  JSON.stringify(result.workflow, null, 2)}
              </pre>
            </div>
          )}

          {/* Metadata Display */}
          {result.metadata && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium hover:text-blue-600">
                Generation Details
              </summary>
              <div className="mt-2 p-3 bg-gray-50 rounded space-y-1">
                <p>Platform: {result.metadata.platform}</p>
                <p>
                  Generation Time:{" "}
                  {(result.metadata.generationTime / 1000).toFixed(2)}s
                </p>
                {result.metadata.timing?.n8nValidation > 0 && (
                  <p>
                    Validation Time:{" "}
                    {(result.metadata.timing.n8nValidation / 1000).toFixed(2)}s
                  </p>
                )}
                <p>
                  Tokens Used:{" "}
                  {result.metadata.inputTokens + result.metadata.outputTokens}
                </p>
                <p>Cost: ${result.metadata.cost.toFixed(4)}</p>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
