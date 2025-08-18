import OpenAI from 'openai';
import { DefaultAzureCredential } from '@azure/identity';
import { AuthService } from './authService';
import { ConfigManager } from '../utils/config';
import { NLQuery, RegenerationContext, SupportedLanguage, ExplanationOptions } from '../types';
import { logger } from '../utils/logger';

export class AIService {
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
   * OpenAI クライアントの初期化完了を待つ
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
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

  public async generateKQLQuery(naturalLanguageQuery: string, schema?: any): Promise<NLQuery> {
    // 初期化完了を待つ
    await this.initialize();

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

    try {
      const config = this.configManager.getConfig();
      const language = (options.language || config.language || 'auto') as SupportedLanguage;
      const technicalLevel = options.technicalLevel || 'intermediate';
      const includeExamples = options.includeExamples !== false;

      const systemPrompt = this.buildExplanationSystemPrompt(language, technicalLevel, includeExamples);
      const userPrompt = `Please explain this KQL query in detail:\n\n${kqlQuery}`;

      logger.info(`Generating KQL explanation in language: ${language}`);

      const response = await this.openAIClient.chat.completions.create({
        model: config.openAI.deploymentName || 'gpt-4',
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

      logger.info('KQL explanation generated successfully');
      return explanation;
    } catch (error) {
      logger.error('Failed to generate KQL explanation:', error);
      throw new Error(`KQL explanation failed: ${error}`);
    }
  }

  /**
   * 説明用のシステムプロンプトを構築
   */
  private buildExplanationSystemPrompt(
    language: SupportedLanguage,
    technicalLevel: 'beginner' | 'intermediate' | 'advanced',
    includeExamples: boolean
  ): string {
    const languageInstructions = this.getLanguageInstructions(language);
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
   * 言語固有の指示を取得
   */
  private getLanguageInstructions(language: SupportedLanguage): string {
    switch (language) {
      case 'ja':
        return 'Respond in Japanese (日本語). Use technical terms in Japanese where appropriate, but include English terms in parentheses for clarity.';
      case 'ko':
        return 'Respond in Korean (한국어). Use technical terms in Korean where appropriate, but include English terms in parentheses for clarity.';
      case 'zh':
        return 'Respond in Simplified Chinese (简体中文). Use technical terms in Chinese where appropriate, but include English terms in parentheses for clarity.';
      case 'zh-TW':
        return 'Respond in Traditional Chinese (繁體中文). Use technical terms in Chinese where appropriate, but include English terms in parentheses for clarity.';
      case 'es':
        return 'Respond in Spanish (Español). Use technical terms in Spanish where appropriate, but include English terms in parentheses for clarity.';
      case 'fr':
        return 'Respond in French (Français). Use technical terms in French where appropriate, but include English terms in parentheses for clarity.';
      case 'de':
        return 'Respond in German (Deutsch). Use technical terms in German where appropriate, but include English terms in parentheses for clarity.';
      case 'it':
        return 'Respond in Italian (Italiano). Use technical terms in Italian where appropriate, but include English terms in parentheses for clarity.';
      case 'pt':
        return 'Respond in Portuguese (Português). Use technical terms in Portuguese where appropriate, but include English terms in parentheses for clarity.';
      case 'ru':
        return 'Respond in Russian (Русский). Use technical terms in Russian where appropriate, but include English terms in parentheses for clarity.';
      case 'ar':
        return 'Respond in Arabic (العربية). Use technical terms in Arabic where appropriate, but include English terms in parentheses for clarity.';
      case 'en':
        return 'Respond in English. Use clear and precise technical terminology.';
      case 'auto':
      default:
        return 'Respond in the most appropriate language based on the context. If unclear, use English as the default language.';
    }
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

    try {
      const config = this.configManager.getConfig();
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

      logger.info(`Regenerating KQL query (attempt ${context.attemptNumber})`);

      const response = await this.openAIClient.chat.completions.create({
        model: config.openAI.deploymentName || 'gpt-4',
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

      logger.info(`KQL query regenerated successfully: ${kqlQuery}`);
      return result;
    } catch (error) {
      logger.error('Failed to regenerate KQL query:', error);
      throw new Error(`KQL regeneration failed: ${error}`);
    }
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
