#!/usr/bin/env node

import { Command } from 'commander';
import { createSetupCommand } from './commands/setup';
import { createQueryCommand } from './commands/query';
import { createStatusCommand } from './commands/status';
import { logger } from '../utils/logger';
import chalk from 'chalk';
import { AuthService } from '../services/authService';
import { AppInsightsService } from '../services/appInsightsService';
import { AIService } from '../services/aiService';
import { StepExecutionService } from '../services/stepExecutionService';
import { InteractiveService } from '../services/interactiveService';
import { ExternalExecutionService } from '../services/externalExecutionService';
import { ConfigManager } from '../utils/config';
import { Visualizer } from '../utils/visualizer';
import { OutputFormatter } from '../utils/outputFormatter';
import { FileOutputManager } from '../utils/fileOutput';
import { OutputFormat, AzureResourceInfo, ExternalExecutionTarget } from '../types';
import { detectTimeSeriesData } from '../utils/chart';

/**
 * Get enhanced Azure resource information with auto-discovery
 */
async function getEnhancedAzureResourceInfo(): Promise<AzureResourceInfo | null> {
  try {
    const configManager = new ConfigManager();
    const config = await configManager.getEnhancedConfig();
    const appInsights = config.appInsights;

    if (!appInsights.tenantId || !appInsights.subscriptionId || 
        !appInsights.resourceGroup || !appInsights.resourceName) {
      return null;
    }

    return {
      tenantId: appInsights.tenantId,
      subscriptionId: appInsights.subscriptionId,
      resourceGroup: appInsights.resourceGroup,
      resourceName: appInsights.resourceName,
      clusterId: appInsights.clusterId,
      databaseName: appInsights.databaseName
    };
  } catch (error) {
    logger.error('Failed to get enhanced Azure resource information:', error);
    return null;
  }
}

/**
 * Handle output formatting and file writing
 */
async function handleOutput(result: any, options: any, executionTime: number): Promise<void> {
  const outputFormat = options.format as OutputFormat;
  const outputFile = options.output as string | undefined;
  const encoding = FileOutputManager.isValidEncoding(options.encoding) ? options.encoding : 'utf8';

  // Validate format
  const validFormats: OutputFormat[] = ['table', 'json', 'csv', 'tsv', 'raw'];
  if (!validFormats.includes(outputFormat)) {
    logger.warn(`Invalid format '${outputFormat}', defaulting to table`);
    options.format = 'table';
  }

  // Handle console output based on format and output file options
  if (!outputFile) {
    // No output file specified - display to console
    if (outputFormat === 'table') {
      // Table format: use visualizer with charts
      const hideEmptyColumns = !options.showEmptyColumns;
      Visualizer.displayResult(result, { hideEmptyColumns });
      const totalRows = result.tables.reduce((sum: number, table: any) => sum + table.rows.length, 0);
      Visualizer.displaySummary(executionTime, totalRows);

      // Display chart for numeric data when showing table format
      if (result.tables.length > 0 && result.tables[0].rows.length > 1) {
        const firstTable = result.tables[0];
        if (firstTable.columns.length >= 2) {
          const hasNumericData = firstTable.rows.some((row: any) =>
            typeof row[1] === 'number' || !isNaN(Number(row[1]))
          );

          if (hasNumericData) {
            const chartData = firstTable.rows.slice(0, 10).map((row: any) => ({
              label: String(row[0] || ''),
              value: Number(row[1]) || 0,
            }));
            
            // Auto-detect best chart type for CLI mode
            const isTimeSeries = detectTimeSeriesData(chartData);
            const chartType = isTimeSeries ? 'line' : 'bar';
            
            Visualizer.displayChart(chartData, chartType);
          }
        }
      }
    } else {
      // Non-table format: display formatted output to console
      const formattedOutput = OutputFormatter.formatResult(result, outputFormat, {
        pretty: options.pretty,
        includeHeaders: !options.noHeaders
      });
      
      console.log(formattedOutput.content);
      
      // Show summary for non-table formats
      const totalRows = result.tables.reduce((sum: number, table: any) => sum + table.rows.length, 0);
      Visualizer.displaySummary(executionTime, totalRows);
    }
  } else {
    // Output file specified - show table format to console if format is table
    if (outputFormat === 'table') {
      const hideEmptyColumns = !options.showEmptyColumns;
      Visualizer.displayResult(result, { hideEmptyColumns });
      const totalRows = result.tables.reduce((sum: number, table: any) => sum + table.rows.length, 0);
      Visualizer.displaySummary(executionTime, totalRows);

      // Display chart for table format
      if (result.tables.length > 0 && result.tables[0].rows.length > 1) {
        const firstTable = result.tables[0];
        if (firstTable.columns.length >= 2) {
          const hasNumericData = firstTable.rows.some((row: any) =>
            typeof row[1] === 'number' || !isNaN(Number(row[1]))
          );

          if (hasNumericData) {
            const chartData = firstTable.rows.slice(0, 10).map((row: any) => ({
              label: String(row[0] || ''),
              value: Number(row[1]) || 0,
            }));
            
            // Auto-detect best chart type for CLI mode
            const isTimeSeries = detectTimeSeriesData(chartData);
            const chartType = isTimeSeries ? 'line' : 'bar';
            
            Visualizer.displayChart(chartData, chartType);
          }
        }
      }
    }
  }

  // Handle file output
  if (outputFile) {
    try {
      // Resolve output path and check permissions
      const resolvedPath = FileOutputManager.resolveOutputPath(outputFile, outputFormat);
      
      if (!FileOutputManager.checkWritePermission(resolvedPath)) {
        Visualizer.displayError(`Cannot write to file: ${resolvedPath}`);
        return;
      }

      // Format the output
      const formattedOutput = OutputFormatter.formatResult(result, outputFormat, {
        pretty: options.pretty,
        includeHeaders: !options.noHeaders
      });

      // Create backup if file exists
      FileOutputManager.createBackup(resolvedPath);

      // Write to file
      await FileOutputManager.writeToFile(formattedOutput, resolvedPath, encoding);

      // Show success message
      const totalRows = result.tables.reduce((sum: number, table: any) => sum + table.rows.length, 0);
      console.log(chalk.green(`✅ Successfully saved ${totalRows} rows to ${resolvedPath}`));
      
      // Summary is handled in console output section above

    } catch (error) {
      logger.error('File output failed:', error);
      Visualizer.displayError(`Failed to save to file: ${error}`);
      
      // Fallback to console output
      if (outputFormat === 'table') {
        // Show table format if that was the original format
        const hideEmptyColumns = !options.showEmptyColumns;
        Visualizer.displayResult(result, { hideEmptyColumns });
      } else {
        // Show formatted output for non-table formats
        const formattedOutput = OutputFormatter.formatResult(result, outputFormat, {
          pretty: options.pretty,
          includeHeaders: !options.noHeaders
        });
        console.log(chalk.yellow('Falling back to console output:'));
        console.log(formattedOutput.content);
      }
    }
  }
}

const program = new Command();

program
  .name('aidx')
  .description('AppInsights Detective - Query Application Insights with natural language')
  .version('1.0.0');

// Sub commands
program.addCommand(createSetupCommand());
program.addCommand(createQueryCommand());
program.addCommand(createStatusCommand());

// Default Action
program
  .argument('[question]', 'Natural language question to ask')
  .option('-i, --interactive', 'Run in interactive mode with step-by-step guidance')
  .option('-l, --language <language>', 'Language for explanations (en, ja, ko, zh, es, fr, de, etc.)')
  .option('-r, --raw', 'Execute raw KQL query')
  .option('--direct', 'Execute query directly without confirmation')
  .option('--external', 'Show external execution options interactively')
  .option('--open-portal', 'Open generated query directly in Azure Portal')
  .option('--open-dataexplorer', 'Open generated query directly in Azure Data Explorer')
  .option('-f, --format <format>', 'Output format (table, json, csv, tsv, raw)', 'table')
  .option('-o, --output <file>', 'Output file path')
  .option('--pretty', 'Pretty print JSON output')
  .option('--no-headers', 'Exclude headers in CSV/TSV output')
  .option('--encoding <encoding>', 'File encoding (utf8, utf16le, etc.)', 'utf8')
  .option('--show-empty-columns', 'Show all columns including empty ones (default: hide empty columns)')
  .action(async (question, options) => {
    try {
      if (question) {
        await executeDirectQuery(question, options);
      } else if (options.interactive) {
        const configManager = new ConfigManager();
        if (!configManager.validateConfig()) {
          Visualizer.displayError('Configuration is invalid. Please run "aidx setup" first.');
          process.exit(1);
        }

        console.log(chalk.dim('🚀 Starting interactive session...'));

        const authService = new AuthService();
        const appInsightsService = new AppInsightsService(authService, configManager);
        const aiService = new AIService(authService, configManager);

        const interactiveService = new InteractiveService(
          authService,
          appInsightsService,
          aiService,
          configManager,
          {
            language: options.language,
            defaultMode: options.raw ? 'raw' : 'step'
          }
        );
        await interactiveService.startSession();
      } else {
        program.help();
      }
    } catch (error) {
      logger.error('CLI execution failed:', error);
      console.error(chalk.red.bold('❌ An unexpected error occurred:'));
      console.error(chalk.red(String(error)));
      process.exit(1);
    }
  });

/**
 * Handle external execution from main CLI entry point
 */
async function handleDirectExternalExecutionMain(
  target: ExternalExecutionTarget | undefined,
  question: string,
  options: any,
  authService: AuthService,
  appInsightsService: AppInsightsService,
  aiService: AIService,
  configManager: ConfigManager
): Promise<void> {
  try {
    // Initialize AI service
    Visualizer.displayInfo('Initializing AI services...');
    await aiService.initialize();

    let kqlQuery: string;

    if (options.raw) {
      // Use question as raw KQL
      kqlQuery = question;
      Visualizer.displayInfo(`Using raw KQL query: ${kqlQuery}`);
    } else {
      // Generate KQL from natural language
      Visualizer.displayInfo(`Processing question: "${question}"`);

      // Retrieve schema (optional)
      let schema;
      try {
        schema = await appInsightsService.getSchema();
        logger.debug('Schema retrieved for query generation');
      } catch (error) {
        logger.warn('Could not retrieve schema, proceeding without it');
      }

      // Generate KQL query
      const nlQuery = await aiService.generateKQLQuery(question, schema);
      kqlQuery = nlQuery.generatedKQL;

      Visualizer.displayKQLQuery(nlQuery.generatedKQL, nlQuery.confidence);

      // Validate query
      const validation = await aiService.validateQuery(nlQuery.generatedKQL);
      if (!validation.isValid) {
        Visualizer.displayError(`Generated query is invalid: ${validation.error}`);
        return;
      }
    }

    // Set up external execution service with enhanced configuration
    const azureResourceInfo = await getEnhancedAzureResourceInfo();
    
    if (!azureResourceInfo) {
      Visualizer.displayError('External execution requires Azure resource configuration. Application ID must be configured and resource discoverable via Azure Resource Graph.');
      return;
    }

    const externalExecutionService = new ExternalExecutionService(azureResourceInfo);

    // Validate configuration
    const validation = externalExecutionService.validateConfiguration();
    if (!validation.isValid) {
      Visualizer.displayError(`External execution configuration is incomplete. Missing: ${validation.missingFields.join(', ')}`);
      return;
    }

    if (target) {
      // Direct target execution
      const availableOptions = externalExecutionService.getAvailableOptions();
      const isTargetAvailable = availableOptions.some(option => option.target === target);

      if (!isTargetAvailable) {
        if (target === 'dataexplorer') {
          Visualizer.displayError('Azure Data Explorer execution is not available. Please configure cluster information.');
        } else {
          Visualizer.displayError(`External execution target '${target}' is not available.`);
        }
        return;
      }

      // Execute externally
      const result = await externalExecutionService.executeExternal(target, kqlQuery, true);

      if (result.launched) {
        const targetName = target === 'portal' ? 'Azure Portal' : 'Azure Data Explorer';
        console.log(chalk.green(`\n✅ Successfully opened query in ${targetName}`));
        console.log(chalk.dim('The query has been opened in your default browser.'));
      } else {
        Visualizer.displayError(`Failed to open external tool: ${result.error}`);
        console.log(chalk.cyan('\n💡 You can manually copy and paste the URL above to access the query.'));
      }
    } else {
      // Interactive selection (--external option)
      const inquirer = await import('inquirer');
      
      console.log(chalk.blue.bold('\n🌐 External Query Execution'));
      console.log(chalk.dim('='.repeat(50)));

      const availableOptions = externalExecutionService.getAvailableOptions();
      
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
        name: '❌ Cancel',
        value: 'cancel' as any,
        short: 'Cancel' as any
      });

      const { selectedTarget } = await inquirer.default.prompt([
        {
          type: 'list',
          name: 'selectedTarget',
          message: 'Select external execution target:',
          choices: choices,
          pageSize: 8
        }
      ]) as { selectedTarget: string };

      if (selectedTarget === 'cancel') {
        return;
      }

      // Execute in selected external tool
      const result = await externalExecutionService.executeExternal(selectedTarget as any, kqlQuery, true);

      if (result.launched) {
        const targetName = selectedTarget === 'portal' ? 'Azure Portal' : 'Azure Data Explorer';
        console.log(chalk.green(`\n✅ Successfully opened query in ${targetName}`));
        console.log(chalk.dim('The query has been opened in your default browser.'));
      } else {
        Visualizer.displayError(`Failed to open external tool: ${result.error}`);
        console.log(chalk.cyan('\n💡 You can manually copy and paste the URL above to access the query.'));
      }
    }

  } catch (error) {
    logger.error('External execution failed:', error);
    Visualizer.displayError(`External execution failed: ${error}`);
    process.exit(1);
  }
}

async function executeDirectQuery(question: string, options: any): Promise<void> {
  try {
    const configManager = new ConfigManager();

    if (!configManager.validateConfig()) {
      Visualizer.displayError('Configuration is invalid. Please run "aidx setup" first.');
      process.exit(1);
    }

    const authService = new AuthService();
    const appInsightsService = new AppInsightsService(authService, configManager);
    const aiService = new AIService(authService, configManager);

    // Handle external execution options
    if (options.openPortal || options.openDataexplorer || options.external) {
      await handleDirectExternalExecutionMain(
        options.openPortal ? 'portal' : options.openDataexplorer ? 'dataexplorer' : undefined,
        question,
        options,
        authService,
        appInsightsService,
        aiService,
        configManager
      );
      return;
    }

    const startTime = Date.now();

    if (options.raw) {
      Visualizer.displayInfo(`Executing raw KQL query: ${question}`);
      const result = await appInsightsService.executeQuery(question);
      const executionTime = Date.now() - startTime;

      await handleOutput(result, options, executionTime);
    } else {
      Visualizer.displayInfo(`Processing question: "${question}"`);

      Visualizer.displayInfo('Initializing AI services...');
      await aiService.initialize();

      // Retrieve schema (optional)
      let schema;
      try {
        schema = await appInsightsService.getSchema();
        logger.debug('Schema retrieved for query generation');
      } catch (_error) {
        logger.warn('Could not retrieve schema, proceeding without it');
      }

      // Generate KQL query
      const nlQuery = await aiService.generateKQLQuery(question, schema);

      // Step execution mode or row confidence
      const shouldUseStepMode = !options.direct && nlQuery.confidence < 0.7;

      if (shouldUseStepMode) {
        const stepExecutionService = new StepExecutionService(aiService, appInsightsService, {
          showConfidenceThreshold: 0.7,
          allowEditing: true,
          maxRegenerationAttempts: 3
        });

        if (options.language) {
          const config = configManager.getConfig();
          config.language = options.language;
        }

        const result = await stepExecutionService.executeStepByStep(nlQuery, question);

        if (result) {
          const executionTime = Date.now() - startTime;
          await handleOutput(result, options, executionTime);
        }
        return;
      }

      // Normal execution (high confidence case)
      Visualizer.displayKQLQuery(nlQuery.generatedKQL, nlQuery.confidence);

      // Validate query
      const validation = await aiService.validateQuery(nlQuery.generatedKQL);
      if (!validation.isValid) {
        Visualizer.displayError(`Generated query is invalid: ${validation.error}`);
        return;
      }

      // Execute query
      const result = await appInsightsService.executeQuery(nlQuery.generatedKQL);
      const executionTime = Date.now() - startTime;

      await handleOutput(result, options, executionTime);
    }
  } catch (error) {
    logger.error('Query execution failed:', error);
    Visualizer.displayError(`Query failed: ${error}`);
    process.exit(1);
  }
}

function showWelcomeMessage(): void {
  console.log(chalk.bold.blue('\n🔍 Welcome to AppInsights Detective!'));
  console.log(chalk.dim('Query your Application Insights data with natural language.\n'));

  console.log('Quick start:');
  console.log(chalk.cyan('  aidx setup') + chalk.dim('                    # Configure your settings'));
  console.log(chalk.cyan('  aidx status') + chalk.dim('                   # Check configuration status'));
  console.log(chalk.cyan('  aidx "show me errors"') + chalk.dim('        # Ask a question (auto step-mode for low confidence)'));
  console.log(chalk.cyan('  aidx --direct "show me errors"') + chalk.dim(' # Direct execution (bypass step-mode)'));
  console.log(chalk.cyan('  aidx --language ja "errors"') + chalk.dim('   # Japanese explanations'));
  console.log(chalk.cyan('  aidx --interactive') + chalk.dim('           # Full interactive session'));
  console.log(chalk.cyan('  aidx --raw "requests | take 5"') + chalk.dim(' # Raw KQL query'));
  console.log('');
  console.log('External execution:');
  console.log(chalk.cyan('  aidx --external "show me errors"') + chalk.dim('        # Interactive external tool selection'));
  console.log(chalk.cyan('  aidx --open-portal "show me errors"') + chalk.dim('     # Open directly in Azure Portal'));
  console.log(chalk.cyan('  aidx --open-dataexplorer "errors"') + chalk.dim('      # Open in Azure Data Explorer'));
  console.log('');
  console.log('Output formats:');
  console.log(chalk.cyan('  aidx "errors" --format json') + chalk.dim('                          # Display JSON to console'));
  console.log(chalk.cyan('  aidx "errors" --format csv') + chalk.dim('                           # Display CSV to console'));
  console.log(chalk.cyan('  aidx "errors" --output data.json --format json') + chalk.dim('       # Save to JSON file'));
  console.log(chalk.cyan('  aidx "errors" --output data.csv --format csv') + chalk.dim('         # Save to CSV file'));
  console.log(chalk.cyan('  aidx "errors" --output data.tsv --format tsv --pretty') + chalk.dim(' # Save to TSV with pretty printing'));
  console.log(chalk.cyan('  aidx "errors" --output out.json --format json --encoding utf16le') + chalk.dim(' # Custom encoding'));
  console.log('\nFor more help, use: aidx --help');
}

// エラーハンドリング
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  console.error(chalk.red.bold('❌ An unexpected error occurred:'));
  console.error(chalk.red(error.message));
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  console.error(chalk.red.bold('❌ An unexpected error occurred:'));
  console.error(chalk.red(String(reason)));
  process.exit(1);
});

// ウェルカムメッセージ（引数なしで実行された場合）
if (process.argv.length === 2) {
  showWelcomeMessage();
}

export { program };

// CLI実行時のエントリーポイント
if (require.main === module) {
  program.parse(process.argv);
}
