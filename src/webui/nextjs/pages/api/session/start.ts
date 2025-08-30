import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import { logger } from '../../../lib/logger';

/**
 * Request interface for create session endpoint
 */
interface CreateSessionRequest {
  language?: string;
  defaultMode?: 'smart' | 'review' | 'raw';
  timeRange?: string;
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
    const { language = 'en', defaultMode = 'smart', timeRange = '24h' }: CreateSessionRequest = req.body;

    logger.info('WebUI: Starting new session');

    // Generate a mock session ID for now
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // TODO: Replace with actual SessionManager implementation
    // For now, return a mock session response
    logger.info(`WebUI: Created mock session ${sessionId}`);

    res.json({
      sessionId,
      settings: {
        language,
        defaultMode,
        timeRange,
        showEmptyColumns: false,
        charts: true
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Session creation failed:', error);
    res.status(500).json({
      error: 'Session creation failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      code: 'SESSION_CREATION_FAILED'
    });
  }
}

export default withAuth(handler);