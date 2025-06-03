"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import InputPanel from "@/components/InputPanel";
import OutputPanel from "@/components/OutputPanel";
import BottomPanel from "@/components/BottomPanel";
import { API_ENDPOINTS } from "@/lib/constants";

export default function Dashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [output, setOutput] = useState(null);
  const [metrics, setMetrics] = useState({
    tokens: 0,
    complexity: 0,
    executionTime: 0,
    estimatedCost: 0,
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const toggleBottomPanel = () => {
    setBottomPanelCollapsed(!bottomPanelCollapsed);
  };

  // Replace the existing handleGenerate function with this updated version:

  const handleGenerate = async (params) => {
    try {
      setIsGenerating(true);
      setOutput(null);

      const startTime = Date.now();

      // Use V2 endpoint
      const response = await fetch("/api/generate/v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: params.input,
          platform: params.platform,
          complexity: params.complexity,
          errorHandling: params.errorHandling,
          optimization: params.optimization,
          provider: "claude", // Use Claude by default
          useRAG: true, // Enable RAG
          validateOutput: true, // Enable validation
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate workflow");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Generation failed");
      }

      // Update metrics with V2 response structure
      setMetrics({
        tokens:
          (data.metadata?.inputTokens || 0) +
          (data.metadata?.outputTokens || 0),
        complexity: data.validation?.score || 0,
        executionTime: data.metadata?.generationTime / 1000 || 0,
        estimatedCost: data.metadata?.cost || 0,
      });

      // Set the output
      setOutput(data.workflow);

      // Store additional metadata for display
      setOutput((prevOutput) => ({
        ...data.workflow,
        _metadata: {
          validation: data.validation,
          instructions: data.instructions,
          model: data.metadata?.model,
          ragDocs: data.metadata?.docsFound,
        },
      }));

      // Auto-open the bottom panel with metrics
      setBottomPanelCollapsed(false);

      // Show success notification if validation passed
      if (data.validation?.isValid) {
        // You can add a toast notification here
        console.log(
          "Workflow generated successfully with score:",
          data.validation.score
        );
      }
    } catch (error) {
      console.error("Error generating workflow:", error);

      // Enhanced error handling
      setOutput({
        error: true,
        message: error.message,
        suggestions: error.suggestions || [
          "Try simplifying your workflow description",
          "Check that all app names are spelled correctly",
          "Ensure you have a stable internet connection",
        ],
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <main className="flex flex-1 overflow-hidden">
        <Sidebar isCollapsed={sidebarCollapsed} toggleSidebar={toggleSidebar} />

        <div className="flex flex-1 overflow-hidden">
          <div className="grid flex-1 grid-cols-1 md:grid-cols-2 max-h-full">
            <div className="border-r border-border overflow-auto min-h-[300px] md:min-h-0">
              <InputPanel
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
              />
            </div>
            <div className="overflow-auto min-h-[300px] md:min-h-0">
              <OutputPanel
                output={output}
                isGenerating={isGenerating}
                generationTime={metrics.executionTime}
              />
            </div>
          </div>
        </div>
      </main>

      <BottomPanel
        metrics={metrics}
        isCollapsed={bottomPanelCollapsed}
        togglePanel={toggleBottomPanel}
      />
    </div>
  );
}
