// src/lib/cache/cacheManager.js
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

class CacheManager {
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.tableName = "workflow_cache";
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    await this.supabase.sql`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cache_key VARCHAR(64) UNIQUE NOT NULL,
        platform VARCHAR(20) NOT NULL,
        input_hash VARCHAR(64) NOT NULL,
        workflow_json JSONB NOT NULL,
        metadata JSONB,
        hits INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL,
        INDEX idx_cache_key (cache_key),
        INDEX idx_platform (platform),
        INDEX idx_expires (expires_at)
      );
    `;

    this.initialized = true;
  }

  generateKey(input, platform, complexity) {
    const normalized = this.normalizeInput(input);
    const data = `${normalized}:${platform}:${complexity}`;
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
    await this.initialize();

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
      .update({ hits: data.hits + 1 })
      .eq("id", data.id);

    return {
      workflow: data.workflow_json,
      metadata: {
        ...data.metadata,
        cachedAt: data.created_at,
        hits: data.hits + 1,
      },
    };
  }

  async set(key, value, ttlSeconds = 3600) {
    await this.initialize();

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const { error } = await this.supabase.from(this.tableName).upsert({
      cache_key: key,
      platform: value.metadata.platform,
      input_hash: crypto
        .createHash("sha256")
        .update(value.metadata.originalInput)
        .digest("hex"),
      workflow_json: value.workflow,
      metadata: value.metadata,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      console.error("Cache set error:", error);
    }
  }

  async cleanup() {
    // Remove expired entries
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .lt("expires_at", new Date().toISOString());

    if (error) {
      console.error("Cache cleanup error:", error);
    }
  }

  async getStats(platform = null) {
    const query = this.supabase
      .from(this.tableName)
      .select("platform, hits, created_at");

    if (platform) {
      query.eq("platform", platform);
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

// src/app/api/cache/cleanup/route.js
import { cacheManager } from "@/lib/cache/cacheManager";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    // Verify admin token or use cron secret
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await cacheManager.cleanup();
    const stats = await cacheManager.getStats();

    return NextResponse.json({
      message: "Cache cleanup completed",
      stats,
    });
  } catch (error) {
    console.error("Cache cleanup error:", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
