#!/usr/bin/env node

import { Command } from 'commander';
import { createSetupCommand } from './commands/setup';

import { createStatusCommand } from './commands/status';
import { createTemplateCommand } from './commands/template';
import { createListProvidersCommand } from './commands/listProviders';
import { createProvidersCommand } from './commands/providers';
import { logger } from '../utils/logger';
import chalk from 'chalk';
import { Bootstrap } from '../infrastructure/Bootstrap';
import { IAIProvider, IDataSourceProvider, IAuthenticationProvider } from '../core/interfaces';
import { QueryGenerationRequest } from '../core/interfaces/IAIProvider';
import { QueryExecutionRequest } from '../core/interfaces/IDataSourceProvider';
import { DataSourceType } from '../core/types/ProviderTypes';
import { InteractiveSessionController } from '../presentation/InteractiveSessionController';
import { QueryService } from '../services/QueryService';
import { ConfigManager } from '../utils/config';
import { Visualizer } from '../utils/visualizer';
import { OutputFormatter } from '../utils/outputFormatter';
import { FileOutputManager } from '../utils/fileOutput';
import { OutputFormat } from '../types';
import { detectTimeSeriesData } from '../utils/chart';

// Global bootstrap instance
let bootstrap: Bootstrap;

/**
 * Handle output formatting and file writing
 */
export async function handleOutput(result: any, options: any, executionTime: number): Promise<void> {
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
program.addCommand(createStatusCommand());
program.addCommand(createTemplateCommand());
program.addCommand(createListProvidersCommand());
program.addCommand(createProvidersCommand());

// Default Action
program
  .argument('[question]', 'Natural language question to ask')
  .option('-i, --interactive', 'Run in interactive mode with step-by-step guidance')
  .option('-r, --raw', 'Execute raw KQL query')
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

        // Initialize providers using bootstrap
        if (!bootstrap) {
          bootstrap = new Bootstrap();
          await bootstrap.initialize();
        }
        const container = bootstrap.getContainer();

        // Get interactive session controller from container
        const interactiveSessionController = container.resolve<InteractiveSessionController>('interactiveSessionController');
        
        // Set options from CLI to controller
        interactiveSessionController.setOptions({
          defaultMode: options.raw ? 'raw' : 'step'
        });

        await interactiveSessionController.startSession();
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

async function executeDirectQuery(question: string, options: any): Promise<void> {
  try {
    const configManager = new ConfigManager();

    if (!configManager.validateConfig()) {
      Visualizer.displayError('Configuration is invalid. Please run "aidx setup" first.');
      process.exit(1);
    }

    // Initialize the bootstrap container
    if (!bootstrap) {
      bootstrap = new Bootstrap();
      await bootstrap.initialize();
    }
    const container = bootstrap.getContainer();

    // Get providers from container
    const aiProvider = container.resolve<IAIProvider>('aiProvider');
    const dataSourceProvider = container.resolve<IDataSourceProvider>('dataSourceProvider');

    const startTime = Date.now();

    if (options.raw) {
      Visualizer.displayInfo(`Executing raw KQL query: ${question}`);
      const result = await dataSourceProvider.executeQuery({ query: question });
      const executionTime = Date.now() - startTime;

      await handleOutput(result, options, executionTime);
    } else {
      Visualizer.displayInfo(`Processing question: "${question}"`);

      Visualizer.displayInfo('Initializing AI services...');
      await aiProvider.initialize();

      // Retrieve schema (optional)
      let schema;
      try {
        const schemaResult = await dataSourceProvider.getSchema();
        schema = schemaResult.schema;
        logger.debug('Schema retrieved for query generation');
      } catch (_error) {
        logger.warn('Could not retrieve schema, proceeding without it');
      }

      // Get data source type from configuration
      const config = configManager.getConfig();
      const dataSourceType = config.providers.dataSources.default as DataSourceType;

      // Generate KQL query
      const nlQuery = await aiProvider.generateQuery({
        userInput: question,
        schema,
        dataSourceType
      });

      // Step execution mode for low confidence
      const shouldUseStepMode = nlQuery.confidence < 0.7;

      if (shouldUseStepMode) {
        console.log(chalk.blue.bold('\n🔍 Generated Query Review'));
        console.log(chalk.dim('='.repeat(50)));

        // Display the generated query
        console.log(chalk.cyan.bold('\n📝 Original Question:'));
        console.log(chalk.white(`  "${question}"`));

        Visualizer.displayKQLQuery(nlQuery.generatedKQL, nlQuery.confidence);

        if (nlQuery.reasoning) {
          console.log(chalk.cyan.bold('\n💭 AI Reasoning:'));
          console.log(chalk.dim(`  ${nlQuery.reasoning}`));
        }

        // Show confidence warning
        if (nlQuery.confidence < 0.7) {
          console.log(chalk.yellow.bold('\n⚠️  Low Confidence Warning:'));
          console.log(chalk.yellow('  This query has low confidence. Consider reviewing or regenerating it.'));
        }

        // Ask user what to do
        const inquirer = await import('inquirer');
        const { action } = await inquirer.default.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'What would you like to do with this query?',
            choices: [
              { name: '🚀 Execute Query - Run this KQL query', value: 'execute' },
              { name: '📖 Explain Query - Get detailed explanation', value: 'explain' },
              { name: '🔄 Regenerate Query - Generate a different approach', value: 'regenerate' },
              { name: '✏️  Edit Query - Manually modify the query', value: 'edit' },
              { name: '❌ Cancel - Stop execution', value: 'cancel' }
            ]
          }
        ]);

        if (action === 'cancel') {
          console.log(chalk.yellow('Query execution cancelled.'));
          return;
        }

        if (action === 'execute') {
          // Execute the query normally
          const result = await dataSourceProvider.executeQuery({ query: nlQuery.generatedKQL });
          const executionTime = Date.now() - startTime;
          await handleOutput(result, options, executionTime);
          return;
        }

        // For other actions, we need to implement them later or show a message
        console.log(chalk.yellow(`Action "${action}" is not yet implemented in the simplified mode.`));
        console.log(chalk.cyan('Executing query instead...'));
        
        const result = await dataSourceProvider.executeQuery({ query: nlQuery.generatedKQL });
        const executionTime = Date.now() - startTime;
        await handleOutput(result, options, executionTime);
        return;
      } else {
        // Normal execution (high confidence) - display the generated query
        Visualizer.displayKQLQuery(nlQuery.generatedKQL, nlQuery.confidence);
      }

      // Execute query
      const result = await dataSourceProvider.executeQuery({ query: nlQuery.generatedKQL });
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
  console.log(chalk.cyan('  aidx --interactive') + chalk.dim('           # Full interactive session'));
  console.log(chalk.cyan('  aidx --raw "requests | take 5"') + chalk.dim(' # Raw KQL query'));
  console.log('');
  console.log('Provider management:');
  console.log(chalk.cyan('  aidx list-providers') + chalk.dim('                     # List available providers'));
  console.log(chalk.cyan('  aidx providers show') + chalk.dim('                    # Show current provider configuration'));
  console.log(chalk.cyan('  aidx providers set-default ai openai') + chalk.dim('  # Switch AI provider'));
  console.log(chalk.cyan('  aidx providers configure ai azure-openai') + chalk.dim(' # Configure specific provider'));
  console.log('');
  console.log('Template management:');
  console.log(chalk.cyan('  aidx template list') + chalk.dim('                     # List available templates'));
  console.log(chalk.cyan('  aidx template use <templateId>') + chalk.dim('        # Use a template'));
  console.log(chalk.cyan('  aidx template create') + chalk.dim('                  # Create new template'));
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
