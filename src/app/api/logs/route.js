// src/app/api/logs/route.js
import { NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const lines = parseInt(searchParams.get('lines') || '100');
    const format = searchParams.get('format') || 'json';
    
    const logs = logger.getRecentLogs(lines);
    
    if (format === 'text') {
      return new Response(logs, {
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }
    
    // Return as JSON with metadata
    const logLines = logs.split('\n').filter(line => line.trim());
    
    return NextResponse.json({
      success: true,
      totalLines: logLines.length,
      requestedLines: lines,
      logs: logLines,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    logger.clear();
    logger.info('🧹 Logs cleared via API request');
    
    return NextResponse.json({
      success: true,
      message: 'Logs cleared successfully',
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}