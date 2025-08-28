import { Router, Request, Response } from 'express';
import { ServiceContainer } from '../../../infrastructure/di/ServiceContainer';
import { requireAuth } from '../middleware/auth';
import { ConfigManager } from '../../../utils/config';
import { logger } from '../../../utils/logger';

/**
 * Create configuration-related API routes
 */
export function createConfigRoutes(container: ServiceContainer): Router {
  const router = Router();
  
  // Apply authentication to all config routes
  router.use(requireAuth);

  const configManager = container.resolve<ConfigManager>('configManager');

  /**
   * GET /api/config - Get current configuration
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      logger.info('WebUI: Getting current configuration');

      const config = configManager.getConfig();
      const isValid = configManager.validateConfig();

      // Filter out sensitive information
      const safeConfig = {
        providers: {
          ai: {
            default: config.providers.ai.default,
            available: Object.keys(config.providers.ai).filter(key => key !== 'default')
          },
          dataSources: {
            default: config.providers.dataSources.default,
            available: Object.keys(config.providers.dataSources).filter(key => key !== 'default')
          },
          auth: {
            default: config.providers.auth.default
          }
        },
        isValid,
        timestamp: new Date().toISOString()
      };

      res.json(safeConfig);

    } catch (error) {
      logger.error('Get configuration failed:', error);
      res.status(500).json({
        error: 'Get configuration failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'GET_CONFIG_FAILED'
      });
    }
  });

  /**
   * GET /api/config/status - Get configuration status
   */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      logger.info('WebUI: Getting configuration status');

      const config = configManager.getConfig();
      const isValid = configManager.validateConfig();

      // Get provider status
      const defaultAI = config.providers.ai.default;
      const defaultDataSource = config.providers.dataSources.default;
      const defaultAuth = config.providers.auth.default;

      const status = {
        overall: isValid,
        providers: {
          ai: {
            name: defaultAI,
            configured: !!config.providers.ai[defaultAI]
          },
          dataSource: {
            name: defaultDataSource,
            configured: !!config.providers.dataSources[defaultDataSource]
          },
          auth: {
            name: defaultAuth,
            configured: !!config.providers.auth[defaultAuth]
          }
        },
        timestamp: new Date().toISOString()
      };

      res.json(status);

    } catch (error) {
      logger.error('Get configuration status failed:', error);
      res.status(500).json({
        error: 'Get configuration status failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'GET_CONFIG_STATUS_FAILED'
      });
    }
  });

  return router;
}