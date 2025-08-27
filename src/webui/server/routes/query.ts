import { Router, Request, Response } from 'express';
import { ServiceContainer } from '../../../infrastructure/di/ServiceContainer';
import { requireAuth } from '../middleware/auth';
import { QueryService, QueryServiceRequest } from '../../../services/QueryService';
import { IAIProvider, IDataSourceProvider } from '../../../core/interfaces';
import { ConfigManager } from '../../../utils/config';
import { DataSourceType } from '../../../core/types/ProviderTypes';
import { logger } from '../../../utils/logger';

/**
 * Request interfaces for API endpoints
 */
interface GenerateQueryRequest {
  userInput: string;
  mode?: 'smart' | 'review' | 'raw';
  dataSourceType?: DataSourceType;
  extraContext?: string;
}

interface ExecuteQueryRequest {
  query: string;
  mode?: 'smart' | 'review' | 'raw';
  sessionId?: string;
}

interface ExplainQueryRequest {
  query: string;
}

interface RegenerateQueryRequest {
  originalQuery: string;
  userInput: string;
  feedback: string;
}

/**
 * Create query-related API routes
 */
export function createQueryRoutes(container: ServiceContainer): Router {
  const router = Router();
  
  // Apply authentication to all query routes
  router.use(requireAuth);

  const queryService = container.resolve<QueryService>('queryService');
  const aiProvider = container.resolve<IAIProvider>('aiProvider');
  const dataSourceProvider = container.resolve<IDataSourceProvider>('dataSourceProvider');
  const configManager = container.resolve<ConfigManager>('configManager');

  /**
   * POST /api/query/generate - Generate KQL from natural language
   */
  router.post('/generate', async (req: Request, res: Response) => {
    try {
      const { userInput, mode = 'smart', dataSourceType, extraContext }: GenerateQueryRequest = req.body;

      if (!userInput) {
        return res.status(400).json({
          error: 'Missing required field',
          message: 'userInput is required',
          code: 'MISSING_USER_INPUT'
        });
      }

      logger.info(`WebUI: Generating query for input: "${userInput}"`);

      // Ensure AI provider is initialized
      await aiProvider.initialize();

      // Get schema if available
      let schema;
      try {
        const schemaResult = await dataSourceProvider.getSchema();
        schema = schemaResult.schema;
      } catch (error) {
        logger.warn('Could not retrieve schema for query generation:', error);
      }

      // Get data source type from config or request
      const config = configManager.getConfig();
      const finalDataSourceType = dataSourceType || config.providers.dataSources.default as DataSourceType;

      // Generate the query
      const nlQuery = await aiProvider.generateQuery({
        userInput,
        schema,
        dataSourceType: finalDataSourceType,
        extraContext
      });

      res.json({
        query: nlQuery.generatedKQL,
        confidence: nlQuery.confidence,
        reasoning: nlQuery.reasoning,
        mode: nlQuery.confidence >= 0.7 ? 'execute' : 'review',
        originalInput: userInput,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Query generation failed:', error);
      res.status(500).json({
        error: 'Query generation failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'GENERATION_FAILED'
      });
    }
  });

  /**
   * POST /api/query/execute - Execute a query (any mode)
   */
  router.post('/execute', async (req: Request, res: Response) => {
    try {
      const { query, mode = 'smart', sessionId }: ExecuteQueryRequest = req.body;

      if (!query) {
        return res.status(400).json({
          error: 'Missing required field',
          message: 'query is required',
          code: 'MISSING_QUERY'
        });
      }

      logger.info(`WebUI: Executing query in ${mode} mode`);

      const startTime = Date.now();

      // Execute using QueryService for session management
      const queryRequest: QueryServiceRequest = {
        userInput: query,
        mode: mode === 'raw' ? 'raw' : 'direct',
        sessionId
      };

      const result = await queryService.executeQuery(queryRequest);
      const executionTime = Date.now() - startTime;

      res.json({
        result: result.result,
        executionTime,
        sessionId: result.session.sessionId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Query execution failed:', error);
      res.status(500).json({
        error: 'Query execution failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'EXECUTION_FAILED'
      });
    }
  });

  /**
   * POST /api/query/explain - Get query explanation
   */
  router.post('/explain', async (req: Request, res: Response) => {
    try {
      const { query }: ExplainQueryRequest = req.body;

      if (!query) {
        return res.status(400).json({
          error: 'Missing required field',
          message: 'query is required',
          code: 'MISSING_QUERY'
        });
      }

      logger.info('WebUI: Generating query explanation');

      // Use AI provider to explain the query
      const explanation = await aiProvider.explainQuery({ query });

      res.json({
        explanation: explanation,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Query explanation failed:', error);
      res.status(500).json({
        error: 'Query explanation failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'EXPLANATION_FAILED'
      });
    }
  });

  /**
   * POST /api/query/regenerate - Regenerate query with feedback
   */
  router.post('/regenerate', async (req: Request, res: Response) => {
    try {
      const { originalQuery, userInput, feedback }: RegenerateQueryRequest = req.body;

      if (!originalQuery || !userInput || !feedback) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'originalQuery, userInput, and feedback are required',
          code: 'MISSING_FIELDS'
        });
      }

      logger.info('WebUI: Regenerating query with feedback');

      // Get schema if available
      let schema;
      try {
        const schemaResult = await dataSourceProvider.getSchema();
        schema = schemaResult.schema;
      } catch (error) {
        logger.warn('Could not retrieve schema for query regeneration:', error);
      }

      // Get data source type from config
      const config = configManager.getConfig();
      const dataSourceType = config.providers.dataSources.default as DataSourceType;

      // Create enhanced input with feedback
      const enhancedInput = `${userInput}\n\nFeedback on previous query: ${feedback}\nPrevious query: ${originalQuery}`;

      // Generate new query
      const nlQuery = await aiProvider.generateQuery({
        userInput: enhancedInput,
        schema,
        dataSourceType
      });

      res.json({
        query: nlQuery.generatedKQL,
        confidence: nlQuery.confidence,
        reasoning: nlQuery.reasoning,
        mode: nlQuery.confidence >= 0.7 ? 'execute' : 'review',
        originalInput: userInput,
        feedback,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Query regeneration failed:', error);
      res.status(500).json({
        error: 'Query regeneration failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'REGENERATION_FAILED'
      });
    }
  });

  return router;
}