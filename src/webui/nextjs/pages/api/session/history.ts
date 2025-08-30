import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import { logger } from '../../../lib/logger';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed', 
      message: 'Only GET method is allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'sessionId query parameter is required',
        code: 'MISSING_SESSION_ID'
      });
    }

    logger.info(`WebUI: Getting session history for ${sessionId}`);

    // TODO: Replace with actual SessionManager implementation
    // For now, return mock history data
    const mockHistory = [
      {
        id: '1',
        query: 'session_config',
        score: 1.0,
        type: 'generated',
        content: JSON.stringify({
          language: 'en',
          defaultMode: 'smart',
          timeRange: '24h',
          showEmptyColumns: false,
          charts: true
        }),
        timestamp: new Date().toISOString()
      }
    ];

    res.json({
      sessionId,
      history: mockHistory,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get session history:', error);
    res.status(500).json({
      error: 'Session history retrieval failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      code: 'HISTORY_RETRIEVAL_FAILED'
    });
  }
}

export default withAuth(handler);