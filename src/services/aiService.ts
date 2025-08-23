import OpenAI from 'openai';
import { DefaultAzureCredential } from '@azure/identity';
import { AuthService } from './authService';
import { ConfigManager } from '../utils/config';
import { IAIProvider, QueryGenerationRequest, QueryExplanationRequest, RegenerationRequest, QueryAnalysisRequest, QueryAnalysisResult } from '../core/interfaces/IAIProvider';
import { NLQuery, RegenerationContext, SupportedLanguage, ExplanationOptions } from '../types';
import { logger } from '../utils/logger';
import { getLanguageInstructions } from '../utils/languageUtils';
import { withLoadingIndicator } from '../utils/loadingIndicator';

export class AIService implements IAIProvider {
  private openAIClient: OpenAI | null = null;
  private authService: AuthService;
  private configManager: ConfigManager;
  private initializationPromise: Promise<void> | null = null;

  constructor(authService: AuthService, configManager: ConfigManager) {
    this.authService = authService;
    this.configManager = configManager;
    this.initializationPromise = this.initializeOpenAI();
  }

  /**
   * Wait for OpenAI client initialization completion
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  private async initializeOpenAI(): Promise<void> {
    try {
      const defaultAI = this.configManager.getDefaultProvider('ai');
      const aiConfig = this.configManager.getProviderConfig('ai', defaultAI);
      
      if (!aiConfig) {
        throw new Error(`AI provider '${defaultAI}' configuration not found`);
      }

      if (aiConfig.apiKey) {
        // API Key authentication
        this.openAIClient = new OpenAI({
          apiKey: aiConfig.apiKey,
          baseURL: `${aiConfig.endpoint}/openai/deployments/${aiConfig.deploymentName}`,
          defaultQuery: { 'api-version': '2024-02-15-preview' },
          defaultHeaders: {
            'api-key': aiConfig.apiKey,
          },
        });
      } else {
        // Managed Identity authentication (simplified)
        const credential = new DefaultAzureCredential();
        const tokenResponse = await credential.getToken(['https://cognitiveservices.azure.com/.default']);

        this.openAIClient = new OpenAI({
          apiKey: tokenResponse.token,
          baseURL: `${aiConfig.endpoint}/openai/deployments/${aiConfig.deploymentName}`,
          defaultQuery: { 'api-version': '2024-02-15-preview' },
          defaultHeaders: {
            'Authorization': `Bearer ${tokenResponse.token}`,
          },
        });
      }

      logger.info('OpenAI client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize OpenAI client:', error);
      throw new Error('OpenAI initialization failed');
    }
  }

  public async generateKQLQuery(naturalLanguageQuery: string, schema?: any): Promise<NLQuery> {
    // 初期化完了を待つ
    await this.initialize();

    if (!this.openAIClient) {
      throw new Error('OpenAI client not initialized');
    }

    logger.info(`Generating KQL query for: "${naturalLanguageQuery}"`);

    return withLoadingIndicator(
      'Generating KQL query with AI...',
      async () => {
        const defaultAI = this.configManager.getDefaultProvider('ai');
        const aiConfig = this.configManager.getProviderConfig('ai', defaultAI);
        
        if (!aiConfig) {
          throw new Error(`AI provider '${defaultAI}' configuration not found`);
        }

        const systemPrompt = this.buildSystemPrompt(schema);
        const userPrompt = this.buildUserPrompt(naturalLanguageQuery);

        const response = await this.openAIClient!.chat.completions.create({
          model: aiConfig.deploymentName || 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 1000,
        });

        const generatedContent = response.choices[0]?.message?.content;
        if (!generatedContent) {
          throw new Error('No response generated from OpenAI');
        }

        const kqlQuery = this.extractKQLFromResponse(generatedContent);
        const confidence = this.calculateConfidence(response.choices[0]);
        const reasoning = this.extractReasoningFromResponse(generatedContent);

        const result: NLQuery = {
          generatedKQL: kqlQuery,
          confidence,
          reasoning,
        };

        return result;
      },
      {
        successMessage: 'KQL query generated successfully',
        errorMessage: 'Failed to generate KQL query'
      }
    );
  }

  private buildSystemPrompt(schema?: any): string {
    let prompt = `You are an expert in Azure Application Insights KQL (Kusto Query Language).
Your task is to convert natural language queries into valid KQL queries for Application Insights.
Follow Azure Monitor Community best practices and proven patterns.

Key guidelines:
- Generate only valid KQL syntax
- Use proper table names (requests, dependencies, exceptions, pageViews, etc.)
- Include appropriate time filters when time-related queries are mentioned
- Use proper aggregation functions (count(), avg(), max(), min(), sum(), etc.)
- Format the response as a clean KQL query without explanations
- If the query is ambiguous, make reasonable assumptions based on common scenarios

Common Application Insights tables:
- requests: HTTP requests to your application
- dependencies: Calls from your application to external services
- exceptions: Exception telemetry
- pageViews: Page view telemetry from client-side
- customEvents: Custom events you track
- traces: Trace/log messages
- performanceCounters: Performance counter data
- availabilityResults: Availability test results

Azure Monitor Community Best Practices:
- Use time-based filtering early in queries for performance (e.g., | where timestamp > ago(1h))
- Prefer bin() for time-series aggregation (e.g., bin(timestamp, 5m))
- Use summarize with proper grouping for aggregated data
- Include percentile() functions for performance analysis (percentile_95, percentile_99)
- Use join only when necessary and prefer left outer joins
- Apply limit early to reduce data processing overhead
- Use project to reduce column overhead when working with large datasets

Common Performance Monitoring Patterns:
- Response time analysis: requests | summarize avg(duration), percentiles(duration, 50, 95, 99) by bin(timestamp, 5m)
- Request volume: requests | summarize count() by bin(timestamp, 1h), resultCode
- Error rate: requests | summarize ErrorRate = 100.0 * sum(toint(success == false)) / count() by bin(timestamp, 5m)
- Top slow requests: requests | where duration > 1000 | top 10 by duration desc
- Dependency performance: dependencies | summarize avg(duration) by target, type | sort by avg_duration desc

Common Error Tracking Patterns:
- Exception trends: exceptions | summarize count() by bin(timestamp, 1h), type
- Error distribution: requests | where success == false | summarize count() by resultCode, operation_Name
- Failed dependency calls: dependencies | where success == false | summarize count() by target, type

User Experience Patterns:
- Page load times: pageViews | summarize avg(duration), percentiles(duration, 50, 95) by name
- User session analysis: pageViews | summarize Pages=dcount(name), Duration=sum(duration) by session_Id | summarize avg(Pages), avg(Duration)

Operational Patterns:
- Availability monitoring: availabilityResults | summarize avg(success) by bin(timestamp, 15m), location
- Resource usage: performanceCounters | where counter startswith "% Processor Time" | summarize avg(value) by bin(timestamp, 5m)

Related Resources:
- Azure Monitor Community: https://github.com/microsoft/AzureMonitorCommunity
- KQL Best Practices: https://docs.microsoft.com/azure/data-explorer/kusto/query/best-practices
- Application Insights Query Examples: https://docs.microsoft.com/azure/azure-monitor/logs/examples`;

    if (schema) {
      prompt += `\n\nAvailable schema information:\n${JSON.stringify(schema, null, 2)}`;
    }

    return prompt;
  }

  private buildUserPrompt(naturalLanguageQuery: string): string {
    const queryType = this.detectQueryType(naturalLanguageQuery);
    const patternGuidance = this.getPatternGuidance(queryType);

    let prompt = `Convert this natural language query to KQL: "${naturalLanguageQuery}"

Query Type Detected: ${queryType}
${patternGuidance}

Respond with only the KQL query, no explanations or additional text.`;

    return prompt;
  }

  /**
   * Detect the type of query based on natural language patterns
   */
  private detectQueryType(query: string): string {
    const lowerQuery = query.toLowerCase();

    // Performance-related queries
    if (lowerQuery.includes('performance') || lowerQuery.includes('slow') ||
        lowerQuery.includes('response time') || lowerQuery.includes('latency') ||
        lowerQuery.includes('duration') || lowerQuery.includes('speed')) {
      return 'performance';
    }

    // Error-related queries
    if (lowerQuery.includes('error') || lowerQuery.includes('exception') ||
        lowerQuery.includes('fail') || lowerQuery.includes('problem') ||
        lowerQuery.includes('issue') || lowerQuery.includes('bug')) {
      return 'errors';
    }

    // Dependency-related queries
    if (lowerQuery.includes('dependency') || lowerQuery.includes('external') ||
        lowerQuery.includes('api') || lowerQuery.includes('service') ||
        lowerQuery.includes('call')) {
      return 'dependencies';
    }

    // User experience queries
    if (lowerQuery.includes('user') || lowerQuery.includes('page') ||
        lowerQuery.includes('session') || lowerQuery.includes('view') ||
        lowerQuery.includes('browser') || lowerQuery.includes('client')) {
      return 'user_experience';
    }

    // Availability queries
    if (lowerQuery.includes('availability') || lowerQuery.includes('uptime') ||
        lowerQuery.includes('downtime') || lowerQuery.includes('health')) {
      return 'availability';
    }

    // Volume/traffic queries
    if (lowerQuery.includes('count') || lowerQuery.includes('number') ||
        lowerQuery.includes('volume') || lowerQuery.includes('traffic') ||
        lowerQuery.includes('requests') || lowerQuery.includes('how many')) {
      return 'volume';
    }

    // Trend analysis
    if (lowerQuery.includes('trend') || lowerQuery.includes('over time') ||
        lowerQuery.includes('timeline') || lowerQuery.includes('history') ||
        lowerQuery.includes('graph') || lowerQuery.includes('chart')) {
      return 'trends';
    }

    return 'general';
  }

  /**
   * Get pattern guidance based on detected query type
   */
  private getPatternGuidance(queryType: string): string {
    switch (queryType) {
      case 'performance':
        return `Pattern Guidance: Use percentile functions (percentile_95, percentile_99), include duration fields, consider time-series binning.
Example structure: | summarize avg(duration), percentiles(duration, 50, 95, 99) by bin(timestamp, 5m)`;

      case 'errors':
        return `Pattern Guidance: Focus on success==false conditions, group by error types/codes, calculate error rates.
Example structure: | where success == false | summarize count() by resultCode, operation_Name`;

      case 'dependencies':
        return `Pattern Guidance: Use dependencies table, group by target/type, analyze success rates and performance.
Example structure: dependencies | summarize avg(duration), success_rate=avg(todouble(success)) by target, type`;

      case 'user_experience':
        return `Pattern Guidance: Use pageViews table, analyze session patterns, focus on client-side metrics.
Example structure: pageViews | summarize avg(duration), dcount(session_Id) by name`;

      case 'availability':
        return `Pattern Guidance: Use availabilityResults table, calculate success percentages, group by location/test.
Example structure: availabilityResults | summarize availability=avg(todouble(success))*100 by location`;

      case 'volume':
        return `Pattern Guidance: Use count() aggregation, consider time binning for trends, group by relevant dimensions.
Example structure: | summarize count() by bin(timestamp, 1h), resultCode`;

      case 'trends':
        return `Pattern Guidance: Always include time binning with bin(timestamp, interval), use render timechart for visualization.
Example structure: | summarize count() by bin(timestamp, 1h) | render timechart`;

      default:
        return `Pattern Guidance: Apply general best practices - include time filters, use appropriate aggregations, optimize for performance.`;
    }
  }

  private extractKQLFromResponse(response: string): string {
    // コードブロックから KQL を抽出
    const codeBlockMatch = response.match(/```(?:kql|kusto)?\n?(.*?)\n?```/s);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // コードブロックがない場合は、レスポンス全体をクリーンアップ
    return response
      .replace(/^(Here's the KQL query:|KQL:|Query:)/i, '')
      .trim()
      .replace(/\n+/g, '\n');
  }

  private extractReasoningFromResponse(response: string): string {
    // 推論部分の抽出（簡単な実装）
    const lines = response.split('\n');
    const reasoningLines = lines.filter(line =>
      !line.includes('```') &&
      !line.startsWith('requests') &&
      !line.startsWith('dependencies') &&
      !line.includes('|') &&
      line.trim().length > 0
    );
    return reasoningLines.join(' ').substring(0, 200) + '...';
  }

  private calculateConfidence(choice: any): number {
    // 簡単な信頼度計算（実際の実装では、より洗練されたロジックを使用）
    if (choice.finish_reason === 'stop') {
      return 0.9;
    } else if (choice.finish_reason === 'length') {
      return 0.6;
    }
    return 0.5;
  }

  /**
   * KQLクエリの詳細な説明を生成
   */
  public async explainKQLQuery(kqlQuery: string, options: ExplanationOptions = {}): Promise<string> {
    // 初期化完了を待つ
    await this.initialize();

    if (!this.openAIClient) {
      throw new Error('OpenAI client not initialized');
    }

    const config = this.configManager.getConfig();
    const language = (options.language || config.language || 'auto') as SupportedLanguage;
    const technicalLevel = options.technicalLevel || 'intermediate';
    const includeExamples = options.includeExamples !== false;

    return withLoadingIndicator(
      `Generating KQL query explanation in language: ${language}...`,
      async () => {
        const defaultAI = this.configManager.getDefaultProvider('ai');
        const aiConfig = this.configManager.getProviderConfig('ai', defaultAI);
        
        if (!aiConfig) {
          throw new Error(`AI provider '${defaultAI}' configuration not found`);
        }

        const systemPrompt = this.buildExplanationSystemPrompt(language, technicalLevel, includeExamples);
        const userPrompt = `Please explain this KQL query in detail:\n\n${kqlQuery}`;

        const response = await this.openAIClient!.chat.completions.create({
          model: aiConfig.deploymentName || 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 1500,
        });

        const explanation = response.choices[0]?.message?.content;
        if (!explanation) {
          throw new Error('No explanation generated from OpenAI');
        }

        return explanation;
      },
      {
        successMessage: 'Query explanation generated successfully',
        errorMessage: 'Failed to generate query explanation'
      }
    );
  }

  /**
   * 説明用のシステムプロンプトを構築
   */
  private buildExplanationSystemPrompt(
    language: SupportedLanguage,
    technicalLevel: 'beginner' | 'intermediate' | 'advanced',
    includeExamples: boolean
  ): string {
    const languageInstructions = getLanguageInstructions(language);
    const levelInstructions = this.getTechnicalLevelInstructions(technicalLevel);
    const exampleInstructions = includeExamples ? 'Provide practical examples when helpful.' : 'Focus on clear explanations without extensive examples.';

    return `You are an expert in KQL (Kusto Query Language) for Azure Application Insights.
Your task is to explain KQL queries in a clear, detailed, and educational way.

${languageInstructions}

${levelInstructions}

Explain:
1. What the query does overall
2. Each operator and function used
3. What data it retrieves
4. How the results are processed
5. Any performance considerations

${exampleInstructions}`;
  }

  /**
   * 技術レベル固有の指示を取得
   */
  private getTechnicalLevelInstructions(level: 'beginner' | 'intermediate' | 'advanced'): string {
    switch (level) {
      case 'beginner':
        return 'Target explanation for beginners: Use simple language, avoid complex jargon, and explain basic concepts thoroughly.';
      case 'advanced':
        return 'Target explanation for advanced users: Use precise technical terminology, focus on performance implications, and provide detailed technical insights.';
      case 'intermediate':
      default:
        return 'Target explanation for intermediate users: Balance technical accuracy with clear explanations, assuming familiarity with basic KQL concepts.';
    }
  }

  /**
   * KQLクエリを再生成（異なるアプローチで）
   */
  public async regenerateKQLQuery(
    originalQuestion: string,
    context: RegenerationContext,
    schema?: any
  ): Promise<NLQuery | null> {
    // 初期化完了を待つ
    await this.initialize();

    if (!this.openAIClient) {
      throw new Error('OpenAI client not initialized');
    }

    logger.info(`Regenerating KQL query (attempt ${context.attemptNumber})`);

    return withLoadingIndicator(
      `Regenerating KQL query (attempt ${context.attemptNumber})...`,
      async () => {
        const defaultAI = this.configManager.getDefaultProvider('ai');
        const aiConfig = this.configManager.getProviderConfig('ai', defaultAI);
        
        if (!aiConfig) {
          throw new Error(`AI provider '${defaultAI}' configuration not found`);
        }

        const systemPrompt = this.buildSystemPrompt(schema);

        const userPrompt = `Convert this natural language query to KQL: "${originalQuestion}"

Previous attempt (attempt ${context.attemptNumber}):
${context.previousQuery}

Please provide a DIFFERENT approach or query structure. Consider:
- Alternative table joins
- Different aggregation methods
- Different time window approaches
- Alternative filtering strategies

Respond with only the new KQL query, no explanations.`;

        const response = await this.openAIClient!.chat.completions.create({
          model: aiConfig.deploymentName || 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7, // 少し高い temperature で多様性を増やす
          max_tokens: 1000,
        });

        const generatedContent = response.choices[0]?.message?.content;
        if (!generatedContent) {
          throw new Error('No response generated from OpenAI');
        }

        const kqlQuery = this.extractKQLFromResponse(generatedContent);

        // 前のクエリと同じでないかチェック
        if (kqlQuery.trim() === context.previousQuery.trim()) {
          logger.warn('Regenerated query is identical to previous query');
          return null;
        }

        const confidence = this.calculateConfidence(response.choices[0]) * 0.8; // 再生成は少し信頼度を下げる
        const reasoning = `Regenerated approach (attempt ${context.attemptNumber})`;

        const result: NLQuery = {
          generatedKQL: kqlQuery,
          confidence,
          reasoning,
        };

        return result;
      },
      {
        successMessage: 'KQL query regenerated successfully',
        errorMessage: 'Failed to regenerate KQL query'
      }
    );
  }

  public async validateQuery(kqlQuery: string): Promise<{ isValid: boolean; error?: string }> {
    // KQLクエリの基本的な構文チェック
    try {
      // 基本的な構文チェック
      if (!kqlQuery.trim()) {
        return { isValid: false, error: 'Query is empty' };
      }

      // 危険なキーワードのチェック
      const dangerousPatterns = [
        /drop\s+table/i,
        /delete\s+from/i,
        /truncate\s+table/i,
        /alter\s+table/i,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(kqlQuery)) {
          return { isValid: false, error: 'Query contains potentially dangerous operations' };
        }
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: `Validation error: ${error}` };
    }
  }

  /**
   * Generate AI response for analysis prompts
   */
  public async generateResponse(prompt: string): Promise<string> {
    await this.initialize();

    if (!this.openAIClient) {
      throw new Error('OpenAI client not initialized');
    }

    return withLoadingIndicator(
      'Generating AI analysis...',
      async () => {
        const defaultAI = this.configManager.getDefaultProvider('ai');
        const aiConfig = this.configManager.getProviderConfig('ai', defaultAI);
        
        if (!aiConfig) {
          throw new Error(`AI provider '${defaultAI}' configuration not found`);
        }
        
        const response = await this.openAIClient!.chat.completions.create({
          model: aiConfig.deploymentName || 'gpt-4',
          messages: [
            { 
              role: 'system', 
              content: 'You are an expert Application Insights data analyst. Provide concise, actionable insights based on the query results. Always focus on practical recommendations for application monitoring and performance optimization.' 
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 1500,
        });


        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response generated from OpenAI');
        }

        return content;
      },
      {
        successMessage: 'AI analysis generated successfully',
        errorMessage: 'Failed to generate AI analysis'
      }
    );
  }

  // IAIProvider interface implementation methods
  async generateQuery(request: QueryGenerationRequest): Promise<NLQuery> {
    return this.generateKQLQuery(request.userInput, request.schema);
  }

  async explainQuery(request: QueryExplanationRequest): Promise<string> {
    return this.explainKQLQuery(request.query, request.options);
  }

  async regenerateQuery(request: RegenerationRequest): Promise<NLQuery> {
    const result = await this.regenerateKQLQuery(request.userInput, request.context, request.schema);
    if (!result) {
      throw new Error('Failed to regenerate query');
    }
    return result;
  }

  /**
   * Analyze query results (delegates to legacy analysis for now)
   */
  async analyzeQueryResult(request: QueryAnalysisRequest): Promise<QueryAnalysisResult> {
    try {
      logger.info(`Analyzing query result with type: ${request.analysisType} (legacy fallback)`);

      // This is a simplified implementation for compatibility
      // The actual analysis logic should be in AnalysisService
      const prompt = this.buildAnalysisPrompt(request);
      const response = await this.generateResponse(prompt);

      return this.parseAnalysisResponse(response, request.analysisType);
    } catch (error) {
      logger.error('Failed to analyze query result:', error);
      throw new Error(`Query result analysis failed: ${error}`);
    }
  }

  private buildAnalysisPrompt(request: QueryAnalysisRequest): string {
    const languageInstructions = request.options?.language
      ? getLanguageInstructions(request.options.language)
      : '';

    let analysisType = '';
    switch (request.analysisType) {
      case 'patterns':
        analysisType = 'Focus on identifying patterns, trends, and correlations in the data.';
        break;
      case 'anomalies':
        analysisType = 'Focus on detecting anomalies, outliers, and unusual patterns in the data.';
        break;
      case 'insights':
        analysisType = 'Focus on generating business insights and actionable recommendations.';
        break;
      case 'full':
        analysisType = 'Provide a comprehensive analysis including patterns, anomalies, and business insights.';
        break;
    }

    return `Analyze the following query result data:

Original Query: ${request.originalQuery}

Data Summary: ${JSON.stringify(request.result, null, 2)}

Analysis Type: ${analysisType}

${languageInstructions}

Please provide insights and recommendations based on the data.`;
  }

  private parseAnalysisResponse(content: string, analysisType: string): QueryAnalysisResult {
    // Simplified parsing for legacy compatibility
    const result: QueryAnalysisResult = {
      aiInsights: content,
      recommendations: ['Review the analysis results', 'Consider additional data exploration']
    };

    if (analysisType === 'patterns' || analysisType === 'full') {
      result.patterns = {
        trends: [{ description: 'Analysis completed', confidence: 0.7, visualization: 'chart recommended' }],
        anomalies: [],
        correlations: []
      };
    }

    if (analysisType === 'insights' || analysisType === 'full') {
      result.insights = {
        dataQuality: {
          completeness: 90,
          consistency: ['Data appears consistent'],
          recommendations: ['Consider additional validation']
        },
        businessInsights: {
          keyFindings: ['Analysis completed'],
          potentialIssues: [],
          opportunities: []
        },
        followUpQueries: []
      };
    }

    return result;
  }
}
