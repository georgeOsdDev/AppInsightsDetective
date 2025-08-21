import inquirer from 'inquirer';
import chalk from 'chalk';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { logger } from '../utils/logger';
import { Visualizer } from '../utils/visualizer';
import { ConfigManager } from '../utils/config';
import { AIService } from './aiService';
import { AppInsightsService } from './appInsightsService';
import { ExternalExecutionService } from './externalExecutionService';
import { NLQuery, QueryResult, SupportedLanguage, ExplanationOptions, AzureResourceInfo } from '../types';

export interface StepExecutionOptions {
  showConfidenceThreshold?: number;
  allowEditing?: boolean;
  maxRegenerationAttempts?: number;
}

export interface QueryAction {
  action: 'execute' | 'explain' | 'regenerate' | 'edit' | 'history' | 'external' | 'portal' | 'cancel';
  modifiedQuery?: string;
  originalQuestion?: string;
}

export class StepExecutionService {
  private queryHistory: string[] = [];
  private detailedHistory: Array<{
    query: string;
    timestamp: Date;
    confidence: number;
    action: 'generated' | 'edited' | 'regenerated';
    reason?: string;
  }> = [];
  private currentAttempt: number = 0;
  private externalExecutionService: ExternalExecutionService | null = null;

  constructor(
    private aiService: AIService,
    private appInsightsService: AppInsightsService,
    private options: StepExecutionOptions = {}
  ) {
    this.options = {
      showConfidenceThreshold: 0.7,
      allowEditing: true,
      maxRegenerationAttempts: 3,
      ...options
    };

    // Initialize external execution service asynchronously
    this.initializeExternalExecutionService().catch(error => {
      logger.warn('Failed to initialize external execution service during construction:', error);
    });
  }

  /**
   * Initialize external execution service with Azure resource configuration
   */
  private async initializeExternalExecutionService(): Promise<void> {
    try {
      const configManager = new ConfigManager();
      const config = await configManager.getEnhancedConfig(); // Use enhanced config
      const appInsights = config.appInsights;

      // Check if required Azure resource information is available
      if (appInsights.tenantId && appInsights.subscriptionId && 
          appInsights.resourceGroup && appInsights.resourceName) {
        
        const azureResourceInfo: AzureResourceInfo = {
          tenantId: appInsights.tenantId,
          subscriptionId: appInsights.subscriptionId,
          resourceGroup: appInsights.resourceGroup,
          resourceName: appInsights.resourceName
        };

        this.externalExecutionService = new ExternalExecutionService(azureResourceInfo);
        logger.debug('External execution service initialized with auto-discovered resource information');
      } else {
        logger.debug('External execution service not initialized - missing Azure resource configuration');
      }
    } catch (error) {
      logger.warn('Failed to initialize external execution service:', error);
    }
  }

  /**
   * Start step execution for generated KQL query
   */
  async executeStepByStep(nlQuery: NLQuery, originalQuestion: string): Promise<{ result: QueryResult; executionTime: number } | null> {
    this.queryHistory = [nlQuery.generatedKQL];
    this.detailedHistory = [{
      query: nlQuery.generatedKQL,
      timestamp: new Date(),
      confidence: nlQuery.confidence,
      action: 'generated'
    }];
    this.currentAttempt = 1;

    console.log(chalk.blue.bold('\n🔍 Generated KQL Query Review'));
    console.log(chalk.dim('='.repeat(50)));

    while (true) {
      // Display query
      this.displayQuerySummary(nlQuery, originalQuestion);

      // Get user action
      const action = await this.getUserAction(nlQuery);

      switch (action.action) {
        case 'execute':
          return await this.executeQuery(nlQuery.generatedKQL);

        case 'explain':
          await this.explainQuery(nlQuery);
          continue;

        case 'portal':
          await this.handlePortalExecution(nlQuery);
          continue;

        case 'external':
          await this.handleExternalExecution(nlQuery);
          continue;

        case 'regenerate':
          const newQuery = await this.regenerateQuery(originalQuestion, nlQuery);
          if (newQuery) {
            nlQuery = newQuery;
            continue;
          } else {
            Visualizer.displayError('Failed to regenerate query. Please try a different approach.');
            continue;
          }

        case 'edit':
          const editedQuery = await this.editQuery(nlQuery.generatedKQL);
          if (editedQuery) {
            nlQuery = {
              generatedKQL: editedQuery,
              confidence: 0.5, // Edited queries have moderate confidence
              reasoning: 'Manually edited query'
            };
            this.queryHistory.push(editedQuery);
            this.detailedHistory.push({
              query: editedQuery,
              timestamp: new Date(),
              confidence: 0.5,
              action: 'edited',
              reason: 'Manual user edit'
            });
            continue;
          } else {
            continue;
          }

        case 'history':
          const selectedQuery = await this.showQueryHistory();
          if (selectedQuery) {
            nlQuery = {
              generatedKQL: selectedQuery,
              confidence: 0.8, // Historical queries have high confidence
              reasoning: 'Selected from query history'
            };
            continue;
          } else {
            continue;
          }

        case 'cancel':
          Visualizer.displayInfo('Query execution cancelled.');
          return null;
      }
    }
  }

  /**
   * Display query summary
   */
  private displayQuerySummary(nlQuery: NLQuery, originalQuestion: string): void {
    console.log(chalk.cyan.bold('\n📝 Original Question:'));
    console.log(chalk.white(`  "${originalQuestion}"`));

    Visualizer.displayKQLQuery(nlQuery.generatedKQL, nlQuery.confidence);

    if (nlQuery.reasoning) {
      console.log(chalk.cyan.bold('\n💭 AI Reasoning:'));
      console.log(chalk.dim(`  ${nlQuery.reasoning}`));
    }

    // Confidence-based recommended action
    if (nlQuery.confidence < (this.options.showConfidenceThreshold || 0.7)) {
      console.log(chalk.yellow.bold('\n⚠️  Low Confidence Warning:'));
      console.log(chalk.yellow('  This query has low confidence. Consider reviewing or regenerating it.'));
    }

    // Query history
    if (this.queryHistory.length > 1) {
      console.log(chalk.cyan.bold(`\n📜 Query History (${this.queryHistory.length} versions):`));
      console.log(chalk.dim('  Use ↑/↓ to see previous versions if needed.'));
    }
  }

  /**
   * Get user action
   */
  private async getUserAction(_nlQuery: NLQuery): Promise<QueryAction> {
    const choices = [
      {
        name: '🚀 Execute Query - Run this KQL query against Application Insights',
        value: 'execute',
        short: 'Execute'
      },
      {
        name: '📖 Explain Query - Get detailed explanation of what this query does',
        value: 'explain',
        short: 'Explain'
      }
    ];

    // Ensure external execution service is initialized before checking availability
    if (!this.externalExecutionService) {
      try {
        await this.initializeExternalExecutionService();
      } catch (error) {
        logger.debug('Failed to initialize external execution service in getUserAction:', error);
      }
    }

    // Add Azure Portal option if service is available
    if (this.externalExecutionService) {
      const validation = this.externalExecutionService.validateConfiguration();
      if (validation.isValid) {
        choices.push({
          name: '🌐 Open in Azure Portal - Execute query in Azure Portal with full visualization capabilities',
          value: 'portal',
          short: 'Portal'
        });
      }
    }

    // Check regeneration limit
    if (this.currentAttempt < (this.options.maxRegenerationAttempts || 3)) {
      choices.push({
        name: '🔄 Regenerate Query - Ask AI to create a different query approach',
        value: 'regenerate',
        short: 'Regenerate'
      });
    }

    // Edit option
    if (this.options.allowEditing) {
      choices.push({
        name: '✏️  Edit Query - Manually modify the KQL query',
        value: 'edit',
        short: 'Edit'
      });
    }

    // Show history option (when 2+ history items exist)
    if (this.queryHistory.length > 1) {
      choices.push({
        name: '📜 View History - Browse and select from query history',
        value: 'history',
        short: 'History'
      });
    }

    choices.push({
      name: '❌ Cancel - Stop query execution',
      value: 'cancel',
      short: 'Cancel'
    });

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do with this query?',
        choices: choices,
        pageSize: 10
      }
    ]);

    return { action };
  }

  /**
   * クエリの詳細解説を表示
   */
  private async explainQuery(nlQuery: NLQuery): Promise<void> {
    try {
      // Language selection prompt
      const languageOptions = this.getLanguageOptions();
      const { selectedLanguage, technicalLevel, includeExamples } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedLanguage',
          message: 'Select explanation language:',
          choices: languageOptions,
          default: 'auto'
        },
        {
          type: 'list',
          name: 'technicalLevel',
          message: 'Select technical level:',
          choices: [
            { name: '🟢 Beginner - Simple explanations with basic concepts', value: 'beginner' },
            { name: '🟡 Intermediate - Balanced technical explanations', value: 'intermediate' },
            { name: '🔴 Advanced - Detailed technical insights', value: 'advanced' }
          ],
          default: 'intermediate'
        },
        {
          type: 'confirm',
          name: 'includeExamples',
          message: 'Include practical examples?',
          default: true
        }
      ]);

      const explanationOptions: ExplanationOptions = {
        language: selectedLanguage,
        technicalLevel,
        includeExamples
      };

      Visualizer.displayInfo(`Generating detailed query explanation in ${this.getLanguageName(selectedLanguage)}...`);

      const explanation = await this.aiService.explainKQLQuery(nlQuery.generatedKQL, explanationOptions);

      console.log(chalk.green.bold('\n📚 Query Explanation:'));
      console.log(chalk.dim('='.repeat(50)));
      console.log(chalk.white(explanation));
      console.log(chalk.dim('='.repeat(50)));

      // Continuation confirmation
      await inquirer.prompt([
        {
          type: 'input',
          name: 'continue',
          message: 'Press Enter to continue...',
        }
      ]);

    } catch (error) {
      logger.error('Failed to explain query:', error);
      Visualizer.displayError(`Failed to generate explanation: ${error}`);
    }
  }

  /**
   * 言語選択オプションを取得
   */
  private getLanguageOptions() {
    return [
      { name: '🌐 Auto - Detect best language', value: 'auto' },
      { name: '🇺🇸 English', value: 'en' },
      { name: '🇯🇵 Japanese (日本語)', value: 'ja' },
      { name: '🇰🇷 Korean (한국어)', value: 'ko' },
      { name: '🇨🇳 Chinese Simplified (简体中文)', value: 'zh' },
      { name: '🇹🇼 Chinese Traditional (繁體中文)', value: 'zh-TW' },
      { name: '🇪🇸 Spanish (Español)', value: 'es' },
      { name: '🇫🇷 French (Français)', value: 'fr' },
      { name: '🇩🇪 German (Deutsch)', value: 'de' },
      { name: '🇮🇹 Italian (Italiano)', value: 'it' },
      { name: '🇵🇹 Portuguese (Português)', value: 'pt' },
      { name: '🇷🇺 Russian (Русский)', value: 'ru' },
      { name: '🇸🇦 Arabic (العربية)', value: 'ar' }
    ];
  }

  /**
   * 言語コードから言語名を取得
   */
  private getLanguageName(languageCode: SupportedLanguage): string {
    const languageMap: Record<SupportedLanguage, string> = {
      'auto': 'Auto-detect',
      'en': 'English',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese (Simplified)',
      'zh-TW': 'Chinese (Traditional)',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ar': 'Arabic'
    };
    return languageMap[languageCode] || 'Unknown';
  }

  /**
   * クエリを再生成
   */
  private async regenerateQuery(originalQuestion: string, previousQuery: NLQuery): Promise<NLQuery | null> {
    try {
      this.currentAttempt++;
      Visualizer.displayInfo(`Regenerating query (attempt ${this.currentAttempt})...`);

      // Context for analyzing previous query issues
      const regenerationContext = {
        previousQuery: previousQuery.generatedKQL,
        previousReasoning: previousQuery.reasoning,
        attemptNumber: this.currentAttempt
      };

      const schema = await this.appInsightsService.getSchema();
      const newQuery = await this.aiService.regenerateKQLQuery(
        originalQuestion,
        regenerationContext,
        schema
      );

      if (newQuery) {
        this.queryHistory.push(newQuery.generatedKQL);
        this.detailedHistory.push({
          query: newQuery.generatedKQL,
          timestamp: new Date(),
          confidence: newQuery.confidence,
          action: 'regenerated',
          reason: `Regeneration attempt ${this.currentAttempt}`
        });
        Visualizer.displaySuccess('New query generated successfully!');
        return newQuery;
      }

      return null;
    } catch (error) {
      logger.error('Failed to regenerate query:', error);
      Visualizer.displayError(`Failed to regenerate query: ${error}`);
      return null;
    }
  }

  /**
   * クエリをマニュアル編集
   */
  private async editQuery(currentQuery: string): Promise<string | null> {
    try {
      // Create temporary file
      const tempFile = join(tmpdir(), `aidx-query-${Date.now()}.kql`);
      writeFileSync(tempFile, currentQuery, 'utf8');

      console.log(chalk.yellow.bold('\n✏️  Manual Query Editor'));
      console.log(chalk.dim(`Temporary file: ${tempFile}`));
      console.log(chalk.dim('The query will open in your default editor. Save and close to continue.'));

      // Select edit method
      const { editMethod } = await inquirer.prompt([
        {
          type: 'list',
          name: 'editMethod',
          message: 'How would you like to edit the query?',
          choices: [
            { name: 'Open in default editor (nano/vim)', value: 'editor' },
            { name: 'Edit inline in terminal', value: 'inline' },
            { name: 'Cancel editing', value: 'cancel' }
          ]
        }
      ]);

      if (editMethod === 'cancel') {
        unlinkSync(tempFile);
        return null;
      }

      let editedQuery: string;

      if (editMethod === 'editor') {
        // デフォルトエディタで開く
        const editor = process.env.EDITOR || 'nano';
        try {
          execSync(`${editor} "${tempFile}"`, { stdio: 'inherit' });
          editedQuery = readFileSync(tempFile, 'utf8').trim();
        } catch (error) {
          Visualizer.displayError(`Editor failed: ${error}`);
          unlinkSync(tempFile);
          return null;
        }
      } else {
        // インラインエディタ
        const { query } = await inquirer.prompt([
          {
            type: 'editor',
            name: 'query',
            message: 'Edit the KQL query:',
            default: currentQuery
          }
        ]);
        editedQuery = query.trim();
      }

      // 一時ファイルを削除
      unlinkSync(tempFile);

      if (editedQuery === currentQuery) {
        Visualizer.displayInfo('No changes made to the query.');
        return null;
      }

      if (!editedQuery) {
        Visualizer.displayError('Empty query is not allowed.');
        return null;
      }

      Visualizer.displaySuccess('Query edited successfully!');
      return editedQuery;

    } catch (error) {
      logger.error('Failed to edit query:', error);
      Visualizer.displayError(`Failed to edit query: ${error}`);
      return null;
    }
  }

  /**
   * クエリを実行
   */
  private async executeQuery(query: string): Promise<{ result: QueryResult; executionTime: number }> {
    try {
      Visualizer.displayInfo('Executing query...');
      
      const startTime = Date.now();
      const result = await this.appInsightsService.executeQuery(query);
      const executionTime = Date.now() - startTime;
      
      Visualizer.displaySuccess('Query executed successfully!');
      return { result, executionTime };
    } catch (error) {
      logger.error('Query execution failed:', error);
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  /**
   * クエリ履歴を取得
   */
  getQueryHistory(): string[] {
    return [...this.queryHistory];
  }

  /**
   * 現在の試行回数を取得
   */
  getCurrentAttempt(): number {
    return this.currentAttempt;
  }

  /**
   * クエリ履歴を表示して選択させる
   */
  private async showQueryHistory(): Promise<string | null> {
    if (this.detailedHistory.length === 0) {
      Visualizer.displayInfo('No query history available.');
      return null;
    }

    console.log(chalk.blue.bold('\n📜 Query History'));
    console.log(chalk.dim('='.repeat(60)));

    // 履歴を逆順（最新から古い順）で表示
    const historyChoices = this.detailedHistory
      .slice()
      .reverse()
      .map((item, index) => {
        const timeAgo = this.getTimeAgo(item.timestamp);
        const actionIcon = this.getActionIcon(item.action);
        const confidenceColor = item.confidence >= 0.8 ? chalk.green :
                               item.confidence >= 0.5 ? chalk.yellow :
                               chalk.red;

        return {
          name: `${actionIcon} ${confidenceColor(`${Math.round(item.confidence * 100)}%`)} - ${timeAgo}${item.reason ? ` (${item.reason})` : ''}
${chalk.dim('    ' + this.truncateQuery(item.query, 80))}`,
          value: item.query,
          short: `Query ${this.detailedHistory.length - index}`
        };
      });

    // 戻るオプションを追加
    historyChoices.push({
      name: chalk.cyan('🔙 Back to query actions'),
      value: '__BACK__', // nullの代わりに特別な文字列を使用
      short: 'Back'
    });

    const { selectedQuery } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedQuery',
        message: 'Select a query from history:',
        choices: historyChoices,
        pageSize: 8
      }
    ]);

    // 特別な値の場合はnullを返す
    if (selectedQuery === '__BACK__') {
      return null;
    }

    if (selectedQuery) {
      console.log(chalk.green('\n✅ Query selected from history'));
      console.log(chalk.dim('Selected query:'));
      Visualizer.displayKQLQuery(selectedQuery, 0.8);
    }

    return selectedQuery;
  }

  /**
   * アクションに対応するアイコンを取得
   */
  private getActionIcon(action: string): string {
    const icons: Record<string, string> = {
      generated: '🤖',
      edited: '✏️',
      regenerated: '🔄'
    };
    return icons[action] || '📝';
  }

  /**
   * 経過時間を人間が読みやすい形式で取得
   */
  private getTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`;
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    }
  }

  /**
   * クエリを指定された長さに切り詰める
   */
  private truncateQuery(query: string, maxLength: number): string {
    // 改行を削除してスペースで置き換え
    const cleanQuery = query.replace(/\s+/g, ' ').trim();

    if (cleanQuery.length <= maxLength) {
      return cleanQuery;
    }

    return cleanQuery.substring(0, maxLength - 3) + '...';
  }

  /**
   * Handle external execution workflow
   */
  private async handleExternalExecution(nlQuery: NLQuery): Promise<void> {
    if (!this.externalExecutionService) {
      Visualizer.displayError('External execution is not available. Please configure Azure resource information.');
      return;
    }

    const validation = this.externalExecutionService.validateConfiguration();
    if (!validation.isValid) {
      Visualizer.displayError(`External execution configuration is incomplete. Missing: ${validation.missingFields.join(', ')}`);
      return;
    }

    try {
      console.log(chalk.blue.bold('\n🌐 External Query Execution'));
      console.log(chalk.dim('='.repeat(50)));

      const availableOptions = this.externalExecutionService.getAvailableOptions();
      
      if (availableOptions.length === 0) {
        Visualizer.displayError('No external execution options are available.');
        return;
      }

      // Create choices for external execution targets
      const choices = availableOptions.map(option => ({
        name: `${option.name} - ${option.description}`,
        value: option.target,
        short: option.target
      }));

      choices.push({
        name: '❌ Cancel - Return to query review',
        value: 'cancel' as any,
        short: 'Cancel' as any
      });

      const { target } = await inquirer.prompt([
        {
          type: 'list',
          name: 'target',
          message: 'Select external execution target:',
          choices: choices,
          pageSize: 8
        }
      ]) as { target: string };

      if (target === 'cancel') {
        return;
      }

      // Execute in selected external tool
      console.log(chalk.cyan('\n🔗 Generated URLs:'));
      const result = await this.externalExecutionService.executeExternal(target as any, nlQuery.generatedKQL, true);

      if (result.launched) {
        console.log(chalk.green(`\n✅ Successfully opened query in ${target === 'portal' ? 'Azure Portal' : 'Azure Data Explorer'}`));
        console.log(chalk.dim('The query has been opened in your default browser.'));
        console.log(chalk.dim('You can now explore the results using the full capabilities of the Azure tools.'));
      } else {
        Visualizer.displayError(`Failed to open external tool: ${result.error}`);
        console.log(chalk.cyan('\n💡 You can manually copy and paste the URL above to access the query.'));
      }

      // Add a pause before continuing
      await inquirer.prompt([
        {
          type: 'input',
          name: 'continue',
          message: 'Press Enter to continue...',
          default: ''
        }
      ]);

    } catch (error) {
      logger.error('External execution failed:', error);
      Visualizer.displayError(`External execution failed: ${error}`);
    }
  }

  /**
   * Handle direct portal execution workflow
   */
  private async handlePortalExecution(nlQuery: NLQuery): Promise<void> {
    if (!this.externalExecutionService) {
      Visualizer.displayError('Azure Portal execution is not available. Please configure Azure resource information.');
      return;
    }

    const validation = this.externalExecutionService.validateConfiguration();
    if (!validation.isValid) {
      Visualizer.displayError(`Azure Portal execution configuration is incomplete. Missing: ${validation.missingFields.join(', ')}`);
      return;
    }

    try {
      console.log(chalk.blue.bold('\n🌐 Opening Query in Azure Portal'));
      console.log(chalk.dim('='.repeat(50)));

      // Execute directly in Azure Portal
      const result = await this.externalExecutionService.executeExternal('portal', nlQuery.generatedKQL, true);

      if (result.launched) {
        console.log(chalk.green('\n✅ Successfully opened query in Azure Portal'));
        console.log(chalk.dim('The query has been opened in your default browser.'));
        console.log(chalk.dim('You can now explore the results using the full capabilities of Azure Portal.'));
      } else {
        Visualizer.displayError(`Failed to open Azure Portal: ${result.error}`);
        console.log(chalk.cyan('\n💡 You can manually copy and paste the URL above to access the query.'));
      }

      // Add a pause before continuing
      const inquirer = await import('inquirer');
      await inquirer.default.prompt([
        {
          type: 'input',
          name: 'continue',
          message: 'Press Enter to continue...',
          default: ''
        }
      ]);

    } catch (error) {
      logger.error('Portal execution failed:', error);
      Visualizer.displayError(`Portal execution failed: ${error}`);
    }
  }
}
