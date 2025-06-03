// src/lib/cache/cacheManager.js
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

class CacheManager {
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    this.tableName = "workflow_cache";
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    // Table should already exist from SQL setup
    // Just verify it exists
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select("id")
        .limit(1);

      if (error && error.code === "42P01") {
        console.warn("workflow_cache table does not exist. Cache disabled.");
        this.initialized = false;
        return;
      }

      this.initialized = true;
    } catch (error) {
      console.error("Cache initialization error:", error);
      this.initialized = false;
    }
  }

  generateKey(input, platform, complexity, provider = "default") {
    const normalized = this.normalizeInput(input);
    const data = `${normalized}:${platform}:${complexity}:${provider}`;
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  normalizeInput(input) {
    // Normalize input to improve cache hits
    return input
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[^\w\s]/g, "");
  }

  async get(key) {
    if (!this.initialized) await this.initialize();
    if (!this.initialized) return null; // Cache disabled

    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select("*")
        .eq("cache_key", key)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (error || !data) return null;

      // Update hit count
      await this.supabase
        .from(this.tableName)
        .update({
          hits: data.hits + 1,
          last_accessed: new Date().toISOString(),
        })
        .eq("id", data.id);

      return {
        workflow: data.workflow_json,
        metadata: {
          ...data.metadata,
          cachedAt: data.created_at,
          hits: data.hits + 1,
        },
      };
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  }

  async set(key, value, ttlSeconds = 3600) {
    if (!this.initialized) await this.initialize();
    if (!this.initialized) return; // Cache disabled

    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      const cacheData = {
        cache_key: key,
        platform: value.metadata?.platform || "unknown",
        input_hash: crypto
          .createHash("sha256")
          .update(value.metadata?.originalInput || "")
          .digest("hex"),
        workflow_json: value.workflow,
        metadata: value.metadata || {},
        expires_at: expiresAt.toISOString(),
        hits: 0,
        last_accessed: new Date().toISOString(),
      };

      const { error } = await this.supabase
        .from(this.tableName)
        .upsert(cacheData, {
          onConflict: "cache_key",
        });

      if (error) {
        console.error("Cache set error:", error);
      }
    } catch (error) {
      console.error("Cache set error:", error);
    }
  }

  async cleanup() {
    if (!this.initialized) await this.initialize();
    if (!this.initialized) return; // Cache disabled

    try {
      // Remove expired entries
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .lt("expires_at", new Date().toISOString());

      if (error) {
        console.error("Cache cleanup error:", error);
      }
    } catch (error) {
      console.error("Cache cleanup error:", error);
    }
  }

  async getStats(platform = null) {
    if (!this.initialized) await this.initialize();
    if (!this.initialized) return null; // Cache disabled

    try {
      let query = this.supabase
        .from(this.tableName)
        .select("platform, hits, created_at");

      if (platform) {
        query = query.eq("platform", platform);
      }

      const { data, error } = await query;

      if (error) return null;

      return {
        totalEntries: data.length,
        totalHits: data.reduce((sum, item) => sum + item.hits, 0),
        avgHitsPerEntry:
          data.length > 0
            ? data.reduce((sum, item) => sum + item.hits, 0) / data.length
            : 0,
        platformBreakdown: this.groupByPlatform(data),
      };
    } catch (error) {
      console.error("Cache stats error:", error);
      return null;
    }
  }

  groupByPlatform(data) {
    return data.reduce((acc, item) => {
      if (!acc[item.platform]) {
        acc[item.platform] = { count: 0, hits: 0 };
      }
      acc[item.platform].count++;
      acc[item.platform].hits += item.hits;
      return acc;
    }, {});
  }
}

export const cacheManager = new CacheManager();
