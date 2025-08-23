import OpenAI from 'openai';
import { DefaultAzureCredential } from '@azure/identity';
import { IAIProvider } from '../../core/interfaces/IAIProvider';
import { NLQuery, RegenerationContext, SupportedLanguage, ExplanationOptions, Config } from '../../types';
import { logger } from '../../utils/logger';
import { getLanguageInstructions } from '../../utils/languageUtils';
import { withLoadingIndicator } from '../../utils/loadingIndicator';
import { AuthService } from '../../services/authService';

export interface AzureOpenAIConfig {
  apiKey?: string;
  endpoint: string;
  deploymentName: string;
  apiVersion?: string;
}

/**
 * Azure OpenAI implementation of IAIProvider
 */
export class AzureOpenAIProvider implements IAIProvider {
  private openAIClient: OpenAI | null = null;
  private initializationPromise: Promise<void> | null = null;

  constructor(
    private config: AzureOpenAIConfig,
    private authService: AuthService
  ) {
    this.initializationPromise = this.initializeOpenAI();
  }

  /**
   * Initialize the Azure OpenAI client
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  private async initializeOpenAI(): Promise<void> {
    try {
      if (this.config.apiKey) {
        // API Key authentication
        this.openAIClient = new OpenAI({
          apiKey: this.config.apiKey,
          baseURL: `${this.config.endpoint}/openai/deployments/${this.config.deploymentName}`,
          defaultQuery: { 'api-version': this.config.apiVersion || '2024-02-15-preview' },
          defaultHeaders: {
            'api-key': this.config.apiKey,
          },
        });
      } else {
        // Managed Identity authentication
        const credential = new DefaultAzureCredential();
        const tokenResponse = await credential.getToken(['https://cognitiveservices.azure.com/.default']);

        this.openAIClient = new OpenAI({
          apiKey: tokenResponse.token,
          baseURL: `${this.config.endpoint}/openai/deployments/${this.config.deploymentName}`,
          defaultQuery: { 'api-version': this.config.apiVersion || '2024-02-15-preview' },
          defaultHeaders: {
            'Authorization': `Bearer ${tokenResponse.token}`,
          },
        });
      }

      logger.info('Azure OpenAI provider initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Azure OpenAI provider:', error);
      throw error;
    }
  }

  async generateKQLQuery(naturalLanguageQuery: string, schema?: any): Promise<NLQuery | null> {
    await this.initialize();

    if (!this.openAIClient) {
      throw new Error('Azure OpenAI client not initialized');
    }

    logger.info(`Generating KQL query for: "${naturalLanguageQuery}"`);

    return withLoadingIndicator(
      'Generating KQL query with AI...',
      async () => {
        const systemPrompt = this.buildSystemPrompt(schema);
        const userPrompt = this.buildUserPrompt(naturalLanguageQuery);

        const response = await this.openAIClient!.chat.completions.create({
          model: this.config.deploymentName || 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 1000,
        });

        const choice = response.choices[0];
        if (!choice?.message?.content) {
          return null;
        }

        const generatedKQL = this.extractKQLFromResponse(choice.message.content);
        const reasoning = this.extractReasoningFromResponse(choice.message.content);
        const confidence = this.calculateConfidence(choice);

        return {
          originalQuestion: naturalLanguageQuery,
          generatedKQL,
          reasoning,
          confidence,
          timestamp: new Date()
        };
      },
      {
        successMessage: 'KQL query generated successfully',
        errorMessage: 'Failed to generate KQL query'
      }
    );
  }

  async regenerateKQLQuery(
    originalQuestion: string,
    context: RegenerationContext,
    schema?: any
  ): Promise<NLQuery | null> {
    await this.initialize();

    if (!this.openAIClient) {
      throw new Error('Azure OpenAI client not initialized');
    }

    logger.info(`Regenerating KQL query (attempt ${context.attemptNumber})`);

    return withLoadingIndicator(
      `Regenerating KQL query (attempt ${context.attemptNumber})...`,
      async () => {
        const systemPrompt = this.buildSystemPrompt(schema);
        const userPrompt = `Convert this natural language query to KQL: "${originalQuestion}"

Previous attempt (attempt ${context.attemptNumber}):
${context.previousQuery}

Please provide a DIFFERENT approach or query structure. Consider:
- Alternative operators or functions
- Different aggregation methods
- Alternative filtering approaches
- Different time window strategies

Respond with only the KQL query, no explanations.`;

        const response = await this.openAIClient!.chat.completions.create({
          model: this.config.deploymentName || 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.5 + (context.attemptNumber * 0.1),
          max_tokens: 1000,
        });

        const choice = response.choices[0];
        if (!choice?.message?.content) {
          return null;
        }

        const generatedKQL = this.extractKQLFromResponse(choice.message.content);
        const reasoning = `Regenerated approach (attempt ${context.attemptNumber})`;
        const confidence = Math.max(0.5, this.calculateConfidence(choice) - (context.attemptNumber * 0.1));

        return {
          originalQuestion,
          generatedKQL,
          reasoning,
          confidence,
          timestamp: new Date()
        };
      },
      {
        successMessage: `KQL query regenerated successfully (attempt ${context.attemptNumber})`,
        errorMessage: `Failed to regenerate KQL query (attempt ${context.attemptNumber})`
      }
    );
  }

  async explainKQLQuery(kqlQuery: string, options: ExplanationOptions = {}): Promise<string> {
    await this.initialize();

    if (!this.openAIClient) {
      throw new Error('Azure OpenAI client not initialized');
    }

    const language = options.language || 'auto' as SupportedLanguage;
    const technicalLevel = options.technicalLevel || 'intermediate';
    const includeExamples = options.includeExamples !== false;

    return withLoadingIndicator(
      `Generating KQL query explanation in language: ${language}...`,
      async () => {
        const systemPrompt = this.buildExplanationSystemPrompt(language, technicalLevel, includeExamples);
        const userPrompt = `Please explain this KQL query in detail:\\n\\n${kqlQuery}`;

        const response = await this.openAIClient!.chat.completions.create({
          model: this.config.deploymentName || 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 1500,
        });

        const explanation = response.choices[0]?.message?.content;
        if (!explanation) {
          throw new Error('No explanation generated from Azure OpenAI');
        }

        return explanation;
      },
      {
        successMessage: 'Query explanation generated successfully',
        errorMessage: 'Failed to generate query explanation'
      }
    );
  }

  async generateResponse(prompt: string): Promise<string> {
    await this.initialize();

    if (!this.openAIClient) {
      throw new Error('Azure OpenAI client not initialized');
    }

    return withLoadingIndicator(
      'Generating AI analysis...',
      async () => {
        const response = await this.openAIClient!.chat.completions.create({
          model: this.config.deploymentName || 'gpt-4',
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
          throw new Error('No response generated from Azure OpenAI');
        }

        return content;
      },
      {
        successMessage: 'AI analysis generated successfully',
        errorMessage: 'Failed to generate AI analysis'
      }
    );
  }

  async validateQuery(query: string): Promise<{ isValid: boolean; error?: string; warnings?: string[] }> {
    const trimmedQuery = query.trim();
    const warnings: string[] = [];

    if (!trimmedQuery) {
      return { isValid: false, error: 'Query cannot be empty' };
    }

    // Check for dangerous operations
    const dangerousPatterns = [
      /\b(DROP|DELETE|TRUNCATE|ALTER|CREATE|INSERT|UPDATE)\b/i,
      /\bexec\(/i,
      /\beval\(/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(trimmedQuery)) {
        return { 
          isValid: false, 
          error: 'Query contains potentially dangerous operations that are not allowed' 
        };
      }
    }

    // Performance warnings
    if (!trimmedQuery.toLowerCase().includes('where') && !trimmedQuery.toLowerCase().includes('limit')) {
      warnings.push('Query does not contain WHERE clause or LIMIT - this may result in large data sets');
    }

    return { isValid: true, warnings };
  }

  private buildSystemPrompt(schema?: any): string {
    let prompt = `You are an expert in KQL (Kusto Query Language) for Azure Application Insights.
Your task is to convert natural language queries into precise, efficient KQL queries.

Key Application Insights Tables:
- requests: HTTP requests to your application
- dependencies: Outgoing calls from your application  
- exceptions: Application exceptions and errors
- pageViews: Page view telemetry
- customEvents: Custom telemetry events
- traces: Application logging data
- performanceCounters: System performance metrics
- availabilityResults: Availability test results

Common Query Patterns:
- Performance analysis: requests | where duration > 1000 | summarize avg(duration) by bin(timestamp, 5m)
- Error analysis: exceptions | where timestamp > ago(1h) | summarize count() by problemId
- Dependency analysis: dependencies | where success == false | top 10 by duration desc
- User analysis: pageViews | summarize dcount(user_Id) by bin(timestamp, 1h)
- Custom metrics: customEvents | where name == "ButtonClick" | summarize count() by user_Id
- Availability monitoring: availabilityResults | summarize avg(success) by bin(timestamp, 15m), location
- Resource usage: performanceCounters | where counter startswith "% Processor Time" | summarize avg(value) by bin(timestamp, 5m)

Related Resources:
- Azure Monitor Community: https://github.com/microsoft/AzureMonitorCommunity
- KQL Best Practices: https://docs.microsoft.com/azure/data-explorer/kusto/query/best-practices
- Application Insights Query Examples: https://docs.microsoft.com/azure/azure-monitor/logs/examples`;

    if (schema) {
      prompt += `\\n\\nAvailable schema information:\\n${JSON.stringify(schema, null, 2)}`;
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

  private detectQueryType(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('error') || lowerQuery.includes('exception') || lowerQuery.includes('fail')) {
      return 'error_analysis';
    } else if (lowerQuery.includes('performance') || lowerQuery.includes('slow') || lowerQuery.includes('duration')) {
      return 'performance_analysis';
    } else if (lowerQuery.includes('user') || lowerQuery.includes('session')) {
      return 'user_analysis';
    } else if (lowerQuery.includes('dependency') || lowerQuery.includes('external')) {
      return 'dependency_analysis';
    } else if (lowerQuery.includes('availability') || lowerQuery.includes('uptime')) {
      return 'availability_analysis';
    }
    
    return 'general_query';
  }

  private getPatternGuidance(queryType: string): string {
    const patterns: Record<string, string> = {
      error_analysis: 'Focus on exceptions table. Use problemId, type, outerMessage for grouping errors.',
      performance_analysis: 'Use requests table with duration field. Consider percentiles (percentile functions).',
      user_analysis: 'Use pageViews or customEvents. Group by user_Id or user_AuthenticatedId.',
      dependency_analysis: 'Use dependencies table. Check success field and target information.',
      availability_analysis: 'Use availabilityResults table. Group by location and test name.',
      general_query: 'Identify the most relevant table based on the question context.'
    };
    
    return patterns[queryType] || patterns.general_query;
  }

  private extractKQLFromResponse(response: string): string {
    // Remove markdown code blocks if present
    const codeBlockMatch = response.match(/```(?:kql|kusto)?\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    
    // If no code blocks, return the response as-is (trimmed)
    return response.trim();
  }

  private extractReasoningFromResponse(response: string): string {
    // Extract reasoning part (simple implementation)
    const lines = response.split('\\n');
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
    // Simple confidence calculation based on finish reason
    if (choice.finish_reason === 'stop') {
      return 0.9;
    } else if (choice.finish_reason === 'length') {
      return 0.6;
    }
    return 0.5;
  }

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

  private getTechnicalLevelInstructions(technicalLevel: 'beginner' | 'intermediate' | 'advanced'): string {
    const instructions = {
      beginner: 'Use simple, non-technical language. Explain basic concepts and avoid jargon. Focus on what the query accomplishes rather than technical details.',
      intermediate: 'Balance technical accuracy with clarity. Explain key concepts and provide context for why certain approaches are used.',
      advanced: 'Use technical language and provide detailed insights into query optimization, performance implications, and advanced KQL concepts.'
    };

    return instructions[technicalLevel];
  }
}