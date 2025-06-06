import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';

export function ValidationStats({ timeframe = '7d' }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [timeframe]);

  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/analytics/validation-stats?timeframe=${timeframe}`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch validation stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <div className="p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats || !stats.n8nValidation) {
    return (
      <div className="text-center text-muted-foreground p-8">
        No validation data available
      </div>
    );
  }

  const { n8nValidation } = stats;

  return (
    <div className="space-y-6">
      {/* Main metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground">
              Validation Success Rate
            </h3>
            <div className="mt-2 flex items-baseline">
              <p className="text-3xl font-bold text-green-600">
                {n8nValidation.successRate}%
              </p>
              <p className="ml-2 text-sm text-muted-foreground">
                ({n8nValidation.successful} of {n8nValidation.total})
              </p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Workflows validated successfully
            </p>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground">
              Auto-Fix Rate
            </h3>
            <div className="mt-2 flex items-baseline">
              <p className="text-3xl font-bold text-blue-600">
                {n8nValidation.avgAttempts ? 
                  ((n8nValidation.avgAttempts - 1) * 100 / n8nValidation.avgAttempts).toFixed(1) 
                  : '0'}%
              </p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Issues fixed automatically
            </p>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground">
              Avg Fix Attempts
            </h3>
            <div className="mt-2 flex items-baseline">
              <p className="text-3xl font-bold">
                {n8nValidation.avgAttempts?.toFixed(1) || '0'}
              </p>
              <p className="ml-2 text-sm text-muted-foreground">
                per workflow
              </p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Attempts to achieve valid workflow
            </p>
          </div>
        </Card>
      </div>

      {/* Performance metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground">
              Validation Performance
            </h3>
            <div className="mt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Avg Validation Time</span>
                <span className="font-medium">
                  {(n8nValidation.avgValidationTime / 1000).toFixed(2)}s
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Cache Hit Rate</span>
                <span className="font-medium text-green-600">
                  {n8nValidation.cacheHitRate}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Validations</span>
                <span className="font-medium">{n8nValidation.total}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground">
              Common Issues Fixed
            </h3>
            <div className="mt-4 space-y-2">
              {Object.entries(n8nValidation.errorTypes || {})
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([errorType, count]) => (
                  <div key={errorType} className="flex justify-between items-center">
                    <span className="text-sm capitalize">
                      {errorType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              {Object.keys(n8nValidation.errorTypes || {}).length === 0 && (
                <p className="text-sm text-muted-foreground">No errors tracked yet</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Fix strategies */}
      {Object.keys(n8nValidation.fixesApplied || {}).length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">
              Fix Strategies Applied
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(n8nValidation.fixesApplied)
                .sort(([,a], [,b]) => b - a)
                .map(([fix, count]) => (
                  <div key={fix} className="text-center">
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {fix.replace(/_/g, ' ')}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}