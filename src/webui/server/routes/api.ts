import { Router } from 'express';
import { ServiceContainer } from '../../../infrastructure/di/ServiceContainer';
import { createQueryRoutes } from './query';
import { createSessionRoutes } from './session';
import { createTemplateRoutes } from './templates';
import { createConfigRoutes } from './config';
import { createPortalRoutes } from './portal';

/**
 * Create the main API router with all sub-routes
 */
export function createAPIRoutes(container: ServiceContainer): Router {
  const router = Router();

  // Health check endpoint (no auth required)
  router.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'AppInsights Detective WebUI'
    });
  });

  // Core API routes
  router.use('/query', createQueryRoutes(container));
  router.use('/session', createSessionRoutes(container));
  router.use('/templates', createTemplateRoutes(container));
  router.use('/config', createConfigRoutes(container));
  router.use('/portal', createPortalRoutes(container));

  // Error handling middleware
  router.use((error: any, req: any, res: any, next: any) => {
    console.error('API Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
      code: 'INTERNAL_ERROR'
    });
  });

  return router;
}