import { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';

export function RetryValidation({ workflow, originalPrompt, onValidationComplete, className = '' }) {
  const [retrying, setRetrying] = useState(false);
  const [result, setResult] = useState(null);

  const handleRetry = async () => {
    setRetrying(true);
    setResult(null);

    try {
      const response = await fetch('/api/test/n8n-validation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflow,
          prompt: originalPrompt || 'Retry validation'
        })
      });

      const data = await response.json();
      setResult(data);

      if (onValidationComplete) {
        onValidationComplete(data);
      }
    } catch (error) {
      console.error('Validation retry failed:', error);
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {retrying ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Validating...
          </>
        ) : (
          <>
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Validation
          </>
        )}
      </button>

      {result && (
        <span className={`text-sm font-medium ${result.success ? 'text-green-600' : 'text-red-600'}`}>
          {result.success ? '✓ Validated' : '✗ Failed'}
          {result.attempts > 1 && ` (${result.attempts} attempts)`}
        </span>
      )}
    </div>
  );
}

// Simplified button version
export function RetryValidationButton({ workflow, onSuccess, size = 'default' }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/test/n8n-validation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workflow })
      });

      const data = await response.json();
      
      if (data.success && onSuccess) {
        onSuccess(data);
      }
    } catch (error) {
      console.error('Validation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'p-1',
    default: 'p-2',
    lg: 'p-3'
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`${sizeClasses[size]} rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
      title="Retry n8n validation"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <RefreshCw className="w-4 h-4" />
      )}
    </button>
  );
}