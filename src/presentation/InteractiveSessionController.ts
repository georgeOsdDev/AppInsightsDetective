import inquirer from 'inquirer';
import chalk from 'chalk';
import { 
  IOutputRenderer,
  IQuerySession,
  SessionOptions,
  ITemplateRepository,
  IAIProvider,
  QueryAnalysisResult
} from '../core/interfaces';
import { QueryService, QueryServiceRequest } from '../services/QueryService';
import { SupportedLanguage, OutputFormat, QueryResult, AnalysisResult } from '../types';
import { detectTimeSeriesData } from '../utils/chart';
import { FileOutputManager } from '../utils/fileOutput';
import { OutputFormatter } from '../utils/outputFormatter';
import { Visualizer } from '../utils/visualizer';
import { QueryTemplate } from '../core/interfaces/ITemplateRepository';
import { IQueryEditorService } from '../core/interfaces/IQueryEditorService';
import { ExternalExecutionService } from '../services/externalExecutionService';
import { logger } from '../utils/logger';
import { LoadingIndicator, globalLoadingIndicator } from '../utils/loadingIndicator';
import { promptForExplanationOptions } from '../utils/explanationPrompts';
import { getLanguageName } from '../utils/languageUtils';

/**
 * Options for interactive session controller
 */
export interface InteractiveSessionControllerOptions {
  language?: SupportedLanguage;
  defaultMode?: 'direct' | 'step' | 'raw' | 'template';
  outputFormat?: OutputFormat;
  outputFile?: string;
  prettyJson?: boolean;
  includeHeaders?: boolean;
  encoding?: BufferEncoding;
}

/**
 * Interactive session controller - handles UI/UX for interactive query sessions
 * Separated from business logic (QueryService) for better separation of concerns
 */
export class InteractiveSessionController {
  private currentSession: IQuerySession | null = null;
  private fileOutputManager: FileOutputManager;

  constructor(
    private queryService: QueryService,
    private templateRepository: ITemplateRepository,
    private aiProvider: IAIProvider,
    private outputRenderer: IOutputRenderer,
    private queryEditorService: IQueryEditorService,
    private externalExecutionService: ExternalExecutionService | null,
    private options: InteractiveSessionControllerOptions = {}
  ) {
    this.fileOutputManager = new FileOutputManager();
  }

  /**
   * Set controller options
   */
  setOptions(options: Partial<InteractiveSessionControllerOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Map QueryAnalysisResult to AnalysisResult for backward compatibility
   */
  private mapToAnalysisResult(queryAnalysisResult: QueryAnalysisResult): AnalysisResult {
    return {
      patterns: queryAnalysisResult.patterns ? {
        trends: queryAnalysisResult.patterns.trends || [],
        anomalies: queryAnalysisResult.patterns.anomalies || [],
        correlations: queryAnalysisResult.patterns.correlations || []
      } : undefined,
      insights: queryAnalysisResult.insights ? {
        dataQuality: queryAnalysisResult.insights.dataQuality,
        businessInsights: queryAnalysisResult.insights.businessInsights,
        followUpQueries: queryAnalysisResult.insights.followUpQueries || []
      } : undefined,
      aiInsights: queryAnalysisResult.aiInsights,
      recommendations: queryAnalysisResult.recommendations,
      followUpQueries: queryAnalysisResult.followUpQueries || []
    };
  }

  /**
   * Start interactive session
   */
  async startSession(): Promise<void> {
    console.log(chalk.blue.bold('\n🔍 AppInsights Detective - Interactive Mode 🕵'));
    console.log(chalk.dim('Ask questions about your application in natural language'));
    console.log(chalk.dim('Type "exit" or "quit" to end the session'));

    try {
      // Create session with configured options
      this.currentSession = await this.queryService.createSession({
        language: this.options.language || 'auto',
        defaultMode: this.options.defaultMode || 'step'
      });
      
      console.log(chalk.green('✅ Interactive session initialized successfully'));
      console.log(chalk.dim(`Session ID: ${this.currentSession.sessionId}`));

      // Show initial options
      await this.showSessionOptions();

      // Main interaction loop
      await this.interactionLoop();

    } catch (error) {
      logger.error('Failed to start interactive session:', error);
      console.log(this.outputRenderer.renderError(`Failed to start session: ${error}`).content);
    }
  }

  /**
   * Main interaction loop
   */
  private async interactionLoop(): Promise<void> {
    while (true) {
      try {
        const { input } = await inquirer.prompt([
          {
            type: 'input',
            name: 'input',
            message: '🔍 Ask a question:',
            validate: (input: string) => {
              if (!input.trim()) {
                return 'Please enter a question or command';
              }
              return true;
            }
          }
        ]);

        const trimmedInput = input.trim();

        // Handle special commands
        if (['exit', 'quit', 'q'].includes(trimmedInput.toLowerCase())) {
          await this.endSession();
          break;
        }

        if (['help', 'h'].includes(trimmedInput.toLowerCase())) {
          this.showHelp();
          continue;
        }

        if (['settings', 'config'].includes(trimmedInput.toLowerCase())) {
          await this.updateSettings();
          continue;
        }

        if (['history'].includes(trimmedInput.toLowerCase())) {
          await this.showHistory();
          continue;
        }

        if (['templates'].includes(trimmedInput.toLowerCase())) {
          await this.showTemplates();
          continue;
        }

        // Handle template usage with "use template" command
        if (trimmedInput.toLowerCase().startsWith('use template')) {
          const templateId = trimmedInput.substring('use template'.length).trim();
          if (templateId) {
            await this.useTemplate(templateId);
          } else {
            await this.selectAndUseTemplate();
          }
          continue;
        }

        // Handle query input
        await this.handleQueryInput(trimmedInput);

        // Ask if user wants to continue (like original InteractiveService)
        const shouldContinue = await this.askToContinue();
        if (!shouldContinue) {
          await this.endSession();
          break;
        }

        // Add separator line like original
        console.log(chalk.dim('\n' + '='.repeat(60) + '\n'));

      } catch (error) {
        if ((error as any)?.message === 'User force closed the prompt') {
          console.log(chalk.yellow('\n👋 Session interrupted by user'));
          await this.endSession();
          break;
        }
        
        logger.error('Error in interaction loop:', error);
        console.log(this.outputRenderer.renderError(`An error occurred: ${error}`).content);

        // Ask if user wants to retry (like original InteractiveService)
        const shouldRetry = await this.askToRetry();
        if (!shouldRetry) {
          await this.endSession();
          break;
        }
      }
    }
  }

  /**
   * Handle query input
   */
  private async handleQueryInput(input: string): Promise<void> {
    try {
      if (!this.currentSession) {
        throw new Error('No active session');
      }

      // Determine execution mode
      const mode = await this.getExecutionMode(input);
      
      if (mode === 'step') {
        // Step mode: Generate query first, then show for review
        globalLoadingIndicator.start('Generating KQL query with AI...');
        try {
          const result = await this.queryService.generateQuery({
            userInput: input,
            sessionId: this.currentSession!.sessionId
          });
          globalLoadingIndicator.succeed('Query generated successfully');
          await this.handleStepMode(result.nlQuery, input);
        } catch (error) {
          globalLoadingIndicator.fail('Failed to generate query');
          throw error;
        }
      } else {
        // Direct or raw mode: Execute query immediately
        const loadingMessage = mode === 'raw' ? 'Executing KQL query...' : 'Generating and executing query with AI...';
        globalLoadingIndicator.start(loadingMessage);
        try {
          const result = await this.queryService.executeQuery({
            userInput: input,
            sessionId: this.currentSession!.sessionId,
            mode
          });
          globalLoadingIndicator.succeed('Query executed successfully');
          await this.handleDirectMode(result);
        } catch (error) {
          globalLoadingIndicator.fail('Failed to execute query');
          throw error;
        }
      }

    } catch (error) {
      logger.error('Failed to handle query input:', error);
      console.log(this.outputRenderer.renderError(`Query failed: ${error}`).content);
    }
  }

  /**
   * Handle step mode execution
   */
  private async handleStepMode(nlQuery: any, originalInput: string): Promise<void> {
    console.log(chalk.blue.bold('\n🔍 Generated Query Review'));
    console.log(chalk.dim('='.repeat(50)));

    while (true) {
      // Display query
      const queryOutput = this.outputRenderer.renderQuery(
        nlQuery.generatedKQL, 
        nlQuery.confidence, 
        nlQuery.reasoning
      );
      console.log(queryOutput.content);

      // Get user action
      const action = await this.getUserAction();

      switch (action) {
        case 'execute':
          await this.executeAndShowResults(nlQuery.generatedKQL);
          return;

        case 'explain':
          await this.explainQuery(nlQuery.generatedKQL);
          continue;

        case 'portal':
          const shouldContinue = await this.openInAzurePortal(nlQuery.generatedKQL);
          if (shouldContinue) {
            continue; // Stay in the loop to show action options again
          } else {
            return; // Exit step mode
          }

        case 'regenerate':
          const newQuery = await this.regenerateQuery(originalInput, nlQuery);
          if (newQuery) {
            nlQuery = newQuery;
            continue;
          }
          continue;

        case 'edit':
          const editedQuery = await this.editQuery(nlQuery.generatedKQL);
          if (editedQuery) {
            nlQuery = {
              generatedKQL: editedQuery,
              confidence: 0.5,
              reasoning: 'Manually edited query'
            };
            continue;
          }
          continue;

        case 'history':
          await this.showHistory();
          continue;

        case 'cancel':
          console.log(this.outputRenderer.renderInfo('Query execution cancelled').content);
          return;
      }
    }
  }

  /**
   * Handle direct mode execution
   */
  private async handleDirectMode(result: any): Promise<void> {
    // Display the generated KQL query with confidence score for transparency
    if (result.nlQuery?.generatedKQL && result.nlQuery?.confidence !== undefined) {
      Visualizer.displayKQLQuery(result.nlQuery.generatedKQL, result.nlQuery.confidence);
    }
    
    await this.displayResults(result.result, result.nlQuery?.generatedKQL);
  }

  /**
   * Get execution mode from user
   */
  private async getExecutionMode(input: string): Promise<'direct' | 'step' | 'raw' | 'template'> {
    // Check if it looks like raw KQL
    const looksLikeKQL = /^(requests|dependencies|exceptions|pageViews|traces|customEvents)\s*\|/.test(input.trim());
    
    if (looksLikeKQL) {
      const { useRaw } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useRaw',
          message: 'This looks like KQL. Execute as raw query?',
          default: true
        }
      ]);

      if (useRaw) {
        return 'raw';
      }
    }

    // Always ask user to select execution mode for each query (like original InteractiveService)
    return await this.selectExecutionMode();
  }

  /**
   * Select execution mode for each query (restored from original InteractiveService)
   */
  private async selectExecutionMode(): Promise<'direct' | 'step' | 'raw'> {
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
        default: this.currentSession?.options.defaultMode || 'step' // Default is step mode
      }
    ]);

    return mode;
  }

  /**
   * Get user action for step mode
   */
  private async getUserAction(): Promise<string> {
    const choices = [
      { name: '🚀 Execute Query', value: 'execute' },
      { name: '📖 Explain Query', value: 'explain' },
      { name: '🔄 Regenerate Query', value: 'regenerate' },
      { name: '✏️  Edit Query', value: 'edit' },
      { name: '📜 View History', value: 'history' },
      { name: '❌ Cancel', value: 'cancel' }
    ];

    // Add Azure Portal option if external execution service is available
    if (this.externalExecutionService) {
      const validation = this.externalExecutionService.validateConfiguration();
      if (validation.isValid) {
        choices.splice(5, 0, { name: '🌐 Open in Azure Portal', value: 'portal' });
      }
    }

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do with this query?',
        choices
      }
    ]);

    return action;
  }

  /**
   * Execute query and show results
   */
  private async executeAndShowResults(query: string): Promise<void> {
    try {
      if (!this.currentSession) {
        throw new Error('No active session');
      }

      globalLoadingIndicator.start('Executing KQL query...');
      const result = await this.queryService.executeQuery({
        userInput: query,
        sessionId: this.currentSession!.sessionId,
        mode: 'raw'
      });
      globalLoadingIndicator.succeed('Query executed successfully');

      await this.displayResults(result.result, query);

    } catch (error) {
      globalLoadingIndicator.fail('Failed to execute query');
      console.log(this.outputRenderer.renderError(error as Error).content);
    }
  }

  /**
   * Display query results
   */
  private async displayResults(result: any, query?: string): Promise<void> {
    // Show execution info
    console.log(this.outputRenderer.renderSuccess(
      `Query executed successfully in ${result.executionTime}ms`
    ).content);

    // Render results
    const output = await this.outputRenderer.renderQueryResult(result.result, {
      format: this.options.outputFormat || 'table',
      pretty: this.options.prettyJson,
      includeHeaders: this.options.includeHeaders !== false
    });

    console.log(output.content);

    // Show chart for numeric data (experimental feature)
    await this.showChartIfApplicable(result.result);

    // Handle file output if specified
    if (this.options.outputFile) {
      await this.saveToFile(result.result, query);
    }

    // Offer file save option (restored from original InteractiveService)
    await this.promptForFileSave(result.result, query);

    // Offer analysis with the original query
    await this.offerAnalysis(result.result, query);
  }

  /**
   * Offer comprehensive analysis of results (restored from original InteractiveService)
   */
  private async offerAnalysis(result: QueryResult, originalQuery?: string): Promise<void> {
    if (!result.tables || result.tables.length === 0 || !result.tables[0].rows || result.tables[0].rows.length === 0) {
      return;
    }

    const { wantAnalysis } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'wantAnalysis',
        message: '🧠 Would you like to analyze these results for patterns and insights?',
        default: false
      }
    ]);

    if (!wantAnalysis) {
      return;
    }

    // Show analysis options (restored from original InteractiveService)
    const { analysisType, language } = await inquirer.prompt([
      {
        type: 'list',
        name: 'analysisType',
        message: 'What type of analysis would you like to perform?',
        choices: [
          {
            name: '📈 Statistical Summary - Basic statistics and data distributions',
            value: 'statistical',
            short: 'Stats'
          },
          {
            name: '🔍 Pattern Detection - Identify trends and correlations',
            value: 'patterns',
            short: 'Patterns'
          },
          {
            name: '🚨 Anomaly Detection - Find outliers and unusual data points',
            value: 'anomalies',
            short: 'Anomalies'
          },
          {
            name: '💡 Smart Insights - AI-powered recommendations and insights',
            value: 'insights',
            short: 'Insights'
          },
          {
            name: '📋 Full Analysis Report - Comprehensive analysis of all aspects',
            value: 'full',
            short: 'Full Report'
          }
        ],
        pageSize: 8
      },
      {
        type: 'list',
        name: 'language',
        message: 'Select analysis language:',
        choices: [
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
        ],
        default: this.options.language || 'auto',
        when: (answers) => answers.analysisType !== 'statistical' // Statistical analysis doesn't need AI, so no language selection needed
      }
    ]);

    // Perform analysis
    try {
      globalLoadingIndicator.start('Analyzing query results with AI...');
      const queryAnalysisResult = await this.aiProvider.analyzeQueryResult({
        result,
        originalQuery: originalQuery || 'unknown query',
        analysisType: analysisType as 'patterns' | 'anomalies' | 'insights' | 'full',
        options: { language: language as SupportedLanguage }
      });
      globalLoadingIndicator.succeed('Analysis completed successfully');

      // Map to legacy AnalysisResult format for backward compatibility
      const analysis = this.mapToAnalysisResult(queryAnalysisResult);

      // Display the analysis results
      const analysisOutput = await this.outputRenderer.renderAnalysisResult(analysis, {});
      console.log(analysisOutput.content);

      // Offer to execute follow-up queries if available (restored from original InteractiveService)
      if (analysis.followUpQueries && analysis.followUpQueries.length > 0) {
        await this.promptForFollowUpQuery(analysis.followUpQueries);
      }

    } catch (error) {
      globalLoadingIndicator.fail('Analysis failed');
      logger.error('Analysis failed:', error);
      console.log(this.outputRenderer.renderError(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`).content);
    }
  }

  /**
   * Prompt user for follow-up query execution (restored from original InteractiveService)
   */
  private async promptForFollowUpQuery(followUpQueries: Array<{ query: string; purpose: string; priority: 'high' | 'medium' | 'low' }>): Promise<void> {
    const { executeFollowUp } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'executeFollowUp',
        message: '🔄 Would you like to execute one of the suggested follow-up queries?',
        default: false
      }
    ]);

    if (!executeFollowUp) {
      return;
    }

    const choices = followUpQueries.map((query, index) => {
      const priorityIcon = query.priority === 'high' ? '🔴' : query.priority === 'medium' ? '🟡' : '🔵';
      return {
        name: `${priorityIcon} ${query.purpose}\n    ${chalk.dim(query.query)}`,
        value: query.query,
        short: `Query ${index + 1}`
      };
    });

    choices.push({
      name: chalk.cyan('🔙 Skip - Continue to other options'),
      value: '__SKIP__',
      short: 'Skip'
    });

    const { selectedQuery } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedQuery',
        message: 'Select a follow-up query to execute:',
        choices,
        pageSize: Math.min(followUpQueries.length + 1, 10)
      }
    ]);

    if (selectedQuery !== '__SKIP__') {
      console.log(chalk.dim('\n🔄 Executing follow-up query...'));
      await this.handleQueryInput(selectedQuery);
    }
  }

  /**
   * Show session options
   */
  private async showSessionOptions(): Promise<void> {
    console.log(chalk.cyan.bold('\n⚙️  Current Settings:'));
    console.log(chalk.dim(`Language: ${this.currentSession?.options.language || 'auto'}`));
    console.log(chalk.dim(`Default Mode: ${this.currentSession?.options.defaultMode || 'step'}`));
    console.log(chalk.dim(`Output Format: ${this.options.outputFormat || 'table'}`));
  }

  /**
   * Update session settings
   */
  private async updateSettings(): Promise<void> {
    try {
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
          default: this.currentSession?.options.language || this.options.language || 'auto'
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
          default: this.currentSession?.options.defaultMode || this.options.defaultMode || 'step'
        }
      ]);

      // Update controller options
      this.options.language = language;
      this.options.defaultMode = defaultMode;

      // Update current session if exists
      if (this.currentSession) {
        this.currentSession.options.language = language;
        this.currentSession.options.defaultMode = defaultMode;
      }

      console.log(this.outputRenderer.renderSuccess('Session settings updated!').content);
    } catch (error) {
      logger.error('Failed to update settings:', error);
      console.log(this.outputRenderer.renderError('Failed to update settings').content);
    }
  }

  /**
   * Show help
   */
  private showHelp(): void {
    console.log(chalk.cyan.bold('\n📚 Available Commands:'));
    console.log(chalk.white('• Ask any question about your application'));
    console.log(chalk.white('• "help" or "h" - Show this help'));
    console.log(chalk.white('• "settings" - Update session settings'));
    console.log(chalk.white('• "history" - Show query history'));
    console.log(chalk.white('• "templates" - Browse query templates'));
    console.log(chalk.white('• "use template [id]" - Use a specific template or select interactively'));
    console.log(chalk.white('• "exit", "quit", or "q" - End session'));
  }

  /**
   * Show query history and optionally allow selection
   */
  private async showHistory(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const history = await this.queryService.getSessionHistory(this.currentSession.sessionId);
    
    if (history.queries.length === 0) {
      console.log(this.outputRenderer.renderInfo('No query history yet').content);
      return;
    }

    console.log(chalk.cyan.bold('\n📜 Query History:'));
    history.detailed.forEach((item, index) => {
      console.log(chalk.dim(`${index + 1}. [${item.timestamp.toLocaleTimeString()}] ${item.action}`));
      console.log(chalk.white(`   ${item.query.substring(0, 100)}${item.query.length > 100 ? '...' : ''}`));
    });

    // Ask if user wants to select a query from history
    const { selectFromHistory } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'selectFromHistory',
        message: '🔍 Would you like to execute a query from history?',
        default: false
      }
    ]);

    if (selectFromHistory) {
      const selectedQuery = await this.selectFromHistory(history.detailed);
      if (selectedQuery) {
        await this.handleQueryInput(selectedQuery);
      }
    }
  }

  /**
   * Select a query from history
   */
  private async selectFromHistory(historyItems: Array<any>): Promise<string | null> {
    if (historyItems.length === 0) {
      console.log(this.outputRenderer.renderInfo('No query history available.').content);
      return null;
    }

    console.log(chalk.blue.bold('\n📜 Select Query from History'));
    console.log(chalk.dim('='.repeat(60)));

    // Create choices from history items (reverse to show most recent first)
    const historyChoices = historyItems
      .slice()
      .reverse()
      .map((item, index) => {
        const timeAgo = this.getTimeAgo(item.timestamp);
        const actionIcon = this.getActionIcon(item.action);
        
        return {
          name: `${actionIcon} ${timeAgo} - ${item.action}
${chalk.dim('    ' + this.truncateQuery(item.query, 80))}`,
          value: item.query,
          short: `Query ${historyItems.length - index}`
        };
      });

    // Add cancel option
    historyChoices.push({
      name: chalk.cyan('🔙 Cancel - Return to main menu'),
      value: null,
      short: 'Cancel'
    });

    const { selectedQuery } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedQuery',
        message: 'Select a query to execute:',
        choices: historyChoices,
        pageSize: Math.min(historyChoices.length, 10)
      }
    ]);

    return selectedQuery;
  }

  /**
   * Get time ago string for a timestamp
   */
  private getTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  /**
   * Get action icon for history display
   */
  private getActionIcon(action: string): string {
    const icons: { [key: string]: string } = {
      'generated': '🤖',
      'edited': '✏️',
      'regenerated': '🔄',
      'executed': '🚀',
      'explained': '📖',
      'template': '📋'
    };
    return icons[action] || '📝';
  }

  /**
   * Truncate query for display
   */
  private truncateQuery(query: string, maxLength: number): string {
    if (query.length <= maxLength) {
      return query;
    }
    return query.substring(0, maxLength - 3) + '...';
  }

  /**
   * Show templates
   */
  private async showTemplates(): Promise<void> {
    try {
      const templates = await this.templateRepository.getTemplates();
      
      if (templates.length === 0) {
        console.log(this.outputRenderer.renderInfo('No templates available yet').content);
        return;
      }

      console.log(chalk.cyan.bold('\n📋 Available Templates:'));
      templates.forEach((template: QueryTemplate, index: number) => {
        console.log(chalk.white(`${index + 1}. ${template.name} (${template.category})`));
        console.log(chalk.dim(`   ${template.description}`));
        console.log(chalk.gray(`   Use: use template ${template.id}`));
      });
      
    } catch (error) {
      console.log(this.outputRenderer.renderError(`Failed to load templates: ${error}`).content);
    }
  }

  /**
   * Select and use a template interactively
   */
  private async selectAndUseTemplate(): Promise<void> {
    try {
      const templates = await this.templateRepository.getTemplates();
      
      if (templates.length === 0) {
        console.log(this.outputRenderer.renderInfo('No templates available yet').content);
        return;
      }

      const { selectedTemplate } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedTemplate',
          message: '📋 Select a template to use:',
          choices: templates.map(t => ({
            name: `${t.name} (${t.category}) - ${t.description}`,
            value: t
          }))
        }
      ]);

      await this.useTemplate(selectedTemplate.id, selectedTemplate);
      
    } catch (error) {
      console.log(this.outputRenderer.renderError(`Failed to select template: ${error}`).content);
    }
  }

  /**
   * Use a specific template
   */
  private async useTemplate(templateId: string, template?: QueryTemplate): Promise<void> {
    try {
      // Get template if not provided
      if (!template) {
        const fetchedTemplate = await this.templateRepository.getTemplate(templateId);
        if (!fetchedTemplate) {
          console.log(this.outputRenderer.renderError(`Template not found: ${templateId}`).content);
          return;
        }
        template = fetchedTemplate;
      }

      console.log(chalk.cyan.bold(`\n📋 Using Template: ${template.name}`));
      console.log(chalk.dim(`Category: ${template.category}`));
      console.log(chalk.dim(`Description: ${template.description}`));

      // Collect parameters if template has any
      const parameters: Record<string, any> = {};
      
      if (template.parameters && template.parameters.length > 0) {
        console.log(chalk.yellow('\n⚙️ Template Parameters:'));
        
        for (const param of template.parameters) {
          let message = `${param.description}`;
          if (param.defaultValue !== undefined) {
            message += ` (default: ${param.defaultValue})`;
          }
          if (param.validValues && param.validValues.length > 0) {
            message += ` [options: ${param.validValues.join(', ')}]`;
          }

          const promptConfig: any = {
            name: param.name,
            message,
            default: param.defaultValue,
            validate: (input: any) => {
              if (param.required && (!input || input.toString().trim() === '')) {
                return `${param.name} is required`;
              }
              if (param.validValues && param.validValues.length > 0 && !param.validValues.includes(input)) {
                return `Invalid value. Valid options: ${param.validValues.join(', ')}`;
              }
              return true;
            }
          };

          if (param.validValues && param.validValues.length > 0) {
            promptConfig.type = 'list';
            promptConfig.choices = param.validValues;
          } else {
            promptConfig.type = 'input';
          }

          const { [param.name]: value } = await inquirer.prompt([promptConfig]);
          parameters[param.name] = value;
        }
      }

      // Apply template and execute
      const query = await this.templateRepository.applyTemplate(template, parameters);
      
      console.log(chalk.green.bold('\n🔍 Generated Query:'));
      console.log(chalk.dim('─'.repeat(50)));
      console.log(chalk.white(query));
      console.log(chalk.dim('─'.repeat(50)));

      // Ask user if they want to execute the query
      const { shouldExecute } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldExecute',
          message: '🚀 Execute this template query?',
          default: true
        }
      ]);

      if (shouldExecute && this.currentSession && template) {
        globalLoadingIndicator.start('Executing template query...');
        const result = await this.queryService.executeQuery({
          userInput: '', // Empty since we're using template mode
          templateId: template!.id,
          parameters,
          sessionId: this.currentSession!.sessionId,
          mode: 'template'
        });
        globalLoadingIndicator.succeed('Template query executed successfully');

        await this.displayResults(result.result, query);
      }

    } catch (error) {
      globalLoadingIndicator.fail('Failed to execute template query');
      logger.error('Failed to use template:', error);
      console.log(this.outputRenderer.renderError(`Failed to use template: ${error}`).content);
    }
  }

  /**
   * Open query in Azure Portal
   * @returns Promise<boolean> - true if user wants to continue with more actions, false to exit
   */
  private async openInAzurePortal(query: string): Promise<boolean> {
    try {
      if (!this.externalExecutionService) {
        console.log(this.outputRenderer.renderError(
          'Azure Portal integration is not available. Please check your configuration.'
        ).content);
        return false;
      }

      // Validate configuration
      const validation = this.externalExecutionService.validateConfiguration();
      if (!validation.isValid) {
        console.log(this.outputRenderer.renderError(
          `Azure Portal integration requires the following configuration: ${validation.missingFields.join(', ')}`
        ).content);
        return false;
      }

      // Execute external command to open in portal
      const result = await this.externalExecutionService.executeExternal('portal', query, true);
      
      if (result.launched) {
        console.log(this.outputRenderer.renderSuccess(
          'Query opened in Azure Portal successfully! Check your browser.'
        ).content);
        
        // Ask if user wants to continue with another action
        const { continueSession } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continueSession',
            message: '🔄 Would you like to perform another action with this query?',
            default: false
          }
        ]);

        return continueSession; // Return true to continue, false to exit
      } else {
        console.log(this.outputRenderer.renderError(
          result.error || 'Failed to open query in Azure Portal'
        ).content);
        return false;
      }
    } catch (error) {
      logger.error('Failed to open in Azure Portal:', error);
      console.log(this.outputRenderer.renderError(
        `Failed to open in Azure Portal: ${error}`
      ).content);
      return false;
    }
  }

  /**
   * Explain query
   */
  private async explainQuery(query: string): Promise<void> {
    try {
      // Prompt user for explanation options
      const explanationOptions = await promptForExplanationOptions();
      
      globalLoadingIndicator.start(`Generating query explanation with AI in ${getLanguageName(explanationOptions.language || 'en')}...`);
      const explanation = await this.queryService.explainQuery(query, explanationOptions);
      globalLoadingIndicator.succeed('Query explanation generated successfully');

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
      globalLoadingIndicator.fail('Failed to generate query explanation');
      console.log(this.outputRenderer.renderError(`Explanation failed: ${error}`).content);
    }
  }

  /**
   * Regenerate query
   */
  private async regenerateQuery(originalQuestion: string, previousQuery: any): Promise<any> {
    try {
      globalLoadingIndicator.start('Regenerating query with AI...');
      const result = await this.queryService.regenerateQuery(
        originalQuestion,
        previousQuery,
        this.currentSession!.sessionId,
        2
      );
      globalLoadingIndicator.succeed('New query generated successfully');

      return result.nlQuery;
      
    } catch (error) {
      globalLoadingIndicator.fail('Failed to regenerate query');
      console.log(this.outputRenderer.renderError(`Regeneration failed: ${error}`).content);
      return null;
    }
  }

  /**
   * Edit query using QueryEditorService
   */
  private async editQuery(currentQuery: string): Promise<string | null> {
    try {
      return await this.queryEditorService.editQuery(currentQuery);
    } catch (error) {
      console.log(this.outputRenderer.renderError(`Failed to edit query: ${error}`).content);
      return null;
    }
  }

  /**
   * Prompt for file save option (restored from original InteractiveService)
   */
  private async promptForFileSave(result: QueryResult, query?: string): Promise<void> {
    // Skip if outputFile is already specified in options (already saved above)
    if (this.options.outputFile) {
      return;
    }

    const { saveToFile } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'saveToFile',
        message: '💾 Would you like to save these results to a file?',
        default: false
      }
    ]);

    if (!saveToFile) {
      return;
    }

    // Get save options
    const { format, includeHeaders, pretty, filePath } = await inquirer.prompt([
      {
        type: 'list',
        name: 'format',
        message: 'Select output format:',
        choices: [
          { name: '📋 JSON - JavaScript Object Notation', value: 'json' },
          { name: '📊 CSV - Comma Separated Values', value: 'csv' },
          { name: '📄 TSV - Tab Separated Values', value: 'tsv' },
          { name: '📝 Table - Formatted table view', value: 'table' }
        ],
        default: 'json'
      },
      {
        type: 'confirm',
        name: 'includeHeaders',
        message: 'Include column headers?',
        default: true,
        when: (answers) => ['csv', 'tsv', 'table'].includes(answers.format)
      },
      {
        type: 'confirm',
        name: 'pretty',
        message: 'Use pretty formatting?',
        default: true,
        when: (answers) => answers.format === 'json'
      },
      {
        type: 'input',
        name: 'filePath',
        message: 'Enter file path (leave empty for auto-generated):',
        default: '',
        validate: (input: string) => {
          if (!input.trim()) return true; // Empty is valid (auto-generate)
          // Basic path validation - more detailed validation in FileOutputManager
          return true;
        }
      }
    ]);

    try {
      await this.saveResultToFile(result, {
        format,
        filePath: filePath.trim() || undefined,
        pretty,
        includeHeaders: includeHeaders !== false,
        encoding: 'utf8'
      }, query);

    } catch (error) {
      logger.error('Failed to save results to file:', error);
      console.log(this.outputRenderer.renderError(`Failed to save file: ${error}`).content);
    }
  }

  /**
   * Save results to file with comprehensive options (restored from original InteractiveService)
   */
  private async saveResultToFile(result: QueryResult, options: {
    format: OutputFormat;
    filePath?: string;
    pretty?: boolean;
    includeHeaders?: boolean;
    encoding?: BufferEncoding;
  }, query?: string): Promise<void> {
    // Generate filename if not provided
    const outputPath = options.filePath || FileOutputManager.generateFileName({
      format: options.format,
      destination: 'file'
    });

    // Resolve and check path
    const resolvedPath = FileOutputManager.resolveOutputPath(outputPath, options.format);

    if (!FileOutputManager.checkWritePermission(resolvedPath)) {
      throw new Error(`Cannot write to file: ${resolvedPath}`);
    }

    // Format the output
    const formattedOutput = OutputFormatter.formatResult(result, options.format, {
      pretty: options.pretty,
      includeHeaders: options.includeHeaders
    });

    // Create backup if file exists
    FileOutputManager.createBackup(resolvedPath);

    // Write to file
    await FileOutputManager.writeToFile(formattedOutput, resolvedPath, options.encoding || 'utf8');

    // Show success message with details
    const totalRows = result.tables ? result.tables.reduce((sum, table) => sum + (table.rows?.length || 0), 0) : 0;
    console.log(chalk.green(`✅ Successfully saved ${totalRows} rows to ${resolvedPath}`));
    
    if (query) {
      console.log(chalk.dim(`   Query: ${this.truncateQuery(query, 60)}`));
    }
  }

  /**
   * Save results to file (simple version for when outputFile is specified in options)
   */
  private async saveToFile(result: QueryResult, query?: string): Promise<void> {
    try {
      const formatted = OutputFormatter.formatResult(result, this.options.outputFormat || 'json', {
        pretty: this.options.prettyJson,
        includeHeaders: this.options.includeHeaders !== false
      });

      await FileOutputManager.writeToFile(formatted, this.options.outputFile!);

      console.log(this.outputRenderer.renderSuccess(
        `Results saved to: ${this.options.outputFile}`
      ).content);
      
    } catch (error) {
      console.log(this.outputRenderer.renderError(`Failed to save file: ${error}`).content);
    }
  }

  /**
   * Ask user if they want to continue the session (restored from original InteractiveService)
   */
  private async askToContinue(): Promise<boolean> {
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
    }

    return continueSession;
  }

  /**
   * Ask user if they want to retry after an error (restored from original InteractiveService)
   */
  private async askToRetry(): Promise<boolean> {
    const { retry } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'retry',
        message: 'Would you like to try again?',
        default: true
      }
    ]);

    return retry;
  }

  /**
   * Show chart for numeric data if applicable (experimental feature)
   */
  private async showChartIfApplicable(result: QueryResult): Promise<void> {
    if (result.tables.length > 0 && result.tables[0].rows.length > 1) {
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
              message: '📈 Would you like to see a simple chart of this data? (Experimental)',
              default: false
            }
          ]);

          if (showChart) {
            const chartData = firstTable.rows.slice(0, 10).map(row => ({
              label: String(row[0] || ''),
              value: Number(row[1]) || 0,
            }));

            // Auto-detect best chart type, but allow user to choose
            const isTimeSeries = detectTimeSeriesData(chartData);
            const defaultChartType = isTimeSeries ? 'line' : 'bar';

            const { chartType } = await inquirer.prompt([
              {
                type: 'list',
                name: 'chartType',
                message: 'Which chart type would you prefer?',
                choices: [
                  { name: `📈 Line Chart${isTimeSeries ? ' (recommended for time-series)' : ''}`, value: 'line' },
                  { name: '📊 Bar Chart', value: 'bar' }
                ],
                default: defaultChartType
              }
            ]);

            Visualizer.displayChart(chartData, chartType);
          }
        }
      }
    }
  }

  /**
   * End session
   */
  private async endSession(): Promise<void> {
    if (this.currentSession) {
      await this.queryService.endSession(this.currentSession.sessionId);
      console.log(chalk.green('👋 Interactive session ended. Thank you!'));
    }
  }
}