import { Request, Response, NextFunction } from 'express';
import { IAuthenticationProvider } from '../../../core/interfaces';
import { logger } from '../../../utils/logger';

/**
 * Extend Express Request interface to include auth info
 */
declare global {
  namespace Express {
    interface Request {
      auth?: {
        isAuthenticated: boolean;
        token?: string;
        error?: string;
      };
    }
  }
}

/**
 * Create authentication middleware that validates Azure credentials
 */
export function createAuthMiddleware(authProvider: IAuthenticationProvider) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Skip authentication for health check endpoints
      if (req.path === '/health' || req.path === '/status') {
        next();
        return;
      }

      // Validate Azure credentials
      const isValid = await authProvider.validateCredentials();
      
      if (isValid) {
        req.auth = {
          isAuthenticated: true
        };
        logger.debug('Authentication successful for WebUI request');
        next();
      } else {
        req.auth = {
          isAuthenticated: false,
          error: 'Azure authentication failed'
        };
        
        logger.warn('Authentication failed for WebUI request');
        res.status(401).json({
          error: 'Authentication failed',
          message: 'Azure credentials are not valid. Please ensure you are properly authenticated.',
          code: 'AUTH_FAILED'
        });
      }
    } catch (error) {
      logger.error('Authentication middleware error:', error);
      
      req.auth = {
        isAuthenticated: false,
        error: `Authentication error: ${error}`
      };

      res.status(500).json({
        error: 'Authentication error',
        message: 'An error occurred during authentication',
        code: 'AUTH_ERROR'
      });
    }
  };
}

/**
 * Middleware to require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth?.isAuthenticated) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'This endpoint requires valid Azure authentication',
      code: 'AUTH_REQUIRED'
    });
    return;
  }
  
  next();
}