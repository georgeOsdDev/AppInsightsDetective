import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import { logger } from '../../../lib/logger';

/**
 * Request interface for regenerate query endpoint
 */
interface RegenerateQueryRequest {
  originalQuery: string;
  userInput: string;
  feedback: string;
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
    const { originalQuery, userInput, feedback }: RegenerateQueryRequest = req.body;

    if (!originalQuery || !userInput || !feedback) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'originalQuery, userInput, and feedback are required',
        code: 'MISSING_FIELDS'
      });
    }

    logger.info('WebUI: Regenerating query with feedback');

    // TODO: Replace with actual AI provider implementation
    // For now, return a mock regenerated query
    const mockRegeneratedQuery = `requests
| where timestamp >= ago(1h)
| where name contains "${userInput}"
| where resultCode >= 400
| summarize count() by bin(timestamp, 5m), resultCode
| render timechart`;

    res.json({
      query: mockRegeneratedQuery,
      confidence: 0.85,
      reasoning: `Regenerated the query based on your feedback: "${feedback}". The new query includes error filtering (resultCode >= 400) and groups by both time and response code.`,
      originalQuery,
      feedback,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Query regeneration failed:', error);
    res.status(500).json({
      error: 'Query regeneration failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      code: 'REGENERATION_FAILED'
    });
  }
}

export default withAuth(handler);