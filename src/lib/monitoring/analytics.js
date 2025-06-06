// src/lib/monitoring/analytics.js
import { createClient } from "@supabase/supabase-js";

class WorkflowAnalytics {
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  async trackGeneration(params) {
    const {
      userId,
      platform,
      input,
      success,
      generationTime,
      tokensUsed,
      complexity,
      errorDetails = null,
      workflowId = null,
      n8nValidation = null,
    } = params;

    await this.supabase.from("workflow_generations").insert({
      user_id: userId,
      platform,
      input_summary: this.summarizeInput(input),
      success,
      generation_time_ms: generationTime,
      tokens_used: tokensUsed,
      complexity_score: complexity,
      error_details: errorDetails,
      workflow_id: workflowId,
      n8n_validated: n8nValidation?.tested || false,
      n8n_validation_success: n8nValidation?.success || false,
      n8n_validation_attempts: n8nValidation?.attempts || 0,
      n8n_validation_time_ms: n8nValidation?.validationTime || 0,
      created_at: new Date().toISOString(),
    });
  }

  async trackN8nValidation(params) {
    const {
      workflowId,
      success,
      attempts,
      validationTime,
      errorType = null,
      fixApplied = null,
      fromCache = false,
      cacheHitRate = null,
    } = params;

    await this.supabase.from("n8n_validations").insert({
      workflow_id: workflowId,
      success,
      attempts,
      validation_time_ms: validationTime,
      error_type: errorType,
      fix_applied: fixApplied,
      from_cache: fromCache,
      cache_hit_rate: cacheHitRate,
      created_at: new Date().toISOString(),
    });
  }

  async trackRAGUsage(params) {
    const {
      queryId,
      platform,
      query,
      documentsRetrieved,
      relevanceScores,
      responseTime,
    } = params;

    await this.supabase.from("rag_usage").insert({
      query_id: queryId,
      platform,
      query_text: query,
      documents_retrieved: documentsRetrieved,
      avg_relevance_score: this.calculateAvgScore(relevanceScores),
      response_time_ms: responseTime,
      created_at: new Date().toISOString(),
    });
  }

  async getGenerationMetrics(timeframe = "7d") {
    const startDate = this.getStartDate(timeframe);

    const { data: generations } = await this.supabase
      .from("workflow_generations")
      .select("*")
      .gte("created_at", startDate.toISOString());

    const { data: ragUsage } = await this.supabase
      .from("rag_usage")
      .select("*")
      .gte("created_at", startDate.toISOString());

    const { data: n8nValidations } = await this.supabase
      .from("n8n_validations")
      .select("*")
      .gte("created_at", startDate.toISOString());

    // Calculate n8n validation metrics
    const n8nValidated = generations.filter(g => g.n8n_validated).length;
    const n8nValidationSuccess = generations.filter(g => g.n8n_validation_success).length;

    return {
      generations: {
        total: generations.length,
        successful: generations.filter((g) => g.success).length,
        failed: generations.filter((g) => !g.success).length,
        byPlatform: this.groupByPlatform(generations),
        avgGenerationTime: this.calculateAvg(generations, "generation_time_ms"),
        avgTokensUsed: this.calculateAvg(generations, "tokens_used"),
        complexityDistribution: this.getComplexityDistribution(generations),
      },
      n8nValidation: {
        total: n8nValidated,
        successful: n8nValidationSuccess,
        successRate: n8nValidated > 0 ? (n8nValidationSuccess / n8nValidated * 100).toFixed(1) : 0,
        avgAttempts: this.calculateAvg(generations.filter(g => g.n8n_validated), "n8n_validation_attempts"),
        avgValidationTime: this.calculateAvg(generations.filter(g => g.n8n_validated), "n8n_validation_time_ms"),
        cacheHitRate: n8nValidations.length > 0 ? 
          (n8nValidations.filter(v => v.from_cache).length / n8nValidations.length * 100).toFixed(1) : 0,
        errorTypes: this.groupN8nErrors(n8nValidations),
        fixesApplied: this.groupN8nFixes(n8nValidations),
      },
      rag: {
        totalQueries: ragUsage.length,
        avgResponseTime: this.calculateAvg(ragUsage, "response_time_ms"),
        avgRelevanceScore: this.calculateAvg(ragUsage, "avg_relevance_score"),
        avgDocumentsRetrieved: this.calculateAvg(
          ragUsage,
          "documents_retrieved"
        ),
      },
      errorAnalysis: this.analyzeErrors(generations.filter((g) => !g.success)),
    };
  }

  groupN8nErrors(validations) {
    return validations
      .filter(v => !v.success && v.error_type)
      .reduce((acc, v) => {
        acc[v.error_type] = (acc[v.error_type] || 0) + 1;
        return acc;
      }, {});
  }

  groupN8nFixes(validations) {
    return validations
      .filter(v => v.fix_applied)
      .reduce((acc, v) => {
        acc[v.fix_applied] = (acc[v.fix_applied] || 0) + 1;
        return acc;
      }, {});
  }

  async getUserMetrics(userId) {
    const { data: userGenerations } = await this.supabase
      .from("workflow_generations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    return {
      totalGenerations: userGenerations.length,
      successRate: this.calculateSuccessRate(userGenerations),
      platformUsage: this.groupByPlatform(userGenerations),
      recentWorkflows: userGenerations.slice(0, 10),
      monthlyUsage: this.groupByMonth(userGenerations),
    };
  }

  summarizeInput(input) {
    // Create a summary of the input for analytics
    const words = input.split(" ");
    return {
      length: input.length,
      wordCount: words.length,
      keywords: this.extractKeywords(input),
      hash: this.hashInput(input),
    };
  }

  extractKeywords(input) {
    const commonWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
    ]);
    const words = input.toLowerCase().split(/\W+/);
    const keywords = words.filter(
      (word) => word.length > 3 && !commonWords.has(word)
    );

    // Count frequency
    const frequency = {};
    keywords.forEach((word) => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    // Return top 5 keywords
    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  analyzeErrors(failedGenerations) {
    const errorTypes = {};
    const errorsByPlatform = {};

    failedGenerations.forEach((gen) => {
      const errorType = this.categorizeError(gen.error_details);
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;

      if (!errorsByPlatform[gen.platform]) {
        errorsByPlatform[gen.platform] = {};
      }
      errorsByPlatform[gen.platform][errorType] =
        (errorsByPlatform[gen.platform][errorType] || 0) + 1;
    });

    return {
      totalErrors: failedGenerations.length,
      errorTypes,
      errorsByPlatform,
      commonPatterns: this.findErrorPatterns(failedGenerations),
    };
  }

  categorizeError(errorDetails) {
    if (!errorDetails) return "unknown";

    const errorString = JSON.stringify(errorDetails).toLowerCase();

    if (errorString.includes("validation")) return "validation_error";
    if (errorString.includes("timeout")) return "timeout";
    if (errorString.includes("rate limit")) return "rate_limit";
    if (errorString.includes("schema")) return "schema_error";
    if (errorString.includes("parse")) return "parse_error";

    return "other";
  }

  findErrorPatterns(failedGenerations) {
    // Analyze common patterns in failed generations
    const patterns = {
      complexityTooHigh: failedGenerations.filter(
        (g) => g.complexity_score > 80
      ).length,
      longInputs: failedGenerations.filter((g) => g.input_summary.length > 1000)
        .length,
      specificPlatforms: this.groupByPlatform(failedGenerations),
    };

    return patterns;
  }

  // Helper methods
  getStartDate(timeframe) {
    const now = new Date();
    switch (timeframe) {
      case "24h":
        return new Date(now - 24 * 60 * 60 * 1000);
      case "7d":
        return new Date(now - 7 * 24 * 60 * 60 * 1000);
      case "30d":
        return new Date(now - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now - 7 * 24 * 60 * 60 * 1000);
    }
  }

  calculateAvg(data, field) {
    if (data.length === 0) return 0;
    const sum = data.reduce((acc, item) => acc + (item[field] || 0), 0);
    return sum / data.length;
  }

  groupByPlatform(data) {
    return data.reduce((acc, item) => {
      acc[item.platform] = (acc[item.platform] || 0) + 1;
      return acc;
    }, {});
  }

  groupByMonth(data) {
    return data.reduce((acc, item) => {
      const month = new Date(item.created_at).toISOString().slice(0, 7);
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});
  }

  calculateSuccessRate(generations) {
    if (generations.length === 0) return 0;
    const successful = generations.filter((g) => g.success).length;
    return (successful / generations.length) * 100;
  }

  getComplexityDistribution(generations) {
    const ranges = {
      simple: generations.filter((g) => g.complexity_score < 30).length,
      moderate: generations.filter(
        (g) => g.complexity_score >= 30 && g.complexity_score < 70
      ).length,
      complex: generations.filter((g) => g.complexity_score >= 70).length,
    };
    return ranges;
  }
}

export const analytics = new WorkflowAnalytics();

// src/app/api/analytics/dashboard/route.js
import { analytics } from "@/lib/monitoring/analytics";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const timeframe = searchParams.get("timeframe") || "7d";

    const metrics = await analytics.getGenerationMetrics(timeframe);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

// src/components/AnalyticsDashboard.jsx
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

export function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await fetch("/api/analytics/dashboard?timeframe=7d");
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading analytics...</div>;
  if (!metrics) return <div>No analytics data available</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Generation Success Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {(
              (metrics.generations.successful / metrics.generations.total) *
              100
            ).toFixed(1)}
            %
          </div>
          <p className="text-sm text-muted">
            {metrics.generations.successful} of {metrics.generations.total}{" "}
            successful
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Average Generation Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {(metrics.generations.avgGenerationTime / 1000).toFixed(2)}s
          </div>
          <p className="text-sm text-muted">Across all platforms</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.entries(metrics.generations.byPlatform).map(
            ([platform, count]) => (
              <div key={platform} className="flex justify-between mb-2">
                <span className="capitalize">{platform}</span>
                <span className="font-semibold">{count}</span>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
