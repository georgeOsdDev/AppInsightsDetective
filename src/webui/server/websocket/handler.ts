import { Server as SocketIOServer, Socket } from 'socket.io';
import { ServiceContainer } from '../../../infrastructure/di/ServiceContainer';
import { QueryService } from '../../../services/QueryService';
import { IAIProvider } from '../../../core/interfaces';
import { logger } from '../../../utils/logger';

/**
 * WebSocket event interfaces
 */
interface QueryExecutionEvent {
  sessionId?: string;
  query: string;
  mode?: 'smart' | 'review' | 'raw';
}

interface QueryGenerationEvent {
  userInput: string;
  sessionId?: string;
}

/**
 * Setup WebSocket handlers for real-time communication
 */
export function setupWebSocket(io: SocketIOServer, container: ServiceContainer): void {
  logger.info('Setting up WebSocket handlers for WebUI');

  const queryService = container.resolve<QueryService>('queryService');
  const aiProvider = container.resolve<IAIProvider>('aiProvider');

  io.on('connection', (socket: Socket) => {
    logger.info(`WebUI client connected: ${socket.id}`);

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to AppInsights Detective WebUI',
      timestamp: new Date().toISOString()
    });

    /**
     * Handle real-time query generation
     */
    socket.on('generate-query', async (data: QueryGenerationEvent) => {
      try {
        const { userInput, sessionId } = data;

        if (!userInput) {
          socket.emit('generation-error', {
            error: 'Missing userInput',
            timestamp: new Date().toISOString()
          });
          return;
        }

        logger.info(`WebSocket: Generating query for client ${socket.id}`);

        // Emit generation started
        socket.emit('generation-started', {
          userInput,
          timestamp: new Date().toISOString()
        });

        // Ensure AI provider is initialized
        await aiProvider.initialize();

        // Generate query (similar to REST API)
        const nlQuery = await aiProvider.generateQuery({
          userInput,
          dataSourceType: 'application-insights' // Default for now
        });

        // Emit generation completed
        socket.emit('generation-completed', {
          query: nlQuery.generatedKQL,
          confidence: nlQuery.confidence,
          reasoning: nlQuery.reasoning,
          mode: nlQuery.confidence >= 0.7 ? 'execute' : 'review',
          originalInput: userInput,
          sessionId,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error(`WebSocket query generation failed for client ${socket.id}:`, error);
        
        socket.emit('generation-error', {
          error: error instanceof Error ? error.message : 'Query generation failed',
          timestamp: new Date().toISOString()
        });
      }
    });

    /**
     * Handle real-time query execution
     */
    socket.on('execute-query', async (data: QueryExecutionEvent) => {
      try {
        const { query, mode = 'smart', sessionId } = data;

        if (!query) {
          socket.emit('execution-error', {
            error: 'Missing query',
            timestamp: new Date().toISOString()
          });
          return;
        }

        logger.info(`WebSocket: Executing query for client ${socket.id}`);

        // Emit execution started
        socket.emit('execution-started', {
          query,
          mode,
          timestamp: new Date().toISOString()
        });

        const startTime = Date.now();

        // Execute query
        const result = await queryService.executeQuery({
          userInput: query,
          mode: mode === 'raw' ? 'raw' : 'direct',
          sessionId
        });

        const executionTime = Date.now() - startTime;

        // Emit execution completed
        socket.emit('execution-completed', {
          result: result.result,
          executionTime,
          sessionId: result.session.sessionId,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error(`WebSocket query execution failed for client ${socket.id}:`, error);
        
        socket.emit('execution-error', {
          error: error instanceof Error ? error.message : 'Query execution failed',
          timestamp: new Date().toISOString()
        });
      }
    });

    /**
     * Handle client disconnection
     */
    socket.on('disconnect', (reason) => {
      logger.info(`WebUI client disconnected: ${socket.id}, reason: ${reason}`);
    });

    /**
     * Handle client errors
     */
    socket.on('error', (error) => {
      logger.error(`WebSocket error for client ${socket.id}:`, error);
    });

    /**
     * Handle ping/pong for connection health
     */
    socket.on('ping', () => {
      socket.emit('pong', {
        timestamp: new Date().toISOString()
      });
    });
  });

  // Handle server-side WebSocket errors
  io.on('error', (error) => {
    logger.error('WebSocket server error:', error);
  });

  logger.info('WebSocket handlers setup completed');
}