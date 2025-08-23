import { 
  IQueryOrchestrator, 
  NLQueryRequest, 
  TemplateQueryRequest, 
  IAIProvider, 
  IDataSourceProvider,
  ITemplateRepository
} from '../../core/interfaces';
import { QueryResultWithTiming, NLQuery } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Query orchestrator implementation
 */
export class QueryOrchestrator implements IQueryOrchestrator {
  constructor(
    private aiProvider: IAIProvider,
    private dataSourceProvider: IDataSourceProvider,
    private templateRepository?: ITemplateRepository
  ) {}

  /**
   * Execute a natural language query
   */
  async executeNaturalLanguageQuery(request: NLQueryRequest): Promise<QueryResultWithTiming> {
    logger.info(`Executing natural language query: "${request.userInput}"`);

    const startTime = Date.now();

    try {
      // Generate KQL query from natural language
      const nlQuery = await this.aiProvider.generateQuery({
        userInput: request.userInput,
        schema: request.schema
      });

      // Execute the generated KQL
      const result = await this.dataSourceProvider.executeQuery({
        query: nlQuery.generatedKQL
      });

      const executionTime = Date.now() - startTime;

      logger.info(`Natural language query executed successfully in ${executionTime}ms`);

      return {
        result,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('Failed to execute natural language query:', error);
      
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  /**
   * Execute a template query
   */
  async executeTemplateQuery(request: TemplateQueryRequest): Promise<QueryResultWithTiming> {
    logger.info(`Executing template query: ${request.templateId}`);

    if (!this.templateRepository) {
      throw new Error('Template repository is not configured');
    }

    const startTime = Date.now();

    try {
      // Get the template
      const template = await this.templateRepository.getTemplate(request.templateId);
      if (!template) {
        throw new Error(`Template not found: ${request.templateId}`);
      }

      // Apply parameters to generate KQL query
      const kqlQuery = await this.templateRepository.applyTemplate(template, request.parameters);

      // Execute the generated KQL
      const result = await this.dataSourceProvider.executeQuery({
        query: kqlQuery
      });

      const executionTime = Date.now() - startTime;

      logger.info(`Template query executed successfully in ${executionTime}ms`);

      return {
        result,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('Failed to execute template query:', error);
      
      throw new Error(`Template query execution failed: ${error}`);
    }
  }

  /**
   * Execute a raw KQL query
   */
  async executeRawQuery(query: string): Promise<QueryResultWithTiming> {
    logger.info(`Executing raw KQL query: ${query}`);

    const startTime = Date.now();

    try {
      const result = await this.dataSourceProvider.executeQuery({ query });
      const executionTime = Date.now() - startTime;

      logger.info(`Raw KQL query executed successfully in ${executionTime}ms`);

      return {
        result,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('Failed to execute raw KQL query:', error);
      
      throw new Error(`Raw query execution failed: ${error}`);
    }
  }

  /**
   * Validate a KQL query
   */
  async validateQuery(query: string): Promise<{ isValid: boolean; error?: string }> {
    logger.debug(`Validating KQL query: ${query}`);

    try {
      // Use the AI provider to validate the query if it supports validation
      if ('validateQuery' in this.aiProvider) {
        const aiService = this.aiProvider as any;
        if (typeof aiService.validateQuery === 'function') {
          return await aiService.validateQuery(query);
        }
      }

      // Fallback: Basic validation by attempting to execute against data source
      // This is a simple check - could be enhanced with more sophisticated validation
      if (!query || query.trim().length === 0) {
        return {
          isValid: false,
          error: 'Query cannot be empty'
        };
      }

      // Basic KQL syntax checks
      const basicErrors = this.performBasicValidation(query);
      if (basicErrors) {
        return {
          isValid: false,
          error: basicErrors
        };
      }

      logger.debug('Query validation passed');
      return { isValid: true };

    } catch (error) {
      logger.error('Query validation failed:', error);
      return {
        isValid: false,
        error: `Validation failed: ${error}`
      };
    }
  }

  /**
   * Perform basic KQL validation
   */
  private performBasicValidation(query: string): string | null {
    // Basic checks for common KQL syntax issues
    const trimmedQuery = query.trim();

    // Check for empty query
    if (!trimmedQuery) {
      return 'Query cannot be empty';
    }

    // Check for dangerous operations (basic security)
    const dangerousKeywords = ['drop', 'delete', 'truncate', '.create', '.set'];
    const lowerQuery = trimmedQuery.toLowerCase();
    
    for (const keyword of dangerousKeywords) {
      if (lowerQuery.includes(keyword)) {
        return `Potentially dangerous operation detected: ${keyword}`;
      }
    }

    // Check for basic KQL table names (Application Insights specific)
    const validTables = ['requests', 'dependencies', 'exceptions', 'pageviews', 'traces', 'customevents', 'availabilityresults'];
    const hasValidTable = validTables.some(table => lowerQuery.includes(table));
    
    if (!hasValidTable) {
      logger.warn('Query does not contain any known Application Insights tables');
      // Don't fail validation, just warn
    }

    return null;
  }
}