import OpenAI from 'openai';
import { IAIProvider, QueryGenerationRequest, QueryExplanationRequest, RegenerationRequest, QueryAnalysisRequest, QueryAnalysisResult } from '../../core/interfaces/IAIProvider';
import { IAuthenticationProvider } from '../../core/interfaces/IAuthenticationProvider';
import { AIProviderConfig } from '../../core/types/ProviderTypes';
import { NLQuery, OpenAIChoice } from '../../types';
import { logger } from '../../utils/logger';
import { buildSystemPrompt, buildRegenerationPrompt, buildExplanationSystemPrompt, buildPatternAnalysisPrompt, buildInsightsPrompt } from './prompts/systemPrompts';

/**
 * OpenAI provider implementation (non-Azure)
 */
export class OpenAIProvider implements IAIProvider {
  protected openAIClient: OpenAI | null = null;
  protected initializationPromise: Promise<void> | null = null;

  constructor(
    protected config: AIProviderConfig,
    protected authProvider?: IAuthenticationProvider
  ) {
    // Don't start initialization immediately to avoid throwing errors in constructor
  }

  /**
   * Initialize the OpenAI client
   */
  async initialize(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = this.initializeOpenAI();
    }
    await this.initializationPromise;
  }

  protected async initializeOpenAI(): Promise<void> {
    if (this.config.type !== 'openai') {
      throw new Error('Invalid provider type for OpenAIProvider');
    }
    try {
      if (!this.config.apiKey) {
        throw new Error('OpenAI API key is required');
      }

      // Initialize OpenAI client
      this.openAIClient = new OpenAI({
        apiKey: this.config.apiKey,
      });

      logger.debug('OpenAI client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize OpenAI client:', error);
      throw error;
    }
  }

  /**
   * Generate KQL query from natural language
   */
  async generateQuery(request: QueryGenerationRequest): Promise<NLQuery> {
    await this.initialize();

    if (!this.openAIClient) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      logger.debug('Generating KQL query with OpenAI...');

      const systemPrompt = buildSystemPrompt(request.dataSourceType, request.schema, request.extraContext);
      const userPrompt = `Convert this natural language query to KQL: "${request.userInput}"`;

      const response = await this.openAIClient.chat.completions.create({
        model: this.config.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      if (!response.choices?.[0]?.message?.content) {
        throw new Error('No content received from OpenAI');
      }

      const generatedContent = response.choices[0].message.content;

      // Parse the JSON response
      const kqlQuery = this.extractKQLFromResponse(generatedContent);
      const confidence = this.calculateConfidence(response.choices[0], generatedContent);
      const reasoning = this.extractReasoningFromResponse(generatedContent);

      const result: NLQuery = {
        generatedKQL: kqlQuery,
        confidence,
        reasoning,
      };

      logger.debug(`KQL query generated successfully: ${kqlQuery}`);
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
      throw new Error('OpenAI client not initialized');
    }

    try {
      logger.debug(`Generating KQL query explanation in language: ${request.options?.language || 'auto'}...`);

      const systemPrompt = buildExplanationSystemPrompt(
        request.options?.language || 'en',
        request.options?.technicalLevel || 'intermediate',
        request.options?.includeExamples !== false
      );

      const userPrompt = `Please explain this KQL query:\n\n${request.query}`;

      const response = await this.openAIClient.chat.completions.create({
        model: this.config.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });

      return response.choices[0]?.message?.content || 'Unable to generate explanation';
    } catch (error) {
      logger.error('Failed to explain KQL query:', error);
      throw new Error(`Query explanation failed: ${error}`);
    }
  }

  /**
   * Regenerate query with context
   */
  async regenerateQuery(request: RegenerationRequest): Promise<NLQuery> {
    await this.initialize();

    if (!this.openAIClient) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      logger.debug(`Regenerating KQL query (attempt ${request.context.attemptNumber}) with OpenAI...`);

      const systemPrompt = buildSystemPrompt(request.dataSourceType, request.schema, request.extraContext);
      const userPrompt = buildRegenerationPrompt(
        request.userInput,
        request.context.previousQuery,
        request.context.attemptNumber
      );

      const response = await this.openAIClient.chat.completions.create({
        model: this.config.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5, // Higher temperature for more variation
        max_tokens: 1000,
      });

      if (!response.choices?.[0]?.message?.content) {
        throw new Error('No content received from OpenAI');
      }

      const generatedContent = response.choices[0].message.content;

      // Parse the JSON response
      const kqlQuery = this.extractKQLFromResponse(generatedContent);
      const confidence = this.calculateConfidence(response.choices[0], generatedContent);
      const reasoning = this.extractReasoningFromResponse(generatedContent);

      const result: NLQuery = {
        generatedKQL: kqlQuery,
        confidence,
        reasoning,
      };

      logger.debug(`KQL query regenerated successfully: ${kqlQuery}`);
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
      throw new Error('OpenAI client not initialized');
    }

    try {
      const response = await this.openAIClient.chat.completions.create({
        model: this.config.model || 'gpt-4o-mini',
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

  /**
   * Analyze query results using AI
   */
  async analyzeQueryResult(request: QueryAnalysisRequest): Promise<QueryAnalysisResult> {
    await this.initialize();

    if (!this.openAIClient) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      logger.debug(`Starting ${request.analysisType} analysis with OpenAI`);

      const result: QueryAnalysisResult = {};

      switch (request.analysisType) {
        case 'patterns':
          result.patterns = await this.performPatternAnalysis(request);
          break;

        case 'anomalies':
          const patterns = await this.performPatternAnalysis(request);
          // Filter to focus on anomalies
          result.patterns = {
            trends: [],
            anomalies: patterns?.anomalies || [],
            correlations: []
          };
          break;

        case 'insights':
          result.insights = await this.generateContextualInsights(request);
          result.aiInsights = await this.generateAIInsights(request);
          break;

        case 'full':
          result.patterns = await this.performPatternAnalysis(request);
          result.insights = await this.generateContextualInsights(request);
          result.aiInsights = await this.generateAIInsights(request);
          break;
      }

      // Always generate recommendations and follow-up queries for non-statistical analysis
      result.recommendations = await this.generateRecommendations(request);
      result.followUpQueries = await this.generateFollowUpQueries(request);

      logger.debug(`${request.analysisType} analysis completed successfully`);
      return result;

    } catch (error) {
      logger.error('Analysis failed:', error);
      throw new Error(`Analysis failed: ${error}`);
    }
  }

  /**
   * Perform pattern analysis using AI
   */
  private async performPatternAnalysis(request: QueryAnalysisRequest): Promise<QueryAnalysisResult['patterns']> {
    try {
      const prompt = buildPatternAnalysisPrompt(request.result, request.originalQuery);
      const response = await this.generateResponse(prompt);

      // Parse AI response into structured format
      return this.parsePatternAnalysisResponse(response);
    } catch (error) {
      logger.warn('Pattern analysis failed, returning basic analysis:', error);
      return {
        trends: [],
        anomalies: [],
        correlations: []
      };
    }
  }

  /**
   * Generate contextual insights
   */
  private async generateContextualInsights(request: QueryAnalysisRequest): Promise<QueryAnalysisResult['insights']> {
    // Basic data quality assessment
    const firstTable = request.result.tables?.[0];
    if (!firstTable) {
      return {
        dataQuality: {
          completeness: 0,
          consistency: ['No data available'],
          recommendations: ['Verify query criteria and data source']
        },
        businessInsights: {
          keyFindings: [],
          potentialIssues: ['No data returned'],
          opportunities: []
        },
        followUpQueries: []
      };
    }

    const totalRows = firstTable.rows?.length || 0;
    const totalColumns = firstTable.columns?.length || 0;

    // Calculate completeness
    let nullCount = 0;
    if (firstTable.rows && firstTable.columns) {
      firstTable.rows.forEach((row: unknown[]) => {
        row.forEach(cell => {
          if (cell === null || cell === undefined || cell === '') {
            nullCount++;
          }
        });
      });
    }

    const totalCells = totalRows * totalColumns;
    const completeness = totalCells > 0 ? ((totalCells - nullCount) / totalCells) * 100 : 0;

    const consistency: string[] = [];
    const recommendations: string[] = [];

    // Basic consistency checks
    if (completeness < 80) {
      consistency.push('High percentage of null values detected');
      recommendations.push('Consider filtering out incomplete records');
    }

    return {
      dataQuality: {
        completeness: Number(completeness.toFixed(1)),
        consistency,
        recommendations
      },
      businessInsights: {
        keyFindings: [],
        potentialIssues: [],
        opportunities: []
      },
      followUpQueries: []
    };
  }

  /**
   * Generate AI-powered insights
   */
  private async generateAIInsights(request: QueryAnalysisRequest): Promise<string> {
    try {
      const prompt = buildInsightsPrompt(request.result, request.originalQuery, request.options?.language);
      return await this.generateResponse(prompt);
    } catch (error) {
      logger.warn('AI insights generation failed:', error);
      return 'AI insights temporarily unavailable. Please try again later.';
    }
  }

  /**
   * Generate recommendations based on analysis
   */
  private async generateRecommendations(request: QueryAnalysisRequest): Promise<string[]> {
    const recommendations: string[] = [];
    const firstTable = request.result.tables?.[0];

    if (!firstTable || !firstTable.rows) {
      recommendations.push('No data returned - consider adjusting your query criteria');
      return recommendations;
    }

    const totalRows = firstTable.rows.length;

    if (totalRows === 0) {
      recommendations.push('No data returned - consider adjusting your query criteria');
    } else if (totalRows > 10000) {
      recommendations.push('Large dataset returned - consider adding filters to improve performance');
    }

    return recommendations;
  }

  /**
   * Generate follow-up queries
   */
  private async generateFollowUpQueries(request: QueryAnalysisRequest): Promise<QueryAnalysisResult['followUpQueries']> {
    const queries = [];
    const firstTable = request.result.tables?.[0];

    if (!firstTable || !firstTable.rows) {
      return [];
    }

    // Basic follow-up query suggestions
    if (firstTable.rows.length > 0) {
      queries.push({
        query: `${request.originalQuery} | limit 10`,
        purpose: 'View sample results',
        priority: 'low' as const
      });
    }

    // Check if there are datetime columns for temporal analysis
    const hasDateTimeColumn = firstTable.columns?.some((col: { name: string; type: string }) =>
      col.type?.includes('datetime') || col.name?.toLowerCase().includes('time')
    );

    if (hasDateTimeColumn) {
      queries.push({
        query: `${request.originalQuery} | summarize count() by bin(timestamp, 1h)`,
        purpose: 'Analyze temporal distribution',
        priority: 'medium' as const
      });
    }

    return queries;
  }

  private parsePatternAnalysisResponse(response: string): QueryAnalysisResult['patterns'] {
    try {
      const jsonContent = this.extractJSONFromResponse(response);
      const parsed = JSON.parse(jsonContent);
      return {
        trends: parsed.trends || [],
        anomalies: parsed.anomalies || [],
        correlations: parsed.correlations || []
      };
    } catch (error) {
      logger.warn('Failed to parse pattern analysis response:', error);
      return {
        trends: [],
        anomalies: [],
        correlations: []
      };
    }
  }

  /**
   * Extract JSON content from markdown code blocks or raw response
   */
  private extractJSONFromResponse(response: string): string {
    // Extract JSON from code blocks (```json ... ```)
    const codeBlockMatch = response.match(/```(?:json)?\n?(.*?)\n?```/s);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // If no code blocks, return the raw response cleaned up
    return response
      .replace(/^(Here's the JSON:|JSON:|Response:)/i, '')
      .trim();
  }

  // Protected helper methods for inheritance
  protected extractKQLFromResponse(content: string): string {
    // First try to extract JSON from markdown code blocks
    try {
      const jsonContent = this.extractJSONFromResponse(content);
      const parsed = JSON.parse(jsonContent);
      if (parsed.kql) {
        return parsed.kql;
      }
    } catch {
      // Continue to other extraction methods
    }

    // Try direct JSON parsing (for responses without markdown)
    try {
      const parsed = JSON.parse(content);
      return parsed.kql || content;
    } catch {
      // Fallback: try to extract KQL from code blocks
      const kqlMatch = content.match(/```(?:kql|kusto)?\s*([\s\S]*?)```/i);
      if (kqlMatch) {
        return kqlMatch[1].trim();
      }

      // Last resort: return content as-is
      return content.trim();
    }
  }

  protected calculateConfidence(choice: OpenAIChoice, content?: string): number {
    // Base confidence calculation on finish_reason and other factors
    let confidence = 0.7; // Default confidence

    if (choice.finish_reason === 'stop') {
      confidence = 0.85;
    } else if (choice.finish_reason === 'length') {
      confidence = 0.6; // Lower confidence if truncated
    }

    // Reduce confidence for non-JSON responses
    if (content && !this.isJsonResponse(content)) {
      confidence = 0.5; // Lower confidence for non-JSON responses
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  protected extractReasoningFromResponse(content: string): string {
    // First try to extract JSON from markdown code blocks
    try {
      const jsonContent = this.extractJSONFromResponse(content);
      const parsed = JSON.parse(jsonContent);
      return parsed.reasoning || 'Generated by OpenAI';
    } catch {
      // Try direct JSON parsing (for responses without markdown)
      try {
        const parsed = JSON.parse(content);
        return parsed.reasoning || 'Generated by OpenAI';
      } catch {
        return 'Generated by OpenAI (non-JSON response)';
      }
    }
  }

  private isJsonResponse(content: string): boolean {
    // First try to extract JSON from markdown code blocks
    try {
      const jsonContent = this.extractJSONFromResponse(content);
      JSON.parse(jsonContent);
      return true;
    } catch {
      // Try direct JSON parsing (for responses without markdown)
      try {
        JSON.parse(content);
        return true;
      } catch {
        return false;
      }
    }
  }
}
