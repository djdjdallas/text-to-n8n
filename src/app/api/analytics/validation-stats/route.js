import { NextResponse } from 'next/server';
import { analytics } from '@/lib/monitoring/analytics';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const timeframe = searchParams.get('timeframe') || '7d';
    const userId = searchParams.get('userId');

    // Get general metrics
    const metrics = await analytics.getGenerationMetrics(timeframe);
    
    // If userId is provided, get user-specific metrics
    let userMetrics = null;
    if (userId) {
      userMetrics = await analytics.getUserMetrics(userId);
    }

    return NextResponse.json({
      ...metrics,
      user: userMetrics
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch validation statistics' },
      { status: 500 }
    );
  }
}

// Get cache statistics from n8n validator
export async function POST(req) {
  try {
    const { action } = await req.json();
    
    if (action === 'getCacheStats') {
      // Dynamic import to avoid circular dependencies
      const { N8nValidationLoop } = await import('@/lib/validation/n8nValidationLoop');
      const validator = new N8nValidationLoop();
      const cacheStats = validator.getCacheStats();
      
      return NextResponse.json({
        success: true,
        cacheStats
      });
    }
    
    if (action === 'clearCache') {
      const { N8nValidationLoop } = await import('@/lib/validation/n8nValidationLoop');
      const validator = new N8nValidationLoop();
      validator.clearCache();
      
      return NextResponse.json({
        success: true,
        message: 'Validation cache cleared'
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Cache stats error:', error);
    return NextResponse.json(
      { error: 'Failed to process cache action' },
      { status: 500 }
    );
  }
}