import { NextResponse } from 'next/server';
import { SAMPLE_RESPONSE } from '@/lib/constants';

export async function POST(req) {
  try {
    // Parse the request body
    const body = await req.json();
    const { input, platform, complexity, errorHandling, optimization } = body;
    
    // Validate input
    if (!input || input.trim() === '') {
      return NextResponse.json(
        { error: 'Input is required' },
        { status: 400 }
      );
    }
    
    // In a real application, you would call an AI service here
    // For development, simulate a delay and return sample data
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // Clone the sample response and modify it slightly based on inputs
    const response = JSON.parse(JSON.stringify(SAMPLE_RESPONSE));
    
    // Customize response based on input parameters
    response.workflow.name = input.split(' ').slice(0, 3).join(' ') + ' Workflow';
    
    // Adjust metadata based on complexity
    if (complexity === 'simple') {
      response.metadata.complexity = Math.floor(Math.random() * 30);
      response.metadata.tokens = Math.floor(Math.random() * 300) + 200;
      response.metadata.estimatedCost = response.metadata.tokens * 0.00001;
    } else if (complexity === 'complex') {
      response.metadata.complexity = Math.floor(Math.random() * 30) + 70;
      response.metadata.tokens = Math.floor(Math.random() * 500) + 800;
      response.metadata.estimatedCost = response.metadata.tokens * 0.00002;
    } else {
      // moderate complexity
      response.metadata.complexity = Math.floor(Math.random() * 40) + 30;
      response.metadata.tokens = Math.floor(Math.random() * 400) + 400;
      response.metadata.estimatedCost = response.metadata.tokens * 0.000015;
    }
    
    // Add error handling nodes if requested
    if (errorHandling) {
      response.workflow.nodes.push({
        "id": "5",
        "type": "action",
        "name": "Error Handler",
        "parameters": {
          "mode": "catch",
          "notifyEmail": "admin@example.com"
        }
      });
      
      response.workflow.connections.push({ 
        "source": "1", 
        "target": "5",
        "type": "error"
      });
    }
    
    // Generate random execution time between 1.5 and 5 seconds
    response.metadata.generationTime = Math.round((Math.random() * 3.5 + 1.5) * 10) / 10;
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating workflow:', error);
    return NextResponse.json(
      { error: 'Failed to generate workflow' },
      { status: 500 }
    );
  }
}