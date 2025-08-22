import OpenAI from 'openai';
import { IAIProvider, QueryGenerationRequest, QueryExplanationRequest, RegenerationRequest } from '../../core/interfaces/IAIProvider';
import { IAuthenticationProvider } from '../../core/interfaces/IAuthenticationProvider';
import { AIProviderConfig } from '../../core/types/ProviderTypes';
import { NLQuery, OpenAIChoice } from '../../types';
import { logger } from '../../utils/logger';
import { getLanguageInstructions } from '../../utils/languageUtils';
import { buildSystemPrompt, buildRegenerationPrompt, buildExplanationSystemPrompt } from './prompts/systemPrompts';

/**
 * OpenAI provider implementation (non-Azure)
 */
export class OpenAIProvider implements IAIProvider {
  private openAIClient: OpenAI | null = null;
  private initializationPromise: Promise<void> | null = null;

  constructor(
    private config: AIProviderConfig,
    private authProvider?: IAuthenticationProvider
  ) {
    if (this.config.type !== 'openai') {
      throw new Error('Invalid provider type for OpenAIProvider');
    }
    this.initializationPromise = this.initializeOpenAI();
  }

  /**
   * Initialize the OpenAI client
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  private async initializeOpenAI(): Promise<void> {
    try {
      if (!this.config.apiKey) {
        throw new Error('OpenAI API key is required');
      }

      // Initialize OpenAI client
      this.openAIClient = new OpenAI({
        apiKey: this.config.apiKey,
      });

      logger.info('OpenAI client initialized successfully');
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
      logger.info('Generating KQL query with OpenAI...');

      const systemPrompt = buildSystemPrompt(request.schema);
      const userPrompt = `Convert this natural language query to KQL: "${request.userInput}"`;

      const response = await this.openAIClient.chat.completions.create({
        model: this.config.model || 'gpt-4',
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
      throw new Error('OpenAI client not initialized');
    }

    try {
      logger.info(`Generating KQL query explanation in language: ${request.options?.language || 'auto'}...`);

      const systemPrompt = buildExplanationSystemPrompt(
        request.options?.language || 'en',
        request.options?.technicalLevel || 'intermediate',
        request.options?.includeExamples !== false
      );

      const userPrompt = `Please explain this KQL query:\n\n${request.query}`;

      const response = await this.openAIClient.chat.completions.create({
        model: this.config.model || 'gpt-4',
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
      logger.info(`Regenerating KQL query (attempt ${request.context.attemptNumber}) with OpenAI...`);

      const systemPrompt = buildSystemPrompt(request.schema);
      const userPrompt = buildRegenerationPrompt(
        request.userInput,
        request.context.previousQuery,
        request.context.attemptNumber
      );

      const response = await this.openAIClient.chat.completions.create({
        model: this.config.model || 'gpt-4',
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
      throw new Error('OpenAI client not initialized');
    }

    try {
      const response = await this.openAIClient.chat.completions.create({
        model: this.config.model || 'gpt-4',
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

  // Private helper methods (similar to AzureOpenAIProvider)
  private extractKQLFromResponse(content: string): string {
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

  private calculateConfidence(choice: OpenAIChoice): number {
    // Base confidence calculation on finish_reason and other factors
    let confidence = 0.7; // Default confidence
    
    if (choice.finish_reason === 'stop') {
      confidence = 0.85;
    } else if (choice.finish_reason === 'length') {
      confidence = 0.6; // Lower confidence if truncated
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  private extractReasoningFromResponse(content: string): string {
    try {
      const parsed = JSON.parse(content);
      return parsed.reasoning || 'Generated by OpenAI';
    } catch {
      return 'Generated by OpenAI (non-JSON response)';
    }
  }

  private isJsonResponse(content: string): boolean {
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }
}