"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import InputPanel from "@/components/InputPanel";
import OutputPanel from "@/components/OutputPanel";
import BottomPanel from "@/components/BottomPanel";
import { API_ENDPOINTS } from "@/lib/constants";
import styles from "./dashboard.module.css";

export default function Dashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [output, setOutput] = useState(null);
  const [generationStartTime, setGenerationStartTime] = useState(null);
  const [workflowPrompts, setWorkflowPrompts] = useState([]);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [metrics, setMetrics] = useState({
    tokens: 0,
    complexity: 0,
    executionTime: 0,
    estimatedCost: 0,
  });

  // Fetch workflow prompts on component mount
  useEffect(() => {
    fetchWorkflowPrompts();
  }, []);

  const fetchWorkflowPrompts = async () => {
    try {
      setPromptsLoading(true);
      const response = await fetch("/api/workflow-prompts");
      if (response.ok) {
        const data = await response.json();
        setWorkflowPrompts(data.prompts || []);
      }
    } catch (error) {
      console.error("Error fetching workflow prompts:", error);
    } finally {
      setPromptsLoading(false);
    }
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const toggleBottomPanel = () => {
    setBottomPanelCollapsed(!bottomPanelCollapsed);
  };

  const handlePromptSelect = (prompt) => {
    setSelectedPrompt(prompt);
    // This will be passed to InputPanel to populate the input field
  };

  const handleGenerate = async (params) => {
    try {
      setIsGenerating(true);
      setOutput(null);

      const startTime = Date.now();
      setGenerationStartTime(startTime);

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
          promptId: selectedPrompt?.id, // Track which prompt was used
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

      // Set the output with additional metadata
      setOutput({
        ...data.workflow,
        _metadata: {
          validation: data.validation,
          instructions: data.instructions,
          model: data.metadata?.model,
          ragDocs: data.metadata?.docsFound,
          usedPrompt: selectedPrompt,
        },
      });

      // Auto-open the bottom panel with metrics
      setBottomPanelCollapsed(false);

      // Show success notification if validation passed
      if (data.validation?.isValid) {
        console.log(
          "Workflow generated successfully with score:",
          data.validation.score
        );
      }

      // Track successful generation if using a prompt
      if (selectedPrompt?.id) {
        await fetch(`/api/workflow-prompts/${selectedPrompt.id}/track`, {
          method: "POST",
        });
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
          "Try using one of the example prompts from the sidebar",
        ],
      });
    } finally {
      setIsGenerating(false);
      setGenerationStartTime(null);
      setSelectedPrompt(null);
    }
  };

  return (
    <div className={`flex h-full flex-col ${styles.dashboardContainer}`}>
      <main className="flex flex-1 overflow-hidden">
        <Sidebar
          isCollapsed={sidebarCollapsed}
          toggleSidebar={toggleSidebar}
          workflowPrompts={workflowPrompts}
          onPromptSelect={handlePromptSelect}
          promptsLoading={promptsLoading}
        />

        <div className="flex flex-1 overflow-hidden">
          <div className="grid flex-1 grid-cols-1 md:grid-cols-2 max-h-full">
            <div
              className={`border-r border-border overflow-auto min-h-[300px] md:min-h-0 ${styles.panel}`}
            >
              <InputPanel
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
                selectedPrompt={selectedPrompt}
                workflowPrompts={workflowPrompts}
              />
            </div>
            <div
              className={`overflow-auto min-h-[300px] md:min-h-0 ${styles.panel}`}
            >
              <OutputPanel
                output={output}
                isGenerating={isGenerating}
                generationTime={metrics.executionTime}
                generationStartTime={generationStartTime}
              />
            </div>
          </div>
        </div>
      </main>

      <BottomPanel
        metrics={metrics}
        isCollapsed={bottomPanelCollapsed}
        togglePanel={toggleBottomPanel}
        additionalInfo={output?._metadata}
      />
    </div>
  );
}
