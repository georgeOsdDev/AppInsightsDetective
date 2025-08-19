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
import { ConfigManager } from '../utils/config';
import { Visualizer } from '../utils/visualizer';
import { OutputFormatter } from '../utils/outputFormatter';
import { FileOutputManager } from '../utils/fileOutput';
import { OutputFormat } from '../types';

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
      Visualizer.displayResult(result);
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
              label: row[0],
              value: Number(row[1]) || 0,
            }));
            Visualizer.displayChart(chartData, 'bar');
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
      Visualizer.displayResult(result);
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
              label: row[0],
              value: Number(row[1]) || 0,
            }));
            Visualizer.displayChart(chartData, 'bar');
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
        Visualizer.displayResult(result);
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
  .option('-f, --format <format>', 'Output format (table, json, csv, tsv, raw)', 'table')
  .option('-o, --output <file>', 'Output file path')
  .option('--pretty', 'Pretty print JSON output')
  .option('--no-headers', 'Exclude headers in CSV/TSV output')
  .option('--encoding <encoding>', 'File encoding (utf8, utf16le, etc.)', 'utf8')
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
