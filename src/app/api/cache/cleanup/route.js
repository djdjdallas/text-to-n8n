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