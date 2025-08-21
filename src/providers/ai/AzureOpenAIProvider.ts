import OpenAI from 'openai';
import { DefaultAzureCredential } from '@azure/identity';
import { IAIProvider, QueryGenerationRequest, QueryExplanationRequest, RegenerationRequest } from '../../core/interfaces/IAIProvider';
import { IAuthenticationProvider } from '../../core/interfaces/IAuthenticationProvider';
import { AIProviderConfig } from '../../core/types/ProviderTypes';
import { NLQuery, OpenAIChoice } from '../../types';
import { logger } from '../../utils/logger';
import { getLanguageInstructions } from '../../utils/languageUtils';

/**
 * Azure OpenAI provider implementation
 */
export class AzureOpenAIProvider implements IAIProvider {
  private openAIClient: OpenAI | null = null;
  private initializationPromise: Promise<void> | null = null;

  constructor(
    private config: AIProviderConfig,
    private authProvider?: IAuthenticationProvider
  ) {
    if (this.config.type !== 'azure-openai') {
      throw new Error('Invalid provider type for AzureOpenAIProvider');
    }
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
          defaultQuery: { 'api-version': '2024-02-15-preview' },
          defaultHeaders: {
            'api-key': this.config.apiKey,
          },
        });
      } else {
        // Managed Identity authentication
        let token: string;
        if (this.authProvider) {
          token = await this.authProvider.getOpenAIToken();
        } else {
          const credential = new DefaultAzureCredential();
          const tokenResponse = await credential.getToken(['https://cognitiveservices.azure.com/.default']);
          token = tokenResponse.token;
        }

        this.openAIClient = new OpenAI({
          apiKey: token,
          baseURL: `${this.config.endpoint}/openai/deployments/${this.config.deploymentName}`,
          defaultQuery: { 'api-version': '2024-02-15-preview' },
          defaultHeaders: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }

      logger.info('Azure OpenAI client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Azure OpenAI client:', error);
      throw new Error('Azure OpenAI initialization failed');
    }
  }

  /**
   * Generate KQL query from natural language
   */
  async generateQuery(request: QueryGenerationRequest): Promise<NLQuery> {
    await this.initialize();

    if (!this.openAIClient) {
      throw new Error('Azure OpenAI client not initialized');
    }

    try {
      const systemPrompt = this.buildSystemPrompt(request.schema);
      const userPrompt = this.buildUserPrompt(request.userInput);

      logger.info(`Generating KQL query for: "${request.userInput}"`);

      const response = await this.openAIClient.chat.completions.create({
        model: this.config.deploymentName || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const generatedContent = response.choices[0]?.message?.content;
      if (!generatedContent) {
        throw new Error('No response generated from Azure OpenAI');
      }

      const kqlQuery = this.extractKQLFromResponse(generatedContent);
      const confidence = this.calculateConfidence(response.choices[0]);
      const reasoning = this.extractReasoningFromResponse(generatedContent);

      const result: NLQuery = {
        generatedKQL: kqlQuery,
        confidence,
        reasoning,
      };

      logger.info(`KQL query generated successfully: ${kqlQuery}`);
      return result;
    } catch (error) {
      logger.error('Failed to generate KQL query:', error);
      throw new Error(`KQL generation failed: ${error}`);
    }
  }

  /**
   * Explain a KQL query
   */
  async explainQuery(request: QueryExplanationRequest): Promise<string> {
    await this.initialize();

    if (!this.openAIClient) {
      throw new Error('Azure OpenAI client not initialized');
    }

    try {
      const languageInstructions = request.options?.language 
        ? getLanguageInstructions(request.options.language)
        : '';

      const prompt = `Explain this KQL query in simple terms:

Query: ${request.query}

${languageInstructions}

Please explain:
1. What this query does
2. What data it retrieves
3. How it processes the data
4. What the expected output format is

Keep the explanation clear and accessible.`;

      const response = await this.openAIClient.chat.completions.create({
        model: this.config.deploymentName || 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      });

      return response.choices[0]?.message?.content || 'Unable to generate explanation';
    } catch (error) {
      logger.error('Failed to explain query:', error);
      throw new Error(`Query explanation failed: ${error}`);
    }
  }

  /**
   * Regenerate query with context
   */
  async regenerateQuery(request: RegenerationRequest): Promise<NLQuery> {
    await this.initialize();

    if (!this.openAIClient) {
      throw new Error('Azure OpenAI client not initialized');
    }

    try {
      const systemPrompt = this.buildSystemPrompt(request.schema);
      const contextPrompt = this.buildRegenerationPrompt(request);

      logger.info(`Regenerating KQL query for: "${request.userInput}" (attempt ${request.context.attemptNumber})`);

      const response = await this.openAIClient.chat.completions.create({
        model: this.config.deploymentName || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextPrompt }
        ],
        temperature: 0.5, // Slightly higher temperature for variation
        max_tokens: 1000,
      });

      const generatedContent = response.choices[0]?.message?.content;
      if (!generatedContent) {
        throw new Error('No response generated from Azure OpenAI');
      }

      const kqlQuery = this.extractKQLFromResponse(generatedContent);
      const confidence = this.calculateConfidence(response.choices[0]);
      const reasoning = this.extractReasoningFromResponse(generatedContent);

      const result: NLQuery = {
        generatedKQL: kqlQuery,
        confidence,
        reasoning,
      };

      logger.info(`KQL query regenerated successfully: ${kqlQuery}`);
      return result;
    } catch (error) {
      logger.error('Failed to regenerate KQL query:', error);
      throw new Error(`KQL regeneration failed: ${error}`);
    }
  }

  /**
   * Generate generic response for analysis
   */
  async generateResponse(prompt: string): Promise<string> {
    await this.initialize();

    if (!this.openAIClient) {
      throw new Error('Azure OpenAI client not initialized');
    }

    try {
      const response = await this.openAIClient.chat.completions.create({
        model: this.config.deploymentName || 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      });

      return response.choices[0]?.message?.content || 'Unable to generate response';
    } catch (error) {
      logger.error('Failed to generate response:', error);
      throw new Error(`Response generation failed: ${error}`);
    }
  }

  // Private helper methods (extracted from original AIService)
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
- Top slow requests: requests | where duration > 1000 | top 10 by duration desc`;

    if (schema) {
      prompt += `\n\nAvailable schema:\n${JSON.stringify(schema, null, 2)}`;
    }

    return prompt;
  }

  private buildUserPrompt(naturalLanguageQuery: string): string {
    const queryType = this.detectQueryType(naturalLanguageQuery);
    const patternGuidance = this.getPatternGuidance(queryType);
    
    return `Convert this natural language query to KQL:

"${naturalLanguageQuery}"

${patternGuidance}

Return only the KQL query, no explanations.`;
  }

  private buildRegenerationPrompt(request: RegenerationRequest): string {
    return `I need you to generate a different KQL query for the same request.

Original request: "${request.userInput}"
Previous query: ${request.context.previousQuery}
Previous reasoning: ${request.context.previousReasoning || 'None provided'}
Attempt number: ${request.context.attemptNumber}

Please generate a different approach or variation that still addresses the original request.
Consider alternative query patterns, different aggregation approaches, or different filtering strategies.

Return only the KQL query, no explanations.`;
  }

  private detectQueryType(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('error') || lowerQuery.includes('fail') || lowerQuery.includes('exception')) {
      return 'errors';
    } else if (lowerQuery.includes('performance') || lowerQuery.includes('slow') || lowerQuery.includes('duration')) {
      return 'performance';
    } else if (lowerQuery.includes('dependency') || lowerQuery.includes('external')) {
      return 'dependencies';
    } else if (lowerQuery.includes('user') || lowerQuery.includes('session') || lowerQuery.includes('page')) {
      return 'user_experience';
    } else if (lowerQuery.includes('available') || lowerQuery.includes('uptime')) {
      return 'availability';
    } else if (lowerQuery.includes('count') || lowerQuery.includes('volume') || lowerQuery.includes('number')) {
      return 'volume';
    } else if (lowerQuery.includes('trend') || lowerQuery.includes('over time') || lowerQuery.includes('timeline')) {
      return 'trends';
    }
    
    return 'general';
  }

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
    // Remove markdown code blocks if present
    const cleanedResponse = response.replace(/```kql\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Split by lines and filter out explanatory text
    const lines = cleanedResponse.split('\n');
    const queryLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed && 
             !trimmed.startsWith('//') && 
             !trimmed.startsWith('#') && 
             !trimmed.startsWith('Explanation:') &&
             !trimmed.startsWith('This query') &&
             !trimmed.startsWith('The query');
    });
    
    return queryLines.join('\n').trim();
  }

  private calculateConfidence(choice: OpenAIChoice): number {
    if (!choice.finish_reason || choice.finish_reason === 'stop') {
      return 0.8; // Default confidence for completed responses
    }
    if (choice.finish_reason === 'length') {
      return 0.6; // Lower confidence for truncated responses
    }
    return 0.7; // Default for other cases
  }

  private extractReasoningFromResponse(response: string): string {
    const lines = response.split('\n');
    const reasoningLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed && (
        trimmed.startsWith('//') || 
        trimmed.startsWith('Explanation:') ||
        trimmed.startsWith('This query') ||
        trimmed.startsWith('The query')
      );
    });
    
    return reasoningLines.join(' ').replace(/^\/\/\s*/, '').trim() || 'Query generated based on natural language understanding';
  }
}