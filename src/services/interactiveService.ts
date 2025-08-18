import inquirer from 'inquirer';
import chalk from 'chalk';
import { AuthService } from './authService';
import { AppInsightsService } from './appInsightsService';
import { AIService } from './aiService';
import { StepExecutionService } from './stepExecutionService';
import { ConfigManager } from '../utils/config';
import { Visualizer } from '../utils/visualizer';
import { logger } from '../utils/logger';
import { QueryResult, SupportedLanguage } from '../types';

export interface InteractiveSessionOptions {
  language?: SupportedLanguage;
  defaultMode?: 'direct' | 'step' | 'raw';
}

export class InteractiveService {
  constructor(
    private authService: AuthService,
    private appInsightsService: AppInsightsService,
    private aiService: AIService,
    private configManager: ConfigManager,
    private options: InteractiveSessionOptions = {}
  ) {}

  /**
   * インタラクティブセッションを開始
   */
  async startSession(): Promise<void> {
    console.log(chalk.blue.bold('\n🔍 AppInsights Detective - Interactive Mode'));
    console.log(chalk.dim('Ask questions about your application in natural language'));
    console.log(chalk.dim('Type "exit" or "quit" to end the session'));

    // AI サービスを事前初期化
    console.log(chalk.dim('\n🤖 Initializing AI services...'));
    try {
      await this.aiService.initialize();
      console.log(chalk.green('✅ AI services ready\n'));
    } catch (error) {
      logger.warn('AI service initialization warning:', error);
      console.log(chalk.yellow('⚠️  AI services initialized with warnings\n'));
    }

    while (true) {
      try {
        // 質問を取得
        const { question } = await inquirer.prompt([
          {
            type: 'input',
            name: 'question',
            message: chalk.cyan('What would you like to know about your application?'),
            validate: (input: string) => {
              if (!input.trim()) {
                return 'Please enter a question';
              }
              if (input.toLowerCase().trim() === 'exit' || input.toLowerCase().trim() === 'quit') {
                return true; // exitコマンドは有効
              }
              return true;
            },
          }
        ]);

        // 終了コマンドのチェック
        if (question.toLowerCase().trim() === 'exit' || question.toLowerCase().trim() === 'quit') {
          console.log(chalk.green('👋 Thanks for using AppInsights Detective!'));
          break;
        }

        // 実行モードを選択
        const executionMode = await this.selectExecutionMode(question);

        // クエリを実行
        await this.executeQuery(question, executionMode);

        // 継続するかを確認
        const { continueSession } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continueSession',
            message: 'Would you like to ask another question?',
            default: true
          }
        ]);

        if (!continueSession) {
          console.log(chalk.green('👋 Thanks for using AppInsights Detective!'));
          break;
        }

        console.log(chalk.dim('\n' + '='.repeat(60) + '\n'));

      } catch (error) {
        logger.error('Interactive session error:', error);
        Visualizer.displayError(`Session error: ${error}`);

        const { retry } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'retry',
            message: 'Would you like to try again?',
            default: true
          }
        ]);

        if (!retry) {
          break;
        }
      }
    }
  }

  /**
   * 実行モードを選択
   */
  private async selectExecutionMode(_question: string): Promise<'direct' | 'step' | 'raw'> {
    const { mode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: 'How would you like to execute this query?',
        choices: [
          {
            name: '🚀 Smart Mode - AI generates and executes KQL automatically',
            value: 'direct',
            short: 'Smart'
          },
          {
            name: '👁️  Review Mode - Step-by-step query review and execution',
            value: 'step',
            short: 'Review'
          },
          {
            name: '⚡ Raw KQL - Execute as raw KQL query (for experts)',
            value: 'raw',
            short: 'Raw'
          }
        ],
        default: this.options.defaultMode || 'step' // デフォルトはレビューモード
      }
    ]);

    return mode;
  }

  /**
   * クエリを実行
   */
  private async executeQuery(question: string, mode: 'direct' | 'step' | 'raw'): Promise<void> {
    const startTime = Date.now();

    try {
      if (mode === 'raw') {
        await this.executeRawQuery(question, startTime);
      } else {
        await this.executeNaturalLanguageQuery(question, mode, startTime);
      }
    } catch (error) {
      logger.error('Query execution failed:', error);
      Visualizer.displayError(`Query failed: ${error}`);
    }
  }

  /**
   * 生のKQLクエリを実行
   */
  private async executeRawQuery(query: string, startTime: number): Promise<void> {
    Visualizer.displayInfo(`Executing raw KQL query: ${query}`);

    const result = await this.appInsightsService.executeQuery(query);
    const executionTime = Date.now() - startTime;

    Visualizer.displayResult(result);
    const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
    Visualizer.displaySummary(executionTime, totalRows);
  }

  /**
   * 自然言語クエリを実行
   */
  private async executeNaturalLanguageQuery(
    question: string,
    mode: 'direct' | 'step',
    startTime: number
  ): Promise<void> {
    Visualizer.displayInfo(`Processing question: "${question}"`);

    // スキーマを取得（オプション）
    let schema;
    try {
      schema = await this.appInsightsService.getSchema();
      logger.debug('Schema retrieved for query generation');
    } catch (_error) {
      logger.warn('Could not retrieve schema, proceeding without it');
    }

    // 言語設定を適用
    if (this.options.language) {
      const config = this.configManager.getConfig();
      config.language = this.options.language;
    }

    // KQLクエリを生成
    const nlQuery = await this.aiService.generateKQLQuery(question, schema);

    // デバッグ情報
    logger.debug(`Generated query with confidence: ${nlQuery.confidence}`);
    logger.debug(`Selected mode: ${mode}`);

    let result: QueryResult | null = null;

    if (mode === 'step' || nlQuery.confidence < 0.7) {
      // ステップ実行モード
      Visualizer.displayInfo('Starting step-by-step query review...');

      const stepExecutionService = new StepExecutionService(
        this.aiService,
        this.appInsightsService,
        {
          showConfidenceThreshold: 0.7,
          allowEditing: true,
          maxRegenerationAttempts: 3
        }
      );

      result = await stepExecutionService.executeStepByStep(nlQuery, question);

      if (result) {
        const executionTime = Date.now() - startTime;
        Visualizer.displayResult(result);
        const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
        Visualizer.displaySummary(executionTime, totalRows);
      }
    } else {
      // 直接実行モード
      Visualizer.displayInfo('Executing query in direct mode...');
      Visualizer.displayKQLQuery(nlQuery.generatedKQL, nlQuery.confidence);

      // クエリを検証
      const validation = await this.aiService.validateQuery(nlQuery.generatedKQL);
      if (!validation.isValid) {
        Visualizer.displayError(`Generated query is invalid: ${validation.error}`);
        return;
      }

      // クエリを実行
      result = await this.appInsightsService.executeQuery(nlQuery.generatedKQL);

      if (result) {
        const executionTime = Date.now() - startTime;
        Visualizer.displayResult(result);
        const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
        Visualizer.displaySummary(executionTime, totalRows);
      }
    }

    // 結果が数値データの場合、簡単なチャートの提案（直接実行モードのみ）
    if (result && mode === 'direct' && result.tables.length > 0 && result.tables[0].rows.length > 1) {
      const firstTable = result.tables[0];
      if (firstTable.columns.length >= 2) {
        const hasNumericData = firstTable.rows.some(row =>
          typeof row[1] === 'number' || !isNaN(Number(row[1]))
        );

        if (hasNumericData) {
          const { showChart } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'showChart',
              message: 'Would you like to see a simple chart of this data?',
              default: false
            }
          ]);

          if (showChart) {
            const chartData = firstTable.rows.slice(0, 10).map(row => ({
              label: row[0],
              value: Number(row[1]) || 0,
            }));
            Visualizer.displayChart(chartData, 'bar');
          }
        }
      }
    }
  }

  /**
   * セッション設定を更新
   */
  async updateSessionSettings(): Promise<void> {
    const { language, defaultMode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'language',
        message: 'Select explanation language:',
        choices: [
          { name: '🌐 Auto - Detect best language', value: 'auto' },
          { name: '🇺🇸 English', value: 'en' },
          { name: '🇯🇵 Japanese (日本語)', value: 'ja' },
          { name: '🇰🇷 Korean (한국어)', value: 'ko' },
          { name: '🇨🇳 Chinese Simplified (简体中文)', value: 'zh' },
          { name: '🇪🇸 Spanish (Español)', value: 'es' },
          { name: '🇫🇷 French (Français)', value: 'fr' },
          { name: '🇩🇪 German (Deutsch)', value: 'de' }
        ],
        default: this.options.language || 'auto'
      },
      {
        type: 'list',
        name: 'defaultMode',
        message: 'Select default execution mode:',
        choices: [
          { name: '👁️  Review Mode (Recommended)', value: 'step' },
          { name: '🚀 Smart Mode', value: 'direct' },
          { name: '⚡ Raw KQL Mode', value: 'raw' }
        ],
        default: this.options.defaultMode || 'step'
      }
    ]);

    this.options.language = language;
    this.options.defaultMode = defaultMode;

    // 設定を永続化（一時的に設定に保存）
    const config = this.configManager.getConfig();
    config.language = language;

    Visualizer.displaySuccess('Session settings updated!');
  }
}
