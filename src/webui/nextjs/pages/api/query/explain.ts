import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import { logger } from '../../../lib/logger';

/**
 * Request interface for explain query endpoint
 */
interface ExplainQueryRequest {
  query: string;
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
    const { query }: ExplainQueryRequest = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'query is required',
        code: 'MISSING_QUERY'
      });
    }

    logger.info(`WebUI: Explaining query: "${query}"`);

    // TODO: Replace with actual AI provider implementation
    // For now, return a mock explanation
    const mockExplanation = `This KQL query does the following:

1. **requests** - Starts with the requests table containing HTTP request data
2. **where timestamp >= ago(1h)** - Filters to only show requests from the last hour
3. **where name contains "..."** - Filters requests that contain specific text in the name field
4. **summarize count() by bin(timestamp, 5m)** - Groups results by 5-minute time intervals and counts requests
5. **render timechart** - Creates a time-based chart visualization

The query will show you the volume of matching requests over time in 5-minute intervals for the past hour.`;

    res.json({
      explanation: mockExplanation,
      query,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Query explanation failed:', error);
    res.status(500).json({
      error: 'Query explanation failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      code: 'EXPLANATION_FAILED'
    });
  }
}

export default withAuth(handler);