import { 
  IQueryOrchestrator,
  ISessionManager,
  IAIProvider,
  NLQueryRequest,
  IQuerySession
} from '../core/interfaces';
import { QueryResult, QueryResultWithTiming, NLQuery, SupportedLanguage } from '../types';
import { logger } from '../utils/logger';

/**
 * Query service request
 */
export interface QueryServiceRequest extends NLQueryRequest {
  sessionId?: string;
  mode?: 'direct' | 'step' | 'raw';
}

/**
 * Query service result
 */
export interface QueryServiceResult {
  result: QueryResultWithTiming;
  session: IQuerySession;
  nlQuery?: NLQuery;
}

/**
 * Business logic service for query operations
 */
export class QueryService {
  constructor(
    private orchestrator: IQueryOrchestrator,
    private sessionManager: ISessionManager,
    private aiProvider: IAIProvider
  ) {}

  /**
   * Execute a query with session management
   */
  async executeQuery(request: QueryServiceRequest): Promise<QueryServiceResult> {
    logger.info(`QueryService: Executing query - mode: ${request.mode || 'default'}`);

    // Get or create session
    let session: IQuerySession;
    if (request.sessionId) {
      const existingSession = await this.sessionManager.getSession(request.sessionId);
      if (!existingSession) {
        throw new Error(`Session not found: ${request.sessionId}`);
      }
      session = existingSession;
    } else {
      session = await this.sessionManager.createSession({
        language: request.language as any,
        defaultMode: request.mode || 'step'
      });
    }

    try {
      let result: QueryResultWithTiming;
      let nlQuery: NLQuery | undefined;

      if (request.mode === 'raw') {
        // Execute as raw KQL
        result = await this.orchestrator.executeRawQuery(request.userInput);
        session.addToHistory(request.userInput, 1.0, 'generated', 'Raw KQL execution');
      } else {
        // Execute as natural language query
        // First generate the KQL
        nlQuery = await this.aiProvider.generateQuery({
          userInput: request.userInput,
          schema: request.schema
        });

        // Add to session history
        session.addToHistory(nlQuery.generatedKQL, nlQuery.confidence, 'generated', nlQuery.reasoning);

        // Execute the query
        result = await this.orchestrator.executeRawQuery(nlQuery.generatedKQL);
      }

      logger.info(`QueryService: Query executed successfully in ${result.executionTime}ms`);

      return {
        result,
        session,
        nlQuery
      };

    } catch (error) {
      logger.error('QueryService: Query execution failed:', error);
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  /**
   * Regenerate a query with different approach
   */
  async regenerateQuery(
    originalQuestion: string, 
    previousQuery: NLQuery, 
    sessionId: string,
    attemptNumber: number = 1
  ): Promise<{ nlQuery: NLQuery; session: IQuerySession }> {
    logger.info(`QueryService: Regenerating query (attempt ${attemptNumber})`);

    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      // Use AI provider to regenerate with different approach
      const regenerationContext = {
        previousQuery: previousQuery.generatedKQL,
        previousReasoning: previousQuery.reasoning,
        attemptNumber
      };

      const newQuery = await this.aiProvider.regenerateQuery({
        userInput: originalQuestion,
        context: regenerationContext
      });
      
      if (!newQuery) {
        throw new Error('Failed to regenerate query');
      }

      // Add to session history
      session.addToHistory(
        newQuery.generatedKQL, 
        newQuery.confidence, 
        'regenerated', 
        `Regeneration attempt ${attemptNumber}`
      );

      logger.info('QueryService: Query regenerated successfully');

      return {
        nlQuery: newQuery,
        session
      };

    } catch (error) {
      logger.error('QueryService: Query regeneration failed:', error);
      throw new Error(`Query regeneration failed: ${error}`);
    }
  }

  /**
   * Validate a query
   */
  async validateQuery(query: string): Promise<{ isValid: boolean; error?: string }> {
    return await this.orchestrator.validateQuery(query);
  }

  /**
   * Explain a query using AI
   */
  async explainQuery(query: string, options: {
    language?: string;
    technicalLevel?: 'beginner' | 'intermediate' | 'advanced';
    includeExamples?: boolean;
  } = {}): Promise<string> {
    logger.info('QueryService: Explaining query');

    try {
      const explanation = await this.aiProvider.explainQuery({
        query,
        options: {
          language: options.language as SupportedLanguage || 'en',
          technicalLevel: options.technicalLevel || 'intermediate',
          includeExamples: options.includeExamples !== false
        }
      });

      logger.info('QueryService: Query explanation generated successfully');
      return explanation;

    } catch (error) {
      logger.error('QueryService: Query explanation failed:', error);
      throw new Error(`Query explanation failed: ${error}`);
    }
  }

  /**
   * Get session history
   */
  async getSessionHistory(sessionId: string): Promise<{
    queries: string[];
    detailed: Array<{
      query: string;
      timestamp: Date;
      confidence: number;
      action: 'generated' | 'edited' | 'regenerated';
      reason?: string;
    }>;
  }> {
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return {
      queries: session.getHistory(),
      detailed: session.getDetailedHistory()
    };
  }

  /**
   * Update session options
   */
  async updateSessionOptions(sessionId: string, options: Partial<{
    language: SupportedLanguage;
    defaultMode: 'direct' | 'step' | 'raw';
    showConfidenceThreshold: number;
    allowEditing: boolean;
    maxRegenerationAttempts: number;
  }>): Promise<void> {
    await this.sessionManager.updateSessionOptions(sessionId, options);
  }

  /**
   * End a session
   */
  async endSession(sessionId: string): Promise<void> {
    await this.sessionManager.endSession(sessionId);
  }
}