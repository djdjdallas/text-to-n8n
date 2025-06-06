import React, { useState } from "react";
import Button from "./ui/button";
import Textarea from "./ui/Textarea";
import styles from "@/app/dashboard/dashboard.module.css";

const InputPanel = ({ onGenerate, isGenerating }) => {
  const [input, setInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [platform, setPlatform] = useState("n8n");
  const [complexity, setComplexity] = useState("moderate");
  const [errorHandling, setErrorHandling] = useState(false);
  const [optimization, setOptimization] = useState(50);

  const characterCount = input.length;
  const wordCount = input.trim() === "" ? 0 : input.trim().split(/\s+/).length;

  const handleSubmit = (e) => {
    e.preventDefault();
    onGenerate({
      input,
      platform,
      complexity,
      errorHandling,
      optimization,
    });
  };

  const handleClear = () => {
    setInput("");
  };

  const loadExample = () => {
    setInput(
      'When a new email arrives in Gmail with the subject containing "Monthly Report", extract any PDF attachments and save them to Google Drive in a folder called "Monthly Reports", then send a Slack notification to the #reports channel with the file name and link.'
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className={`flex items-center justify-between border-b border-border p-4 ${styles.panelHeader}`}>
        <h2 className="text-lg font-semibold text-foreground">Natural Language Input</h2>
        <div className="flex space-x-4">
          <Button variant="outline" size="sm" onClick={handleClear} className={styles.outlineButton}>
            Clear
          </Button>
          <Button variant="outline" size="sm" onClick={loadExample} className={styles.outlineButton}>
            Load Example
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1">
        <div className={`flex-1 p-4 ${styles.panelContent}`}>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your automation workflow in plain English..."
            className={`h-full min-h-[200px] text-base ${styles.inputTextarea}`}
            rows={20}
          />
          <div className={`mt-2 flex justify-between text-xs ${styles.textMuted}`}>
            <span>{characterCount} characters</span>
            <span>{wordCount} words</span>
          </div>
        </div>

        <div className="border-t border-border p-4">
          <button
            type="button"
            className="mb-4 flex w-full items-center justify-between px-3 py-2 rounded-md border border-border hover:bg-card/50 text-sm font-medium"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <span className="flex items-center gap-2">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
              Advanced Options
            </span>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              className={`transform transition-transform ${
                showAdvanced ? "rotate-180" : ""
              }`}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9L12 15L18 9" />
            </svg>
          </button>

          {showAdvanced && (
            <div className={`space-y-4 ${styles.advancedPanel}`}>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Target Platform
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className={`w-full text-sm ${styles.select}`}
                >
                  <option value="n8n">n8n</option>
                  <option value="zapier">Zapier</option>
                  <option value="make">Make (Integromat)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Workflow Complexity
                </label>
                <select
                  value={complexity}
                  onChange={(e) => setComplexity(e.target.value)}
                  className={`w-full text-sm ${styles.select}`}
                >
                  <option value="simple">Simple</option>
                  <option value="moderate">Moderate</option>
                  <option value="complex">Complex</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="error-handling"
                  checked={errorHandling}
                  onChange={(e) => setErrorHandling(e.target.checked)}
                  className={`h-4 w-4 rounded ${styles.checkbox}`}
                />
                <label htmlFor="error-handling" className="ml-2 text-sm text-foreground">
                  Include Error Handling
                </label>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Optimization Level: {optimization}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={optimization}
                  onChange={(e) => setOptimization(parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          )}

          <div className="mt-4">
            <Button
              type="submit"
              className={`w-full ${styles.primaryButton}`}
              size="lg"
              isLoading={isGenerating}
              disabled={input.trim() === ""}
            >
              {isGenerating ? "Generating..." : "Generate Workflow"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default InputPanel;
