import { AlertCircle, Info, XCircle } from 'lucide-react';

// Map technical error types to user-friendly messages
const errorMessages = {
  'unknown_node': 'The workflow contains an unrecognized node type. This often happens with typos or incorrect casing.',
  'invalid_parameter': 'One or more nodes have invalid settings that need to be corrected.',
  'missing_parameter': 'Required settings are missing from one or more nodes.',
  'invalid_connection': 'Some nodes are trying to connect to nodes that don\'t exist.',
  'credential_error': 'There\'s an issue with the credential configuration.',
  'json_parse_error': 'The workflow structure has formatting issues.',
  'duplicate_node_name': 'Multiple nodes have the same name. Each node needs a unique name.',
  'invalid_expression': 'An expression in the workflow has syntax errors.',
  'missing_node_reference': 'A node is referencing another node that doesn\'t exist.',
  'invalid_credentials_reference': 'The workflow references credentials that aren\'t available.',
  'circular_reference': 'The workflow contains a circular dependency between nodes.',
  'invalid_webhook_method': 'A webhook node has an invalid HTTP method.',
  'validation_error': 'The workflow couldn\'t be validated due to a technical error.',
  'unknown_error': 'An unexpected error occurred during validation.'
};

export function ValidationError({ 
  error, 
  errorType, 
  suggestions = [], 
  history = [],
  variant = 'default' 
}) {
  const userMessage = errorMessages[errorType] || errorMessages['unknown_error'];
  
  if (variant === 'inline') {
    return (
      <div className="flex items-start gap-2 text-sm text-red-600">
        <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>{userMessage}</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <h3 className="font-medium text-red-900">Validation Issue</h3>
          <p className="text-sm text-red-800">{userMessage}</p>
          
          {suggestions && suggestions.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-sm font-medium text-red-900">Suggestions:</p>
              <ul className="list-disc list-inside space-y-1">
                {suggestions.map((suggestion, i) => (
                  <li key={i} className="text-sm text-red-700">
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {history && history.length > 1 && (
            <details className="mt-3">
              <summary className="text-sm font-medium text-red-900 cursor-pointer hover:text-red-700">
                View validation attempts ({history.length})
              </summary>
              <div className="mt-2 space-y-2">
                {history.map((attempt, i) => (
                  <div key={i} className="text-sm pl-4 border-l-2 border-red-200">
                    <span className="font-medium">Attempt {attempt.attempt}:</span>{' '}
                    <span className={attempt.success ? 'text-green-600' : 'text-red-600'}>
                      {attempt.success ? 'Success' : 'Failed'}
                    </span>
                    {attempt.errorType && (
                      <span className="text-red-600 ml-2">
                        ({errorMessages[attempt.errorType] || attempt.errorType})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}

          {error && process.env.NODE_ENV === 'development' && (
            <details className="mt-3">
              <summary className="text-sm font-medium text-red-900 cursor-pointer hover:text-red-700">
                Technical details (dev only)
              </summary>
              <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-x-auto">
                {error}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

// Simplified error tooltip for inline use
export function ValidationErrorTooltip({ errorType, children }) {
  const message = errorMessages[errorType] || errorMessages['unknown_error'];
  
  return (
    <div className="group relative inline-flex">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
        {message}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
          <div className="border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    </div>
  );
}

// Error summary for validation results
export function ValidationErrorSummary({ validation }) {
  if (!validation || !validation.n8nValidation || validation.n8nValidation.success) {
    return null;
  }

  const { n8nValidation } = validation;
  const lastError = n8nValidation.history?.find(h => !h.success);

  return (
    <ValidationError
      error={n8nValidation.lastError}
      errorType={lastError?.errorType || 'unknown_error'}
      suggestions={n8nValidation.suggestions}
      history={n8nValidation.history}
    />
  );
}