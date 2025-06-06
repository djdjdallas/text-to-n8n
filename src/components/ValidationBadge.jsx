import { Badge } from '@/components/ui/Badge';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

export function ValidationBadge({ validation, className = '' }) {
  if (!validation || !validation.n8nValidation) {
    return null;
  }

  const { n8nValidation } = validation;

  // If validation wasn't tested
  if (!n8nValidation.tested) {
    return (
      <Badge variant="secondary" className={`gap-1 ${className}`}>
        <AlertCircle className="w-3 h-3" />
        Not Validated
      </Badge>
    );
  }

  // If validation is in progress (for future real-time updates)
  if (n8nValidation.inProgress) {
    return (
      <Badge variant="secondary" className={`gap-1 ${className}`}>
        <Loader2 className="w-3 h-3 animate-spin" />
        Validating...
      </Badge>
    );
  }

  // If validation succeeded
  if (n8nValidation.success) {
    const attempts = n8nValidation.attempts || 1;
    return (
      <Badge variant="default" className={`gap-1 bg-green-600 hover:bg-green-700 ${className}`}>
        <CheckCircle className="w-3 h-3" />
        n8n Validated
        {attempts > 1 && (
          <span className="ml-1 text-xs opacity-80">
            ({attempts} attempts)
          </span>
        )}
        {n8nValidation.fromCache && (
          <span className="ml-1 text-xs opacity-80">(cached)</span>
        )}
      </Badge>
    );
  }

  // If validation failed
  return (
    <Badge variant="destructive" className={`gap-1 ${className}`}>
      <XCircle className="w-3 h-3" />
      Validation Failed
      {n8nValidation.attempts > 1 && (
        <span className="ml-1 text-xs opacity-80">
          ({n8nValidation.attempts} attempts)
        </span>
      )}
    </Badge>
  );
}

// Mini version for inline use
export function ValidationBadgeMini({ validated, success, attempts, fromCache }) {
  if (!validated) return null;

  if (success) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600">
        <CheckCircle className="w-3 h-3" />
        <span>Validated</span>
        {attempts > 1 && <span className="opacity-70">({attempts}x)</span>}
        {fromCache && <span className="opacity-70">(cached)</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-600">
      <XCircle className="w-3 h-3" />
      <span>Failed</span>
    </span>
  );
}