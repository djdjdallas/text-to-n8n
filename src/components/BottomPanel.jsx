import React from 'react';
import Badge from './ui/Badge';

const BottomPanel = ({ metrics = {}, isCollapsed, togglePanel }) => {
  const {
    tokens = 0,
    complexity = 0,
    executionTime = 0,
    estimatedCost = 0,
  } = metrics;
  
  return (
    <div className={`border-t border-border transition-all duration-300 ${isCollapsed ? 'h-8' : 'h-48'}`}>
      <div className="flex h-8 items-center justify-between px-4">
        <h3 className="text-sm font-medium">Generation Metrics</h3>
        <button 
          onClick={togglePanel}
          className="p-1 rounded-md hover:bg-card/50"
          aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none"
            className={`transform transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
          >
            <path 
              d="M18 15L12 9L6 15" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          </svg>
        </button>
      </div>
      
      {!isCollapsed && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 h-[calc(100%-2.5rem)] overflow-auto">
          <div className="rounded-md border border-border p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs text-muted">Tokens Used</h4>
                <p className="text-2xl font-bold">{tokens.toLocaleString()}</p>
              </div>
              <div>
                <h4 className="text-xs text-muted">Complexity Score</h4>
                <div className="flex items-center">
                  <p className="text-2xl font-bold">{complexity}</p>
                  <Badge className="ml-2" variant={complexity < 30 ? 'success' : complexity < 70 ? 'warning' : 'error'}>
                    {complexity < 30 ? 'Low' : complexity < 70 ? 'Medium' : 'High'}
                  </Badge>
                </div>
              </div>
              <div>
                <h4 className="text-xs text-muted">Execution Time</h4>
                <p className="text-2xl font-bold">{executionTime}s</p>
              </div>
              <div>
                <h4 className="text-xs text-muted">Estimated Cost</h4>
                <p className="text-2xl font-bold">${estimatedCost.toFixed(4)}</p>
              </div>
            </div>
          </div>
          
          <div className="rounded-md border border-border p-4">
            <h4 className="mb-2 text-sm font-medium">Provide Feedback</h4>
            <div className="mb-2 flex space-x-1">
              <button className="rounded-md border border-border p-2 hover:bg-card/50" aria-label="Thumbs up">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M7 10V18M7 10L4 10V18L7 18M7 10L14.1937 10C16.1962 10 16.9409 10.0146 17.6 10.1587C17.8745 10.2178 18.146 10.304 18.4383 10.5757C18.9 11 19 11.5 19 11.5C19 11.5 20 13 20 15C20 17 19 18.5 19 18.5C19 18.5 18.8 19.1 18.4383 19.4243C18.146 19.696 17.8745 19.7822 17.6 19.8413C16.9409 19.9854 16.1962 20 14.1937 20H12C10 20 9 19 9 19C9 19 8 18 8 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <button className="rounded-md border border-border p-2 hover:bg-card/50" aria-label="Thumbs down">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M7 14V6M7 14L4 14V6L7 6M7 14L14.1937 14C16.1962 14 16.9409 13.9854 17.6 13.8413C17.8745 13.7822 18.146 13.696 18.4383 13.4243C18.9 13 19 12.5 19 12.5C19 12.5 20 11 20 9C20 7 19 5.5 19 5.5C19 5.5 18.8 4.9 18.4383 4.57573C18.146 4.30402 17.8745 4.21777 17.6 4.15873C16.9409 4.01463 16.1962 4 14.1937 4H12C10 4 9 5 9 5C9 5 8 6 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <textarea 
              placeholder="What could be improved?"
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              rows="2"
            ></textarea>
          </div>
        </div>
      )}
    </div>
  );
};

export default BottomPanel;