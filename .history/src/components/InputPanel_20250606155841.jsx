// components/InputPanel.jsx
"use client";

import { useState, useEffect } from "react";
import { Sparkles, AlertCircle } from "lucide-react";

export default function InputPanel({
  onGenerate,
  isGenerating,
  selectedPrompt,
  workflowPrompts,
}) {
  const [input, setInput] = useState("");
  const [platform, setPlatform] = useState("all");
  const [complexity, setComplexity] = useState("balanced");
  const [errorHandling, setErrorHandling] = useState(true);
  const [optimization, setOptimization] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredPrompts, setFilteredPrompts] = useState([]);

  // Update input when a prompt is selected
  useEffect(() => {
    if (selectedPrompt) {
      setInput(selectedPrompt.prompt_text);
      // Auto-set complexity based on prompt
      if (selectedPrompt.complexity_level) {
        setComplexity(selectedPrompt.complexity_level);
      }
    }
  }, [selectedPrompt]);

  // Filter prompts for autocomplete
  useEffect(() => {
    if (input.length > 2 && !selectedPrompt) {
      const filtered = workflowPrompts
        .filter((prompt) =>
          prompt.prompt_text.toLowerCase().includes(input.toLowerCase())
        )
        .slice(0, 5);
      setFilteredPrompts(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [input, workflowPrompts, selectedPrompt]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isGenerating) {
      onGenerate({
        input: input.trim(),
        platform,
        complexity,
        errorHandling,
        optimization,
      });
    }
  };

  const handleSuggestionClick = (prompt) => {
    setInput(prompt.prompt_text);
    setShowSuggestions(false);
    if (prompt.complexity_level) {
      setComplexity(prompt.complexity_level);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <h2 className="text-xl font-semibold mb-1">Workflow Generator</h2>
        <p className="text-sm text-muted-foreground">
          Describe your automation workflow in natural language
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex-1 p-6 space-y-6 overflow-y-auto"
      >
        {/* Input Field */}
        <div className="space-y-2">
          <label htmlFor="workflow-input" className="text-sm font-medium">
            Workflow Description
          </label>
          <div className="relative">
            <textarea
              id="workflow-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Example: When I receive an email with an attachment, save it to Google Drive and notify me on Slack"
              className="w-full min-h-[120px] p-3 bg-background border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isGenerating}
            />

            {/* Autocomplete Suggestions */}
            {showSuggestions && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                <div className="p-2 text-xs text-muted-foreground border-b border-border">
                  <AlertCircle size={12} className="inline mr-1" />
                  Similar prompts from library:
                </div>
                {filteredPrompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    type="button"
                    onClick={() => handleSuggestionClick(prompt)}
                    className="w-full text-left p-3 hover:bg-accent transition-colors border-b border-border last:border-b-0"
                  >
                    <div className="text-sm line-clamp-2">
                      {prompt.prompt_text}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {prompt.category} • {prompt.complexity_level}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedPrompt && (
            <div className="text-xs text-muted-foreground">
              Using prompt from: {selectedPrompt.category}
            </div>
          )}
        </div>

        {/* Platform Selection */}
        <div className="space-y-2">
          <label htmlFor="platform" className="text-sm font-medium">
            Target Platform
          </label>
          <select
            id="platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full p-2 bg-background border border-input rounded-md"
            disabled={isGenerating}
          >
            <option value="all">Auto-detect</option>
            <option value="make">Make (Integromat)</option>
            <option value="zapier">Zapier</option>
            <option value="n8n">n8n</option>
            <option value="powerautomate">Power Automate</option>
          </select>
        </div>

        {/* Complexity Level */}
        <div className="space-y-2">
          <label htmlFor="complexity" className="text-sm font-medium">
            Complexity Level
          </label>
          <select
            id="complexity"
            value={complexity}
            onChange={(e) => setComplexity(e.target.value)}
            className="w-full p-2 bg-background border border-input rounded-md"
            disabled={isGenerating}
          >
            <option value="basic">Basic - Simple linear flow</option>
            <option value="balanced">Balanced - Some conditions</option>
            <option value="moderate">Moderate - Multiple branches</option>
            <option value="advanced">Advanced - Complex logic</option>
          </select>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Options</label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={errorHandling}
                onChange={(e) => setErrorHandling(e.target.checked)}
                className="rounded border-input"
                disabled={isGenerating}
              />
              <span className="text-sm">Include error handling</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={optimization}
                onChange={(e) => setOptimization(e.target.checked)}
                className="rounded border-input"
                disabled={isGenerating}
              />
              <span className="text-sm">Optimize for efficiency</span>
            </label>
          </div>
        </div>

        {/* Generate Button */}
        <button
          type="submit"
          disabled={!input.trim() || isGenerating}
          className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <Sparkles size={20} />
          {isGenerating ? "Generating..." : "Generate Workflow"}
        </button>
      </form>
    </div>
  );
}
