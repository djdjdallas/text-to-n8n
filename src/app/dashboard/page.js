'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import InputPanel from '@/components/InputPanel';
import OutputPanel from '@/components/OutputPanel';
import BottomPanel from '@/components/BottomPanel';
import { API_ENDPOINTS } from '@/lib/constants';

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
  
  const handleGenerate = async (params) => {
    try {
      setIsGenerating(true);
      setOutput(null);
      
      const startTime = Date.now();
      
      const response = await fetch(API_ENDPOINTS.GENERATE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate workflow');
      }
      
      const data = await response.json();
      
      // Update metrics
      setMetrics({
        tokens: data.metadata.tokens,
        complexity: data.metadata.complexity,
        executionTime: data.metadata.generationTime,
        estimatedCost: data.metadata.estimatedCost,
      });
      
      // Set the output
      setOutput(data.workflow);
      
      // Auto-open the bottom panel with metrics
      setBottomPanelCollapsed(false);
    } catch (error) {
      console.error('Error generating workflow:', error);
      // Handle error state here
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <div className="flex h-screen flex-col">
      <Header />
      
      <main className="flex flex-1 overflow-hidden">
        <Sidebar isCollapsed={sidebarCollapsed} toggleSidebar={toggleSidebar} />
        
        <div className="flex flex-1 overflow-hidden">
          <div className="grid flex-1 grid-cols-1 md:grid-cols-2">
            <div className="border-r border-border overflow-auto">
              <InputPanel 
                onGenerate={handleGenerate} 
                isGenerating={isGenerating} 
              />
            </div>
            <div className="overflow-auto">
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