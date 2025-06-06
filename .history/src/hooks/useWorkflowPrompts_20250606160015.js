// hooks/useWorkflowPrompts.js
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Create Supabase client for client-side
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export function useWorkflowPrompts(filters = {}) {
  const [prompts, setPrompts] = useState([]);
  const [groupedPrompts, setGroupedPrompts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPrompts();
  }, [filters.category, filters.complexity, filters.search]);

  const fetchPrompts = async () => {
    try {
      setLoading(true);
      let query = supabase.from("workflow_prompts").select("*");

      if (filters.category) {
        query = query.eq("category", filters.category);
      }

      if (filters.complexity) {
        query = query.eq("complexity_level", filters.complexity);
      }

      if (filters.search) {
        query = query.or(
          `prompt_text.ilike.%${filters.search}%,services_involved.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query.order("category").order("id");

      if (error) throw error;

      setPrompts(data || []);

      // Group by category
      const grouped = (data || []).reduce((acc, prompt) => {
        if (!acc[prompt.category]) {
          acc[prompt.category] = [];
        }
        acc[prompt.category].push(prompt);
        return acc;
      }, {});

      setGroupedPrompts(grouped);
    } catch (err) {
      console.error("Error fetching workflow prompts:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const trackPromptUsage = async (promptId) => {
    try {
      const { data: currentData } = await supabase
        .from("workflow_prompts")
        .select("usage_count")
        .eq("id", promptId)
        .single();

      await supabase
        .from("workflow_prompts")
        .update({
          usage_count: (currentData?.usage_count || 0) + 1,
        })
        .eq("id", promptId);
    } catch (err) {
      console.error("Error tracking prompt usage:", err);
    }
  };

  const getPopularPrompts = async (limit = 10) => {
    try {
      const { data, error } = await supabase
        .from("workflow_prompts")
        .select("*")
        .order("usage_count", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Error fetching popular prompts:", err);
      return [];
    }
  };

  return {
    prompts,
    groupedPrompts,
    loading,
    error,
    refetch: fetchPrompts,
    trackPromptUsage,
    getPopularPrompts,
  };
}

// Hook for a single prompt
export function useWorkflowPrompt(id) {
  const [prompt, setPrompt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (id) {
      fetchPrompt();
    }
  }, [id]);

  const fetchPrompt = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("workflow_prompts")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setPrompt(data);
    } catch (err) {
      console.error("Error fetching prompt:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { prompt, loading, error };
}
