-- Create workflow_prompts table
CREATE TABLE IF NOT EXISTS workflow_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  complexity_level TEXT CHECK (complexity_level IN ('simple', 'moderate', 'complex')),
  services_involved TEXT,
  description TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workflow_prompts_category ON workflow_prompts(category);
CREATE INDEX IF NOT EXISTS idx_workflow_prompts_complexity ON workflow_prompts(complexity_level);

-- Enable Row Level Security (RLS)
ALTER TABLE workflow_prompts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous reads
CREATE POLICY "Allow anonymous reads" ON workflow_prompts
  FOR SELECT
  USING (true);

-- Create policy to allow authenticated users to update usage_count
CREATE POLICY "Allow authenticated usage tracking" ON workflow_prompts
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Insert some example prompts
INSERT INTO workflow_prompts (category, prompt_text, complexity_level, services_involved, description) VALUES
  ('Email Automation', 'Send a welcome email to new users who sign up through a Google Form', 'simple', 'Google Forms, Gmail', 'Basic trigger-action workflow'),
  ('Data Processing', 'When a CSV file is uploaded to Dropbox, parse it, clean the data, and save to Google Sheets', 'moderate', 'Dropbox, Google Sheets', 'File processing with data transformation'),
  ('Social Media', 'Monitor Twitter for mentions of my brand, analyze sentiment, and notify team on Slack for negative feedback', 'complex', 'Twitter, Slack', 'Real-time monitoring with sentiment analysis'),
  ('E-commerce', 'When a Shopify order is placed, add customer to Mailchimp, create invoice in QuickBooks, and send tracking to customer', 'complex', 'Shopify, Mailchimp, QuickBooks', 'Multi-step order processing workflow'),
  ('Lead Management', 'Capture leads from Facebook Ads, enrich with Clearbit, add to HubSpot, and assign to sales team', 'moderate', 'Facebook, Clearbit, HubSpot', 'Lead capture and enrichment workflow');

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_workflow_prompts_updated_at
  BEFORE UPDATE ON workflow_prompts
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();