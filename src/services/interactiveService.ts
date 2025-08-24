import inquirer from 'inquirer';
import chalk from 'chalk';
import { StepExecutionService } from './stepExecutionService';
import { QueryService } from './QueryService';
import { ConfigManager } from '../utils/config';
import { Visualizer } from '../utils/visualizer';
import { OutputFormatter } from '../utils/outputFormatter';
import { FileOutputManager } from '../utils/fileOutput';
import { logger } from '../utils/logger';
import { withLoadingIndicator } from '../utils/loadingIndicator';
import { QueryResult, SupportedLanguage, OutputFormat, AnalysisType, AnalysisResult } from '../types';
import { IAIProvider, IDataSourceProvider, IAuthenticationProvider, QueryAnalysisResult } from '../core/interfaces';
import { detectTimeSeriesData } from '../utils/chart';

export interface InteractiveSessionOptions {
  language?: SupportedLanguage;
  defaultMode?: 'direct' | 'step' | 'raw';
  outputFormat?: OutputFormat;
  outputFile?: string;
  prettyJson?: boolean;
  includeHeaders?: boolean;
  encoding?: BufferEncoding;
}

export class InteractiveService {


  constructor(
    private aiProvider: IAIProvider,
    private dataSourceProvider: IDataSourceProvider,
    private authProvider: IAuthenticationProvider,
    private queryService: QueryService,
    private configManager: ConfigManager,
    private options: InteractiveSessionOptions = {}
  ) {}

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

    // Pre-initialize AI services
    console.log(chalk.dim('\n🤖 Initializing AI services...'));
    try {
      // Use provider initialization if available
      logger.info('AI provider initialized and ready');
      console.log(chalk.green('✅ AI services ready\n'));
    } catch (error) {
      logger.warn('AI service initialization warning:', error);
      console.log(chalk.yellow('⚠️  AI services initialized with warnings\n'));
    }

    while (true) {
      try {
        // Get question from user
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
                return true; // exit command is valid
              }
              return true;
            },
          }
        ]);

        // Check for exit commands
        if (question.toLowerCase().trim() === 'exit' || question.toLowerCase().trim() === 'quit') {
          console.log(chalk.green('👋 Thanks for using AppInsights Detective!'));
          break;
        }

        // Select execution mode
        const executionMode = await this.selectExecutionMode(question);

        // Execute query
        await this.executeQuery(question, executionMode);

        // Confirm if continuing
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
   * Select execution mode
   */
  private async selectExecutionMode(question?: string): Promise<'direct' | 'step' | 'raw'> {
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
        default: this.options.defaultMode || 'step' // Default is step mode
      }
    ]);

    return mode;
  }

  /**
   * Execute query
   */
  private async executeQuery(question: string, mode: 'direct' | 'step' | 'raw'): Promise<void> {
    try {
      if (mode === 'raw') {
        await this.executeRawQuery(question);
      } else {
        await this.executeNaturalLanguageQuery(question, mode);
      }
    } catch (error) {
      logger.error('Query execution failed:', error);
      Visualizer.displayError(`Query failed: ${error}`);
    }
  }

  /**
   * Execute raw KQL query
   */
  private async executeRawQuery(query: string): Promise<void> {
    const startTime = Date.now();
    Visualizer.displayInfo(`Executing raw KQL query: ${query}`);

    const result = await withLoadingIndicator(
      'Executing query on Application Insights...',
      () => this.dataSourceProvider.executeQuery({ query }),
      {
        successMessage: 'Query executed successfully',
        errorMessage: 'Failed to execute query'
      }
    );

    const executionTime = Date.now() - startTime;
    await this.handleInteractiveOutput(result, executionTime, query);
  }

  /**
   * Execute natural language query
   */
  private async executeNaturalLanguageQuery(
    question: string,
    mode: 'direct' | 'step'
  ): Promise<void> {
    Visualizer.displayInfo(`Processing question: "${question}"`);

    // Retrieve schema (optional)
    let schema: any;
    try {
      const schemaResult = await withLoadingIndicator(
        'Retrieving Application Insights schema...',
        () => this.dataSourceProvider.getSchema(),
        {
          successMessage: 'Schema retrieved successfully',
          errorMessage: 'Could not retrieve schema, proceeding without it'
        }
      );
      schema = schemaResult.schema;
      logger.debug('Schema retrieved for query generation');
    } catch (_error) {
      logger.warn('Could not retrieve schema, proceeding without it');
    }

    // Apply language settings
    if (this.options.language) {
      const config = this.configManager.getConfig();
      config.language = this.options.language;
    }

    // Generate KQL query
    const nlQuery = await withLoadingIndicator(
      'Generating KQL query with AI...',
      () => this.aiProvider.generateQuery({ userInput: question, schema }),
      {
        successMessage: 'KQL query generated successfully',
        errorMessage: 'Failed to generate KQL query'
      }
    );

    // Debug information
    logger.debug(`Generated query with confidence: ${nlQuery.confidence}`);
    logger.debug(`Selected mode: ${mode}`);

    let result: QueryResult | null = null;

    if (mode === 'step' || nlQuery.confidence < 0.7) {
      // Step execution mode
      Visualizer.displayInfo('Starting step-by-step query review...');

      const stepExecutionService = new StepExecutionService(
        this.aiProvider,
        this.dataSourceProvider,
        this.authProvider,
        this.configManager,
        {
          showConfidenceThreshold: 0.7,
          allowEditing: true,
          maxRegenerationAttempts: 3
        }
      );

      const stepResult = await stepExecutionService.executeStepByStep(nlQuery, question);

      if (stepResult) {
        await this.handleInteractiveOutput(stepResult.result, stepResult.executionTime, nlQuery.generatedKQL);
      }
    } else {
      // Direct execution mode
      Visualizer.displayInfo('Executing query in direct mode...');
      Visualizer.displayKQLQuery(nlQuery.generatedKQL, nlQuery.confidence);

      // Validate query using QueryService
      const validation = await this.queryService.validateQuery(nlQuery.generatedKQL);
      if (!validation.isValid) {
        Visualizer.displayError(`Generated query is invalid: ${validation.error || 'Unknown validation error'}`);
        return;
      }

      // Execute query
      const queryStartTime = Date.now();
      result = await withLoadingIndicator(
        'Executing query on Application Insights...',
        () => this.dataSourceProvider.executeQuery({ query: nlQuery.generatedKQL }),
        {
          successMessage: 'Query executed successfully',
          errorMessage: 'Failed to execute query'
        }
      );
      const executionTime = Date.now() - queryStartTime;

      if (result) {
        await this.handleInteractiveOutput(result, executionTime, nlQuery.generatedKQL);
      }
    }
  }

  /**
   * Handle output formatting and file writing with interactive prompts
   */
  private async handleInteractiveOutput(result: QueryResult, executionTime: number, originalQuery?: string): Promise<void> {
    const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);

    // Always display to console first (default: hide empty columns in interactive mode)
    Visualizer.displayResult(result);
    Visualizer.displaySummary(executionTime, totalRows);

    // Show chart for numeric data
    await this.showChartIfApplicable(result);

    // Offer analysis option if we have data and query
    if (totalRows > 0 && originalQuery) {
      await this.promptForAnalysisOption(result, originalQuery);
    }

    // Ask about output format and file saving
    const outputChoice = await this.promptForOutputOptions(totalRows);

    if (outputChoice.saveToFile && outputChoice.format) {
      try {
        await this.saveResultToFile(result, {
          format: outputChoice.format,
          filePath: outputChoice.filePath,
          pretty: outputChoice.pretty,
          includeHeaders: outputChoice.includeHeaders,
          encoding: outputChoice.encoding
        });
      } catch (error) {
        logger.error('File save failed:', error);
        Visualizer.displayError(`Failed to save to file: ${error}`);
      }
    }
  }

  /**
   * Prompt user for output options
   */
  private async promptForOutputOptions(totalRows: number): Promise<{
    saveToFile: boolean;
    format?: OutputFormat;
    filePath?: string;
    pretty?: boolean;
    includeHeaders?: boolean;
    encoding?: BufferEncoding;
  }> {
    const { saveToFile } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'saveToFile',
        message: `Would you like to save these ${totalRows} rows to a file?`,
        default: false
      }
    ]);

    if (!saveToFile) {
      return { saveToFile: false };
    }

    const { format, filePath, pretty, includeHeaders, encoding } = await inquirer.prompt([
      {
        type: 'list',
        name: 'format',
        message: 'Select output format:',
        choices: [
          { name: '📊 JSON - Structured data format', value: 'json' },
          { name: '📋 CSV - Comma-separated values for spreadsheets', value: 'csv' },
          { name: '📑 TSV - Tab-separated values', value: 'tsv' },
          { name: '📄 Raw - Human-readable debug format', value: 'raw' }
        ],
        default: this.options.outputFormat || 'json'
      },
      {
        type: 'input',
        name: 'filePath',
        message: 'Enter output file path (or press Enter for auto-generated):',
        default: '',
        validate: (input: string) => {
          if (!input.trim()) return true; // Allow empty for auto-generation
          return input.length > 0 || 'Please enter a valid file path';
        }
      },
      {
        type: 'confirm',
        name: 'pretty',
        message: 'Pretty print JSON output?',
        default: this.options.prettyJson !== false,
        when: (answers) => answers.format === 'json'
      },
      {
        type: 'confirm',
        name: 'includeHeaders',
        message: 'Include column headers?',
        default: this.options.includeHeaders !== false,
        when: (answers) => answers.format === 'csv' || answers.format === 'tsv'
      },
      {
        type: 'list',
        name: 'encoding',
        message: 'Select file encoding:',
        choices: [
          { name: 'UTF-8 (recommended)', value: 'utf8' },
          { name: 'UTF-16 Little Endian', value: 'utf16le' },
          { name: 'ASCII', value: 'ascii' },
          { name: 'Latin-1', value: 'latin1' }
        ],
        default: this.options.encoding || 'utf8'
      }
    ]);

    return {
      saveToFile: true,
      format,
      filePath: filePath.trim() || undefined,
      pretty,
      includeHeaders,
      encoding
    };
  }

  /**
   * Save result to file with user-specified options
   */
  private async saveResultToFile(result: QueryResult, options: {
    format: OutputFormat;
    filePath?: string;
    pretty?: boolean;
    includeHeaders?: boolean;
    encoding?: BufferEncoding;
  }): Promise<void> {
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

    // Show success message
    const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
    console.log(chalk.green(`✅ Successfully saved ${totalRows} rows to ${resolvedPath}`));
  }

  /**
   * Show chart for numeric data if applicable
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
              message: 'Would you like to see a simple chart of this data?',
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
   * Prompt user for analysis option
   */
  private async promptForAnalysisOption(result: QueryResult, originalQuery: string): Promise<void> {
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

    // Show analysis options
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
      const queryAnalysisResult = await withLoadingIndicator(
        'Analyzing query results with AI...',
        () => this.aiProvider.analyzeQueryResult({
          result,
          originalQuery,
          analysisType: analysisType as 'patterns' | 'anomalies' | 'insights' | 'full',
          options: { language: language as SupportedLanguage }
        })
      );

      // Map to legacy AnalysisResult format for backward compatibility
      const analysis = this.mapToAnalysisResult(queryAnalysisResult);

      // Display the analysis results
      Visualizer.displayAnalysisResult(analysis, analysisType);

      // Offer to execute follow-up queries if available
      if (analysis.followUpQueries && analysis.followUpQueries.length > 0) {
        await this.promptForFollowUpQuery(analysis.followUpQueries);
      }

    } catch (error) {
      logger.error('Analysis failed:', error);
      Visualizer.displayError(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Prompt user for follow-up query execution
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
      await this.executeQuery(selectedQuery, 'raw');
    }
  }

  /**
   * Update session settings
   */
  async updateSettings(currentLanguage?: SupportedLanguage): Promise<void> {
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

    // Persist settings (temporarily save to config)
    const config = this.configManager.getConfig();
    config.language = language;

    Visualizer.displaySuccess('Session settings updated!');
  }
}
