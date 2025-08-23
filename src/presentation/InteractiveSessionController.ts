import inquirer from 'inquirer';
import chalk from 'chalk';
import { 
  IOutputRenderer,
  IQuerySession,
  SessionOptions
} from '../core/interfaces';
import { QueryService, QueryServiceRequest } from '../services/QueryService';
import { TemplateService } from '../services/TemplateService';
import { AnalysisService } from '../services/analysisService';
import { SupportedLanguage, OutputFormat, QueryResult } from '../types';
import { detectTimeSeriesData } from '../utils/chart';
import { FileOutputManager } from '../utils/fileOutput';
import { OutputFormatter } from '../utils/outputFormatter';
import { logger } from '../utils/logger';

/**
 * Options for interactive session controller
 */
export interface InteractiveSessionControllerOptions {
  language?: SupportedLanguage;
  defaultMode?: 'direct' | 'step' | 'raw';
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
    private templateService: TemplateService,
    private analysisService: AnalysisService,
    private outputRenderer: IOutputRenderer,
    private options: InteractiveSessionControllerOptions = {}
  ) {
    this.fileOutputManager = new FileOutputManager();
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
      const sessionOptions: SessionOptions = {
        language: this.options.language || 'auto',
        defaultMode: this.options.defaultMode || 'step',
        showConfidenceThreshold: 0.7,
        allowEditing: true,
        maxRegenerationAttempts: 3
      };

      const result = await this.queryService.executeQuery({
        userInput: '', // Dummy request to create session
        mode: sessionOptions.defaultMode
      });

      this.currentSession = result.session;
      
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

        // Handle query input
        await this.handleQueryInput(trimmedInput);

      } catch (error) {
        if ((error as any)?.message === 'User force closed the prompt') {
          console.log(chalk.yellow('\n👋 Session interrupted by user'));
          await this.endSession();
          break;
        }
        
        logger.error('Error in interaction loop:', error);
        console.log(this.outputRenderer.renderError(`An error occurred: ${error}`).content);
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
      
      // Execute query
      const result = await this.queryService.executeQuery({
        userInput: input,
        sessionId: this.currentSession.sessionId,
        mode
      });

      // Handle step mode vs direct mode differently
      if (mode === 'step' && result.nlQuery) {
        await this.handleStepMode(result.nlQuery, input);
      } else {
        // Direct or raw mode - show results immediately
        await this.handleDirectMode(result);
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
    await this.displayResults(result.result, result.nlQuery?.generatedKQL);
  }

  /**
   * Get execution mode from user
   */
  private async getExecutionMode(input: string): Promise<'direct' | 'step' | 'raw'> {
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

    // Return session default or ask user
    return this.currentSession?.options.defaultMode || 'step';
  }

  /**
   * Get user action for step mode
   */
  private async getUserAction(): Promise<string> {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do with this query?',
        choices: [
          { name: '🚀 Execute Query', value: 'execute' },
          { name: '📖 Explain Query', value: 'explain' },
          { name: '🔄 Regenerate Query', value: 'regenerate' },
          { name: '✏️  Edit Query', value: 'edit' },
          { name: '📜 View History', value: 'history' },
          { name: '❌ Cancel', value: 'cancel' }
        ]
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

      const result = await this.queryService.executeQuery({
        userInput: query,
        sessionId: this.currentSession.sessionId,
        mode: 'raw'
      });

      await this.displayResults(result.result, query);

    } catch (error) {
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

    // Handle file output if specified
    if (this.options.outputFile) {
      await this.saveToFile(result.result, query);
    }

    // Offer analysis
    await this.offerAnalysis(result.result);
  }

  /**
   * Offer analysis of results
   */
  private async offerAnalysis(result: QueryResult): Promise<void> {
    if (!result.tables || result.tables.length === 0 || !result.tables[0].rows || result.tables[0].rows.length === 0) {
      return;
    }

    const { wantAnalysis } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'wantAnalysis',
        message: '🔍 Would you like AI analysis of these results?',
        default: false
      }
    ]);

    if (wantAnalysis) {
      try {
        console.log(this.outputRenderer.renderInfo('Analyzing results...').content);
        
        const analysis = await this.analysisService.analyzeQueryResult(result, 'dummy_query', 'insights');
        const analysisOutput = await this.outputRenderer.renderAnalysisResult(analysis, {});
        
        console.log(analysisOutput.content);
        
      } catch (error) {
        console.log(this.outputRenderer.renderError(`Analysis failed: ${error}`).content);
      }
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
    // Implementation for updating settings - similar to existing interactiveService
    console.log(this.outputRenderer.renderInfo('Settings update feature coming soon...').content);
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
    console.log(chalk.white('• "exit", "quit", or "q" - End session'));
  }

  /**
   * Show query history
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
  }

  /**
   * Show templates
   */
  private async showTemplates(): Promise<void> {
    try {
      const templates = await this.templateService.getTemplates();
      
      if (templates.length === 0) {
        console.log(this.outputRenderer.renderInfo('No templates available yet').content);
        return;
      }

      console.log(chalk.cyan.bold('\n📋 Available Templates:'));
      templates.forEach((template, index) => {
        console.log(chalk.white(`${index + 1}. ${template.name} (${template.category})`));
        console.log(chalk.dim(`   ${template.description}`));
      });
      
    } catch (error) {
      console.log(this.outputRenderer.renderError(`Failed to load templates: ${error}`).content);
    }
  }

  /**
   * Explain query
   */
  private async explainQuery(query: string): Promise<void> {
    try {
      console.log(this.outputRenderer.renderInfo('Generating query explanation...').content);
      
      const explanation = await this.queryService.explainQuery(query, {
        language: this.currentSession?.options.language as string || 'en',
        technicalLevel: 'intermediate',
        includeExamples: true
      });

      console.log(chalk.green.bold('\n📚 Query Explanation:'));
      console.log(chalk.dim('='.repeat(50)));
      console.log(chalk.white(explanation));
      console.log(chalk.dim('='.repeat(50)));
      
    } catch (error) {
      console.log(this.outputRenderer.renderError(`Explanation failed: ${error}`).content);
    }
  }

  /**
   * Regenerate query
   */
  private async regenerateQuery(originalQuestion: string, previousQuery: any): Promise<any> {
    try {
      console.log(this.outputRenderer.renderInfo('Regenerating query with different approach...').content);
      
      const result = await this.queryService.regenerateQuery(
        originalQuestion,
        previousQuery,
        this.currentSession!.sessionId,
        2
      );

      console.log(this.outputRenderer.renderSuccess('New query generated successfully!').content);
      return result.nlQuery;
      
    } catch (error) {
      console.log(this.outputRenderer.renderError(`Regeneration failed: ${error}`).content);
      return null;
    }
  }

  /**
   * Edit query
   */
  private async editQuery(currentQuery: string): Promise<string | null> {
    try {
      const { editedQuery } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'editedQuery',
          message: 'Edit the KQL query:',
          default: currentQuery
        }
      ]);

      const trimmed = editedQuery.trim();
      
      if (trimmed === currentQuery.trim()) {
        console.log(this.outputRenderer.renderInfo('No changes made to the query').content);
        return null;
      }

      if (!trimmed) {
        console.log(this.outputRenderer.renderError('Empty query is not allowed').content);
        return null;
      }

      console.log(this.outputRenderer.renderSuccess('Query edited successfully!').content);
      return trimmed;
      
    } catch (error) {
      console.log(this.outputRenderer.renderError(`Failed to edit query: ${error}`).content);
      return null;
    }
  }

  /**
   * Save results to file
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
   * End session
   */
  private async endSession(): Promise<void> {
    if (this.currentSession) {
      await this.queryService.endSession(this.currentSession.sessionId);
      console.log(chalk.green('👋 Interactive session ended. Thank you!'));
    }
  }
}