import OpenAI from 'openai';
import { DefaultAzureCredential } from '@azure/identity';
import { AuthService } from './authService';
import { ConfigManager } from '../utils/config';
import { NaturalLanguageQuery } from '../types';
import { logger } from '../utils/logger';

export class AIService {
  private openAIClient: OpenAI | null = null;
  private authService: AuthService;
  private configManager: ConfigManager;

  constructor(authService: AuthService, configManager: ConfigManager) {
    this.authService = authService;
    this.configManager = configManager;
    this.initializeOpenAI();
  }

  private async initializeOpenAI(): Promise<void> {
    try {
      const config = this.configManager.getConfig();

      if (config.openAI.apiKey) {
        // API Key認証
        this.openAIClient = new OpenAI({
          apiKey: config.openAI.apiKey,
          baseURL: `${config.openAI.endpoint}/openai/deployments/${config.openAI.deploymentName}`,
          defaultQuery: { 'api-version': '2024-02-15-preview' },
          defaultHeaders: {
            'api-key': config.openAI.apiKey,
          },
        });
      } else {
        // Managed Identity認証（簡略化）
        const credential = new DefaultAzureCredential();
        const tokenResponse = await credential.getToken(['https://cognitiveservices.azure.com/.default']);

        this.openAIClient = new OpenAI({
          apiKey: tokenResponse.token,
          baseURL: `${config.openAI.endpoint}/openai/deployments/${config.openAI.deploymentName}`,
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

  public async generateKQLQuery(naturalLanguageQuery: string, schema?: any): Promise<NaturalLanguageQuery> {
    if (!this.openAIClient) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const config = this.configManager.getConfig();
      const systemPrompt = this.buildSystemPrompt(schema);
      const userPrompt = this.buildUserPrompt(naturalLanguageQuery);

      logger.info(`Generating KQL query for: "${naturalLanguageQuery}"`);

      const response = await this.openAIClient.chat.completions.create({
        model: config.openAI.deploymentName || 'gpt-4',
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

      const result: NaturalLanguageQuery = {
        userInput: naturalLanguageQuery,
        generatedKQL: kqlQuery,
        confidence,
        timestamp: new Date(),
      };

      logger.info(`KQL query generated successfully: ${kqlQuery}`);
      return result;
    } catch (error) {
      logger.error('Failed to generate KQL query:', error);
      throw new Error(`KQL generation failed: ${error}`);
    }
  }

  private buildSystemPrompt(schema?: any): string {
    let prompt = `You are an expert in Azure Application Insights KQL (Kusto Query Language).
Your task is to convert natural language queries into valid KQL queries for Application Insights.

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
- availabilityResults: Availability test results`;

    if (schema) {
      prompt += `\n\nAvailable schema information:\n${JSON.stringify(schema, null, 2)}`;
    }

    return prompt;
  }

  private buildUserPrompt(naturalLanguageQuery: string): string {
    return `Convert this natural language query to KQL: "${naturalLanguageQuery}"

Respond with only the KQL query, no explanations or additional text.`;
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

  private calculateConfidence(choice: any): number {
    // 簡単な信頼度計算（実際の実装では、より洗練されたロジックを使用）
    if (choice.finish_reason === 'stop') {
      return 0.9;
    } else if (choice.finish_reason === 'length') {
      return 0.6;
    }
    return 0.5;
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
}
