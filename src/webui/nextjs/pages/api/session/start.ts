import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import { getServiceContainer } from '../../../lib/serviceContainer';
import { SessionManager } from '../../../../../services/orchestration/SessionManager';
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

    // Get services
    const container = await getServiceContainer();
    const sessionManager = container.resolve<SessionManager>('sessionManager');

    const session = await sessionManager.createSession({
      language: language as any,
      defaultMode: defaultMode as any
    });
    
    // Configure session settings using addToHistory for context
    session.addToHistory('session_config', 1.0, 'generated', JSON.stringify({
      language,
      defaultMode,
      timeRange,
      showEmptyColumns: false,
      charts: true
    }));

    res.json({
      sessionId: session.sessionId,
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