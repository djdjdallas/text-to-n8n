import { useState, useCallback } from 'react';

export function useWorkflowGeneratorWithLoading() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStartTime, setGenerationStartTime] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const generateWorkflow = useCallback(async (params) => {
    setIsGenerating(true);
    setError(null);
    setResult(null);
    
    const startTime = Date.now();
    setGenerationStartTime(startTime);

    try {
      const response = await fetch('/api/generate/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...params,
          useRAG: true,
          validateOutput: true,
          provider: 'claude'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate workflow');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      setResult(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsGenerating(false);
      setGenerationStartTime(null);
    }
  }, []);

  const reset = useCallback(() => {
    setIsGenerating(false);
    setGenerationStartTime(null);
    setResult(null);
    setError(null);
  }, []);

  return {
    generateWorkflow,
    isGenerating,
    generationStartTime,
    result,
    error,
    reset
  };
}