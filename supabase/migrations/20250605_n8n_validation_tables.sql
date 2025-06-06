-- Add n8n validation columns to workflow_generations table
ALTER TABLE workflow_generations 
ADD COLUMN IF NOT EXISTS n8n_validated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS n8n_validation_success BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS n8n_validation_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS n8n_validation_time_ms INTEGER DEFAULT 0;

-- Create n8n_validations table for detailed tracking
CREATE TABLE IF NOT EXISTS n8n_validations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  attempts INTEGER NOT NULL,
  validation_time_ms INTEGER NOT NULL,
  error_type TEXT,
  fix_applied TEXT,
  from_cache BOOLEAN DEFAULT false,
  cache_hit_rate DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_n8n_validations_workflow_id ON n8n_validations(workflow_id);
CREATE INDEX IF NOT EXISTS idx_n8n_validations_created_at ON n8n_validations(created_at);
CREATE INDEX IF NOT EXISTS idx_n8n_validations_success ON n8n_validations(success);
CREATE INDEX IF NOT EXISTS idx_n8n_validations_error_type ON n8n_validations(error_type);

-- Add indexes to workflow_generations for n8n columns
CREATE INDEX IF NOT EXISTS idx_workflow_generations_n8n_validated ON workflow_generations(n8n_validated);
CREATE INDEX IF NOT EXISTS idx_workflow_generations_n8n_success ON workflow_generations(n8n_validation_success);

-- Create a view for validation statistics
CREATE OR REPLACE VIEW n8n_validation_stats AS
SELECT 
  COUNT(*) as total_validations,
  COUNT(CASE WHEN success THEN 1 END) as successful_validations,
  ROUND(AVG(attempts)::numeric, 2) as avg_attempts,
  ROUND(AVG(validation_time_ms)::numeric, 2) as avg_validation_time_ms,
  COUNT(CASE WHEN from_cache THEN 1 END) as cache_hits,
  ROUND(AVG(cache_hit_rate)::numeric, 2) as avg_cache_hit_rate,
  COUNT(DISTINCT error_type) as unique_error_types,
  DATE_TRUNC('day', created_at) as date
FROM n8n_validations
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Create a function to get validation metrics by timeframe
CREATE OR REPLACE FUNCTION get_n8n_validation_metrics(timeframe TEXT DEFAULT '7d')
RETURNS TABLE (
  total_validations BIGINT,
  successful_validations BIGINT,
  success_rate DECIMAL(5,2),
  avg_attempts DECIMAL(5,2),
  avg_validation_time_ms DECIMAL(10,2),
  cache_hit_rate DECIMAL(5,2),
  top_errors JSONB,
  top_fixes JSONB
) AS $$
DECLARE
  start_date TIMESTAMP;
BEGIN
  -- Calculate start date based on timeframe
  start_date := CASE 
    WHEN timeframe = '24h' THEN NOW() - INTERVAL '24 hours'
    WHEN timeframe = '7d' THEN NOW() - INTERVAL '7 days'
    WHEN timeframe = '30d' THEN NOW() - INTERVAL '30 days'
    ELSE NOW() - INTERVAL '7 days'
  END;
  
  RETURN QUERY
  WITH validation_data AS (
    SELECT * FROM n8n_validations 
    WHERE created_at >= start_date
  ),
  error_counts AS (
    SELECT error_type, COUNT(*) as count
    FROM validation_data
    WHERE error_type IS NOT NULL
    GROUP BY error_type
    ORDER BY count DESC
    LIMIT 5
  ),
  fix_counts AS (
    SELECT fix_applied, COUNT(*) as count
    FROM validation_data
    WHERE fix_applied IS NOT NULL
    GROUP BY fix_applied
    ORDER BY count DESC
    LIMIT 5
  )
  SELECT 
    COUNT(*)::BIGINT as total_validations,
    COUNT(CASE WHEN v.success THEN 1 END)::BIGINT as successful_validations,
    ROUND((COUNT(CASE WHEN v.success THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100), 2) as success_rate,
    ROUND(AVG(v.attempts)::DECIMAL, 2) as avg_attempts,
    ROUND(AVG(v.validation_time_ms)::DECIMAL, 2) as avg_validation_time_ms,
    ROUND(AVG(v.cache_hit_rate)::DECIMAL, 2) as cache_hit_rate,
    (SELECT jsonb_object_agg(error_type, count) FROM error_counts) as top_errors,
    (SELECT jsonb_object_agg(fix_applied, count) FROM fix_counts) as top_fixes
  FROM validation_data v;
END;
$$ LANGUAGE plpgsql;