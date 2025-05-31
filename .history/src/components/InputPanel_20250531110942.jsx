import React, { useState } from 'react';
import Button from './ui/Button';
import Textarea from './ui/Textarea';

const InputPanel = ({ onGenerate, isGenerating }) => {
  const [input, setInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [platform, setPlatform] = useState('n8n');
  const [complexity, setComplexity] = useState('moderate');
  const [errorHandling, setErrorHandling] = useState(false);
  const [optimization, setOptimization] = useState(50);
  
  const characterCount = input.length;
  const wordCount = input.trim() === '' ? 0 : input.trim().split(/\s+/).length;
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onGenerate({
      input,
      platform,
      complexity,
      errorHandling,
      optimization
    });
  };
  
  const handleClear = () => {
    setInput('');
  };
  
  const loadExample = () => {
    setInput('When a new email arrives in Gmail with the subject containing "Monthly Report", extract any PDF attachments and save them to Google Drive in a folder called "Monthly Reports", then send a Slack notification to the #reports channel with the file name and link.');
  };
  
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-lg font-semibold">Natural Language Input</h2>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={handleClear}>Clear</Button>
          <Button variant="outline" size="sm" onClick={loadExample}>Load Example</Button>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="flex flex-col flex-1">
        <div className="flex-1 p-4">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your automation workflow in plain English..."
            className="h-full min-h-[300px] text-base"
            rows={20}
          />
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>{characterCount} characters</span>
            <span>{wordCount} words</span>
          </div>
        </div>
        
        <div className="border-t border-border p-4">
          <button 
            type="button"
            className="mb-4 flex w-full items-center justify-between text-sm font-medium"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <span>Advanced Options</span>
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none"
              className={`transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            >
              <path 
                d="M6 9L12 15L18 9" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            </svg>
          </button>
          
          {showAdvanced && (
            <div className="space-y-4 rounded-md border border-border bg-card/50 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Target Platform</label>
                <select 
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="n8n">n8n</option>
                  <option value="zapier">Zapier</option>
                  <option value="make">Make (Integromat)</option>
                </select>
              </div>
              
              <div>
                <label className="mb-1 block text-sm font-medium">Workflow Complexity</label>
                <select 
                  value={complexity}
                  onChange={(e) => setComplexity(e.target.value)}
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="error-handling" className="ml-2 text-sm">Include Error Handling</label>
              </div>
              
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Optimization Level: {optimization}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={optimization}
                  onChange={(e) => setOptimization(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          )}
          
          <div className="mt-4">
            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              isLoading={isGenerating}
              disabled={input.trim() === ''}
            >
              Generate Workflow
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default InputPanel;