import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import { logger } from '../../../lib/logger';

/**
 * Request interface for generate query endpoint
 */
interface GenerateQueryRequest {
  userInput: string;
  mode?: 'smart' | 'review' | 'raw';
  dataSourceType?: string;
  extraContext?: string;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed', 
      message: 'Only POST method is allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    const { userInput, mode = 'smart', dataSourceType, extraContext }: GenerateQueryRequest = req.body;

    if (!userInput) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'userInput is required',
        code: 'MISSING_USER_INPUT'
      });
    }

    logger.info(`WebUI: Generating query for input: "${userInput}"`);

    // TODO: Replace with actual AI provider implementation
    // For now, return a mock KQL query based on the user input
    const mockQuery = `requests
| where timestamp >= ago(1h)
| where name contains "${userInput}"
| summarize count() by bin(timestamp, 5m)
| render timechart`;

    res.json({
      query: mockQuery,
      confidence: 0.8,
      reasoning: `Generated a basic KQL query to search for requests containing "${userInput}" in the last hour`,
      mode: 'review',
      originalInput: userInput,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Query generation failed:', error);
    res.status(500).json({
      error: 'Query generation failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      code: 'GENERATION_FAILED'
    });
  }
}

export default withAuth(handler);