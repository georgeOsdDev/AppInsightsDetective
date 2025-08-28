import { Router, Request, Response } from 'express';
import { ServiceContainer } from '../../../infrastructure/di/ServiceContainer';
import { requireAuth } from '../middleware/auth';
import { ExternalExecutionService } from '../../../services/externalExecutionService';
import { logger } from '../../../utils/logger';

/**
 * Portal integration interfaces
 */
interface OpenPortalRequest {
  query: string;
  dataSourceType?: string;
}

/**
 * Create portal integration API routes
 */
export function createPortalRoutes(container: ServiceContainer): Router {
  const router = Router();
  
  // Apply authentication to all portal routes
  router.use(requireAuth);

  // Get external execution service if available
  let externalExecutionService: ExternalExecutionService | null = null;
  try {
    externalExecutionService = container.resolve<ExternalExecutionService>('externalExecutionService');
  } catch (error) {
    logger.warn('External execution service not available for portal integration');
  }

  /**
   * POST /api/portal/open - Generate Azure Portal links
   */
  router.post('/open', async (req: Request, res: Response) => {
    try {
      const { query, dataSourceType }: OpenPortalRequest = req.body;

      if (!query) {
        return res.status(400).json({
          error: 'Missing required field',
          message: 'query is required',
          code: 'MISSING_QUERY'
        });
      }

      if (!externalExecutionService) {
        return res.status(503).json({
          error: 'Portal integration not available',
          message: 'External execution service is not configured',
          code: 'PORTAL_NOT_AVAILABLE'
        });
      }

      logger.info('WebUI: Generating portal URL for query');

      // Generate portal URL
      const portalUrl = await externalExecutionService.openInPortal(query);

      res.json({
        portalUrl,
        query,
        dataSourceType,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Portal URL generation failed:', error);
      res.status(500).json({
        error: 'Portal URL generation failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'PORTAL_URL_FAILED'
      });
    }
  });

  /**
   * GET /api/portal/status - Check portal integration status
   */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const isAvailable = externalExecutionService !== null;
      
      res.json({
        available: isAvailable,
        message: isAvailable 
          ? 'Portal integration is available' 
          : 'Portal integration is not configured',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Portal status check failed:', error);
      res.status(500).json({
        error: 'Portal status check failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'PORTAL_STATUS_FAILED'
      });
    }
  });

  return router;
}