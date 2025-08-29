import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import { getServiceContainer } from '../../../lib/serviceContainer';
import { SessionManager } from '../../../../../services/orchestration/SessionManager';
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

    // Get services
    const container = await getServiceContainer();
    const sessionManager = container.resolve<SessionManager>('sessionManager');

    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: `Session ${sessionId} not found`,
        code: 'SESSION_NOT_FOUND'
      });
    }

    const history = session.getHistory();

    res.json({
      sessionId,
      history,
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