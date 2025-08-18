import { Command } from 'commander';
import inquirer from 'inquirer';
import { AuthService } from '../../services/authService';
import { AppInsightsService } from '../../services/appInsightsService';
import { AIService } from '../../services/aiService';
import { StepExecutionService } from '../../services/stepExecutionService';
import { InteractiveService } from '../../services/interactiveService';
import { ConfigManager } from '../../utils/config';
import { Visualizer } from '../../utils/visualizer';
import { OutputFormatter } from '../../utils/outputFormatter';
import { FileOutputManager } from '../../utils/fileOutput';
import { logger } from '../../utils/logger';
import { OutputFormat, QueryResult } from '../../types';
import chalk from 'chalk';

/**
 * Handle output formatting and file writing
 */
async function handleOutput(result: QueryResult, options: any, executionTime: number): Promise<void> {
  const outputFormat = options.format as OutputFormat;
  const outputFile = options.output as string | undefined;
  const encoding = FileOutputManager.isValidEncoding(options.encoding) ? options.encoding : 'utf8';

  // Validate format
  const validFormats: OutputFormat[] = ['table', 'json', 'csv', 'tsv', 'raw'];
  if (!validFormats.includes(outputFormat)) {
    logger.warn(`Invalid format '${outputFormat}', defaulting to table`);
    options.format = 'table';
  }

  // Always show console output for table format or when no file is specified
  if (outputFormat === 'table' || !outputFile) {
    Visualizer.displayResult(result);
    const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
    Visualizer.displaySummary(executionTime, totalRows);

    // Display simple chart for numeric data results (only for console table output)
    if (outputFormat === 'table' && result.tables.length > 0 && result.tables[0].rows.length > 1) {
      const firstTable = result.tables[0];
      if (firstTable.columns.length >= 2) {
        const hasNumericData = firstTable.rows.some(row =>
          typeof row[1] === 'number' || !isNaN(Number(row[1]))
        );

        if (hasNumericData) {
          const chartData = firstTable.rows.slice(0, 10).map(row => ({
            label: row[0],
            value: Number(row[1]) || 0,
          }));
          Visualizer.displayChart(chartData, 'bar');
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
      const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
      console.log(chalk.green(`✅ Successfully saved ${totalRows} rows to ${resolvedPath}`));
      
      // Show execution summary if not already shown
      if (outputFormat !== 'table') {
        Visualizer.displaySummary(executionTime, totalRows);
      }

    } catch (error) {
      logger.error('File output failed:', error);
      Visualizer.displayError(`Failed to save to file: ${error}`);
      
      // Fallback to console output
      if (outputFormat !== 'table') {
        console.log(chalk.yellow('Falling back to console output:'));
        Visualizer.displayResult(result);
      }
    }
  }
}

export function createQueryCommand(): Command {
  const queryCommand = new Command('query');

  queryCommand
    .description('Query Application Insights with natural language')
    .argument('[question]', 'Natural language question to ask')
    .option('-l, --language <language>', 'Language for explanations (en, ja, ko, zh, es, fr, de, etc.)')
    .option('-r, --raw', 'Execute raw KQL query')
    .option('--direct', 'Execute query directly without confirmation (bypass step mode)')
    .option('--no-cache', 'Disable query caching')
    .option('-f, --format <format>', 'Output format (table, json, csv, tsv, raw)', 'table')
    .option('-o, --output <file>', 'Output file path')
    .option('--pretty', 'Pretty print JSON output')
    .option('--no-headers', 'Exclude headers in CSV/TSV output')
    .option('--encoding <encoding>', 'File encoding (utf8, utf16le, etc.)', 'utf8')
    .action(async (question, options) => {
      try {
        const configManager = new ConfigManager();

        if (!configManager.validateConfig()) {
          Visualizer.displayError('Configuration is invalid. Please run "aidx setup" first.');
          process.exit(1);
        }

        const authService = new AuthService();
        const appInsightsService = new AppInsightsService(authService, configManager);
        const aiService = new AIService(authService, configManager);

        let queryText = question;

        // If no question is provided, prompt for a single question
        if (!queryText) {
          const response = await inquirer.prompt([
            {
              type: 'input',
              name: 'question',
              message: 'What would you like to know about your application?',
              validate: (input: string) => input.length > 0 || 'Please enter a question',
            },
          ]);
          queryText = response.question;
        }

        const startTime = Date.now();

        if (options.raw) {
          // Execute as raw KQL query
          Visualizer.displayInfo(`Executing raw KQL query: ${queryText}`);
          const result = await appInsightsService.executeQuery(queryText);
          const executionTime = Date.now() - startTime;

          await handleOutput(result, options, executionTime);
        } else {
          // Generate KQL from natural language and execute
          Visualizer.displayInfo(`Processing question: "${queryText}"`);

          // Retrieve schema (optional)
          let schema;
          try {
            schema = await appInsightsService.getSchema();
            logger.debug('Schema retrieved for query generation');
          } catch (error) {
            logger.warn('Could not retrieve schema, proceeding without it');
          }

          // Generate KQL query
          const nlQuery = await aiService.generateKQLQuery(queryText, schema);

          // Determine execution mode
          const shouldUseStepMode = !options.direct && nlQuery.confidence < 0.7;

          if (shouldUseStepMode) {
            // Step execution mode (for low confidence or explicitly specified)
            const stepExecutionService = new StepExecutionService(aiService, appInsightsService, {
              showConfidenceThreshold: 0.7,
              allowEditing: true,
              maxRegenerationAttempts: 3
            });

            // Pass language settings
            if (options.language) {
              const config = configManager.getConfig();
              config.language = options.language;
            }

            const result = await stepExecutionService.executeStepByStep(nlQuery, queryText);

            if (result) {
              const executionTime = Date.now() - startTime;
              await handleOutput(result, options, executionTime);
            }
            return;
          }

          // Normal execution (high confidence)
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
    });

  return queryCommand;
}
