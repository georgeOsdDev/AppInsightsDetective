import { Router, Request, Response } from 'express';
import { ServiceContainer } from '../../../infrastructure/di/ServiceContainer';
import { requireAuth } from '../middleware/auth';
import { SessionManager } from '../../../services/orchestration/SessionManager';
import { logger } from '../../../utils/logger';

/**
 * Session management interfaces
 */
interface CreateSessionRequest {
  language?: string;
  defaultMode?: 'smart' | 'review' | 'raw';
  timeRange?: string;
}

interface UpdateSessionRequest {
  language?: string;
  defaultMode?: 'smart' | 'review' | 'raw';
  timeRange?: string;
  showEmptyColumns?: boolean;
}

/**
 * Create session-related API routes
 */
export function createSessionRoutes(container: ServiceContainer): Router {
  const router = Router();
  
  // Apply authentication to all session routes
  router.use(requireAuth);

  const sessionManager = container.resolve<SessionManager>('sessionManager');

  /**
   * POST /api/session/start - Start new session
   */
  router.post('/start', async (req: Request, res: Response) => {
    try {
      const { language = 'en', defaultMode = 'smart', timeRange = '24h' }: CreateSessionRequest = req.body;

      logger.info('WebUI: Starting new session');

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
  });

  /**
   * GET /api/session/history - Get session history
   */
  router.get('/history', async (req: Request, res: Response) => {
    try {
      const sessionId = req.query.sessionId as string;

      if (!sessionId) {
        return res.status(400).json({
          error: 'Missing required parameter',
          message: 'sessionId query parameter is required',
          code: 'MISSING_SESSION_ID'
        });
      }

      logger.info(`WebUI: Getting history for session ${sessionId}`);

      const session = await sessionManager.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          message: `Session ${sessionId} not found`,
          code: 'SESSION_NOT_FOUND'
        });
      }

      const history = session.getDetailedHistory();

      res.json({
        sessionId,
        history: history.map((item, index) => ({
          id: index + 1,
          query: item.query,
          userInput: item.reason || '',
          executedAt: item.timestamp,
          resultCount: 0, // Not available in session history
          status: 'success', // Assume success for now
          error: null
        })),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Get session history failed:', error);
      res.status(500).json({
        error: 'Get session history failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'HISTORY_FAILED'
      });
    }
  });

  /**
   * PUT /api/session/settings - Update session settings
   */
  router.put('/settings', async (req: Request, res: Response) => {
    try {
      const { 
        sessionId, 
        language, 
        defaultMode, 
        timeRange, 
        showEmptyColumns 
      } = req.body as UpdateSessionRequest & { sessionId: string };

      if (!sessionId) {
        return res.status(400).json({
          error: 'Missing required field',
          message: 'sessionId is required',
          code: 'MISSING_SESSION_ID'
        });
      }

      logger.info(`WebUI: Updating settings for session ${sessionId}`);

      const session = await sessionManager.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          message: `Session ${sessionId} not found`,
          code: 'SESSION_NOT_FOUND'
        });
      }

      // Update session settings using history for context storage
      const settingsKey = `settings_${Date.now()}`;
      const updatedSettings = {
        ...(language && { language }),
        ...(defaultMode && { defaultMode }),
        ...(timeRange && { timeRange }),
        ...(showEmptyColumns !== undefined && { showEmptyColumns })
      };

      session.addToHistory(settingsKey, 1.0, 'generated', JSON.stringify(updatedSettings));

      res.json({
        sessionId,
        settings: updatedSettings,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Update session settings failed:', error);
      res.status(500).json({
        error: 'Update session settings failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'SETTINGS_UPDATE_FAILED'
      });
    }
  });

  /**
   * DELETE /api/session/end - End session
   */
  router.delete('/end', async (req: Request, res: Response) => {
    try {
      const sessionId = req.body.sessionId || req.query.sessionId;

      if (!sessionId) {
        return res.status(400).json({
          error: 'Missing required parameter',
          message: 'sessionId is required',
          code: 'MISSING_SESSION_ID'
        });
      }

      logger.info(`WebUI: Ending session ${sessionId}`);

      await sessionManager.endSession(sessionId);

      res.json({
        sessionId,
        status: 'ended',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('End session failed:', error);
      res.status(500).json({
        error: 'End session failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'END_SESSION_FAILED'
      });
    }
  });

  return router;
}