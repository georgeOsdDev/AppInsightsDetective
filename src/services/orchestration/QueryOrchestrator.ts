import { 
  IQueryOrchestrator, 
  QueryExecutionRequest, 
  QueryExecutionResult 
} from '../../core/interfaces/IQueryOrchestrator';
import { IAIProvider } from '../../core/interfaces/IAIProvider';
import { IDataSourceProvider } from '../../core/interfaces/IDataSourceProvider';
import { QueryResult, NLQuery, AnalysisResult, AnalysisType } from '../../types';
import { AnalysisService } from '../analysisService';
import { StepExecutionService, StepExecutionOptions } from '../stepExecutionService';
import { logger } from '../../utils/logger';

/**
 * Query orchestrator implementation that coordinates AI, data source, and analysis services
 */
export class QueryOrchestrator implements IQueryOrchestrator {
  private analysisService: AnalysisService;
  private stepExecutionService: StepExecutionService;

  constructor(
    private aiProvider: IAIProvider,
    private dataSourceProvider: IDataSourceProvider,
    private stepExecutionOptions: StepExecutionOptions = {}
  ) {
    // Create analysis service with AI provider wrapped as AIService for compatibility
    this.analysisService = new AnalysisService(
      this.createAIServiceWrapper(),
      null as any // ConfigManager not needed for analysis
    );

    // Create step execution service for step-by-step mode
    this.stepExecutionService = new StepExecutionService(
      this.createAIServiceWrapper(),
      this.createAppInsightsServiceWrapper(),
      this.stepExecutionOptions
    );
  }

  async executeNaturalLanguageQuery(request: QueryExecutionRequest): Promise<QueryExecutionResult> {
    if (!request.naturalLanguageQuery) {
      throw new Error('Natural language query is required');
    }

    const startTime = Date.now();
    
    try {
      logger.info(`Processing natural language query: "${request.naturalLanguageQuery}"`);

      // Generate KQL query using AI provider
      const nlQuery = await this.aiProvider.generateKQLQuery(
        request.naturalLanguageQuery,
        request.schema
      );

      if (!nlQuery) {
        throw new Error('Failed to generate KQL query from natural language');
      }

      // Execute the generated query
      const result = await this.dataSourceProvider.executeQuery(nlQuery.generatedKQL);
      const executionTime = Date.now() - startTime;

      // Perform analysis if requested
      let analysisResult: AnalysisResult | undefined;
      if (request.mode === 'direct') {
        analysisResult = await this.analyzeResults(result);
      }

      return {
        result,
        executionTime,
        nlQuery,
        analysisResult
      };
    } catch (error) {
      logger.error('Natural language query execution failed:', error);
      throw error;
    }
  }

  async executeRawQuery(query: string): Promise<QueryExecutionResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Executing raw KQL query: ${query.substring(0, 100)}...`);

      const result = await this.dataSourceProvider.executeQuery(query);
      const executionTime = Date.now() - startTime;

      return {
        result,
        executionTime
      };
    } catch (error) {
      logger.error('Raw query execution failed:', error);
      throw error;
    }
  }

  async executeStepByStepQuery(
    naturalLanguageQuery: string,
    schema?: any
  ): Promise<QueryExecutionResult | null> {
    try {
      logger.info(`Starting step-by-step execution for: "${naturalLanguageQuery}"`);

      // Generate initial query
      const nlQuery = await this.aiProvider.generateKQLQuery(naturalLanguageQuery, schema);
      if (!nlQuery) {
        throw new Error('Failed to generate initial KQL query');
      }

      // Use step execution service for interactive review
      const stepResult = await this.stepExecutionService.executeStepByStep(nlQuery, naturalLanguageQuery);
      
      if (!stepResult) {
        return null; // User cancelled
      }

      return {
        result: stepResult.result,
        executionTime: stepResult.executionTime,
        nlQuery
      };
    } catch (error) {
      logger.error('Step-by-step query execution failed:', error);
      throw error;
    }
  }

  async analyzeResults(result: QueryResult, analysisType?: string): Promise<AnalysisResult> {
    try {
      logger.info('Analyzing query results');

      // Determine analysis type based on data characteristics or use provided type
      const detectedType = analysisType || this.detectAnalysisType(result);
      
      return await this.analysisService.analyzeQueryResult(
        result, 
        'generated-query', // placeholder for originalQuery
        detectedType as AnalysisType
      );
    } catch (error) {
      logger.error('Result analysis failed:', error);
      throw error;
    }
  }

  private detectAnalysisType(result: QueryResult): string {
    // Simple heuristics to determine analysis type based on data
    if (result.tables.length === 0) {
      return 'insights';
    }

    const firstTable = result.tables[0];
    const columnNames = firstTable.columns.map(col => col.name.toLowerCase());
    
    if (columnNames.includes('timestamp') && firstTable.rows.length > 10) {
      return 'full'; // Time series data gets full analysis
    } else if (firstTable.rows.length > 50) {
      return 'statistical'; // Large datasets get statistical analysis
    } else {
      return 'insights'; // Small datasets get insights analysis
    }
  }

  /**
   * Wrapper to make AIProvider compatible with existing AIService interface
   */
  private createAIServiceWrapper(): any {
    return {
      initialize: () => this.aiProvider.initialize(),
      generateKQLQuery: (query: string, schema?: any) => this.aiProvider.generateKQLQuery(query, schema),
      regenerateKQLQuery: (question: string, context: any, schema?: any) => 
        this.aiProvider.regenerateKQLQuery(question, context, schema),
      explainKQLQuery: (query: string, options?: any) => this.aiProvider.explainKQLQuery(query, options),
      generateResponse: (prompt: string) => this.aiProvider.generateResponse(prompt),
      validateQuery: (query: string) => this.aiProvider.validateQuery(query)
    };
  }

  /**
   * Wrapper to make DataSourceProvider compatible with existing AppInsightsService interface
   */
  private createAppInsightsServiceWrapper(): any {
    return {
      executeQuery: (query: string) => this.dataSourceProvider.executeQuery(query),
      validateConnection: () => this.dataSourceProvider.validateConnection(),
      getSchema: () => this.dataSourceProvider.getSchema(),
      getResourceId: () => this.dataSourceProvider.getResourceId()
    };
  }
}