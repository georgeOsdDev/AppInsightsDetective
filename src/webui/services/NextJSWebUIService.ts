import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import path from 'path';
import { ServiceContainer } from '../../infrastructure/di/ServiceContainer';
import { ConfigManager } from '../../utils/config';
import { logger } from '../../utils/logger';
import { WebUIOptions } from '../../cli/commands/webui';

/**
 * Next.js-based WebUI Service
 */
export class NextJSWebUIService {
  private nextApp: any;
  private server: any = null;
  private isReady = false;

  constructor(
    private container: ServiceContainer,
    private configManager: ConfigManager,
    private options: WebUIOptions
  ) {
    // Initialize Next.js app
    const dev = process.env.NODE_ENV !== 'production';
    const dir = path.join(__dirname, '..', 'nextjs');
    
    this.nextApp = next({ 
      dev, 
      dir,
      hostname: this.options.host,
      port: this.options.port
    });
  }

  /**
   * Start the Next.js server
   */
  async start(): Promise<void> {
    try {
      logger.info('Preparing Next.js application...');
      
      // Prepare Next.js app
      await this.nextApp.prepare();
      this.isReady = true;

      const handle = this.nextApp.getRequestHandler();

      // Create custom server
      this.server = createServer(async (req, res) => {
        try {
          const parsedUrl = parse(req.url!, true);
          await handle(req, res, parsedUrl);
        } catch (err) {
          logger.error('Error handling request:', err);
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      });

      // Start server
      return new Promise((resolve, reject) => {
        this.server.listen(this.options.port, this.options.host, (err: Error) => {
          if (err) {
            logger.error('Failed to start Next.js server:', err);
            reject(err);
            return;
          }
          
          logger.info(`Next.js WebUI server started on ${this.options.host}:${this.options.port}`);
          resolve();
        });

        this.server.on('error', (error: Error) => {
          logger.error('Next.js server error:', error);
          reject(error);
        });
      });

    } catch (error) {
      logger.error('Failed to start Next.js WebUI service:', error);
      throw error;
    }
  }

  /**
   * Stop the Next.js server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Next.js WebUI server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Check if the service is ready
   */
  isServiceReady(): boolean {
    return this.isReady;
  }

  /**
   * Get the Next.js app instance
   */
  getApp(): any {
    return this.nextApp;
  }
}