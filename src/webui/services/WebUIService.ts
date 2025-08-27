import express, { Express } from 'express';
import { Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { ServiceContainer } from '../../infrastructure/di/ServiceContainer';
import { ConfigManager } from '../../utils/config';
import { logger } from '../../utils/logger';
import { WebUIOptions } from '../../cli/commands/webui';
import { createAPIRoutes } from '../server/routes/api';
import { createAuthMiddleware } from '../server/middleware/auth';
import { setupWebSocket } from '../server/websocket/handler';
import { 
  IAIProvider,
  IDataSourceProvider,
  IAuthenticationProvider 
} from '../../core/interfaces';
import { QueryService } from '../../services/QueryService';
import { TemplateService } from '../../services/TemplateService';

/**
 * WebUI Service - Manages the Express server and WebSocket connections
 */
export class WebUIService {
  private app: Express;
  private server: Server | null = null;
  private io: SocketIOServer | null = null;

  constructor(
    private container: ServiceContainer,
    private configManager: ConfigManager,
    private options: WebUIOptions
  ) {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'"],
        }
      }
    }));

    // CORS configuration - restrictive by default
    const corsOptions = {
      origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        `http://localhost:${this.options.port}`,
        `http://127.0.0.1:${this.options.port}`,
        `http://${this.options.host}:${this.options.port}`
      ],
      credentials: true
    };
    this.app.use(cors(corsOptions));

    // Compression
    this.app.use(compression());

    // JSON parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Authentication middleware
    const authMiddleware = createAuthMiddleware(
      this.container.resolve<IAuthenticationProvider>('authProvider')
    );
    this.app.use('/api', authMiddleware);

    // Static file serving
    const publicPath = path.join(__dirname, '..', 'public');
    this.app.use(express.static(publicPath, {
      maxAge: '1d',
      etag: true
    }));
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // API routes
    const apiRouter = createAPIRoutes(this.container);
    this.app.use('/api', apiRouter);

    // Serve the main HTML file for all non-API routes (SPA routing)
    this.app.get('*', (req, res) => {
      const indexPath = path.join(__dirname, '..', 'public', 'index.html');
      res.sendFile(indexPath);
    });
  }

  /**
   * Start the web server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.options.port, this.options.host, () => {
          logger.info(`WebUI server started on ${this.options.host}:${this.options.port}`);

          // Setup WebSocket
          if (this.server) {
            this.io = new SocketIOServer(this.server, {
              cors: {
                origin: [
                  'http://localhost:3000',
                  'http://127.0.0.1:3000',
                  `http://localhost:${this.options.port}`,
                  `http://127.0.0.1:${this.options.port}`,
                  `http://${this.options.host}:${this.options.port}`
                ],
                credentials: true
              }
            });

            setupWebSocket(this.io, this.container);
          }

          resolve();
        });

        this.server.on('error', (error: Error) => {
          logger.error('WebUI server error:', error);
          reject(error);
        });

      } catch (error) {
        logger.error('Failed to start WebUI server:', error);
        reject(error);
      }
    });
  }

  /**
   * Stop the web server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.io) {
        this.io.close(() => {
          logger.info('WebSocket server closed');
        });
      }

      if (this.server) {
        this.server.close(() => {
          logger.info('WebUI server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the Express app instance
   */
  getApp(): Express {
    return this.app;
  }
}