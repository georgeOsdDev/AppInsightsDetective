import type { NextApiRequest, NextApiResponse } from 'next';
import { IAuthenticationProvider } from '../../../core/interfaces';
import { getServiceContainer } from './serviceContainer';
import { logger } from './logger';

/**
 * Middleware function to validate Azure credentials for Next.js API routes
 */
export async function withAuth(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // Skip authentication for health check endpoints
      if (req.url?.includes('/health') || req.url?.includes('/status')) {
        return handler(req, res);
      }

      // Get authentication provider
      const container = await getServiceContainer();
      const authProvider = container.resolve<IAuthenticationProvider>('authProvider');

      // Validate Azure credentials
      const isValid = await authProvider.validateCredentials();
      
      if (isValid) {
        logger.debug('Authentication successful for WebUI API request');
        return handler(req, res);
      } else {
        logger.warn('Authentication failed for WebUI API request');
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Azure credentials are not valid. Please ensure you are properly authenticated.',
          code: 'AUTH_FAILED'
        });
      }
    } catch (error) {
      logger.error('Authentication middleware error:', error);
      
      return res.status(500).json({
        error: 'Authentication error',
        message: 'An error occurred during authentication',
        code: 'AUTH_ERROR'
      });
    }
  };
}