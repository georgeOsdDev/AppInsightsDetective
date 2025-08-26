import { Command } from 'commander';
import inquirer from 'inquirer';
import { Bootstrap } from '../../infrastructure/Bootstrap';
import { IAIProvider, IDataSourceProvider, IAuthenticationProvider } from '../../core/interfaces';
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

  // Handle console output based on format and output file options
  if (!outputFile) {
    // No output file specified - display to console
    if (outputFormat === 'table') {
      // Table format: use visualizer with charts
      const hideEmptyColumns = !options.showEmptyColumns;
      Visualizer.displayResult(result, { hideEmptyColumns });
      const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
      Visualizer.displaySummary(executionTime, totalRows);

      // Display simple chart for numeric data results (only for console table output)
      if (result.tables.length > 0 && result.tables[0].rows.length > 1) {
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
    } else {
      // Non-table format: display formatted output to console
      const formattedOutput = OutputFormatter.formatResult(result, outputFormat, {
        pretty: options.pretty,
        includeHeaders: !options.noHeaders
      });
      console.log(formattedOutput.content);
      
      const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
      Visualizer.displaySummary(executionTime, totalRows);
    }
  } else {
    // Output file specified - show table format to console if format is table
    if (outputFormat === 'table') {
      const hideEmptyColumns = !options.showEmptyColumns;
      Visualizer.displayResult(result, { hideEmptyColumns });
      const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
      Visualizer.displaySummary(executionTime, totalRows);

      // Display chart for table format
      if (result.tables.length > 0 && result.tables[0].rows.length > 1) {
        const firstTable = result.tables[0];
        if (firstTable.columns.length >= 2) {
          const hasNumericData = firstTable.rows.some(row =>
            typeof row[1] === 'number' || !isNaN(Number(row[1]))
          );

          if (hasNumericData) {
            const chartData = firstTable.rows.slice(0, 10).map(row => ({
              label: String(row[0] || ''),
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
      const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
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

export function createQueryCommand(): Command {
  const queryCommand = new Command('query');

  queryCommand
    .description('Query Application Insights with natural language')
    .argument('[question]', 'Natural language question to ask')
    .option('-r, --raw', 'Execute raw KQL query')
    .option('--no-cache', 'Disable query caching')
    .option('-f, --format <format>', 'Output format (table, json, csv, tsv, raw)', 'table')
    .option('-o, --output <file>', 'Output file path')
    .option('--pretty', 'Pretty print JSON output')
    .option('--no-headers', 'Exclude headers in CSV/TSV output')
    .option('--encoding <encoding>', 'File encoding (utf8, utf16le, etc.)', 'utf8')
    .option('--show-empty-columns', 'Show all columns including empty ones (default: hide empty columns)')
    .action(async (question, options) => {
      try {
        const configManager = new ConfigManager();

        if (!configManager.validateConfig()) {
          Visualizer.displayError('Configuration is invalid. Please run "aidx setup" first.');
          process.exit(1);
        }

        // Initialize providers using bootstrap
        const bootstrap = new Bootstrap();
        await bootstrap.initialize();
        const container = bootstrap.getContainer();

        // Get providers from container
        const aiProvider = container.resolve<IAIProvider>('aiProvider');
        const dataSourceProvider = container.resolve<IDataSourceProvider>('dataSourceProvider');
        const authProvider = container.resolve<IAuthenticationProvider>('authProvider');

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
          const result = await dataSourceProvider.executeQuery({ query: queryText });
          const executionTime = Date.now() - startTime;

          await handleOutput(result, options, executionTime);
        } else {
          // Generate KQL from natural language and execute
          Visualizer.displayInfo(`Processing question: "${queryText}"`);

          // Retrieve schema (optional)
          let schema;
          try {
            const schemaResult = await dataSourceProvider.getSchema();
            schema = schemaResult.schema;
            logger.debug('Schema retrieved for query generation');
          } catch (error) {
            logger.warn('Could not retrieve schema, proceeding without it');
          }

          // Generate KQL query
          const nlQuery = await aiProvider.generateQuery({ userInput: queryText, schema });

          // Determine execution mode
          const shouldUseStepMode = nlQuery.confidence < 0.7;

          if (shouldUseStepMode) {
            // Step execution mode (for low confidence or explicitly specified)
            // Use InteractiveSessionController through DI container
            const interactiveController = container.resolve<any>('interactiveSessionController');

            // Create a session and execute in step mode
            const session = await interactiveController.createSession({
              mode: 'step',
              language: 'auto'
            });

            console.log(chalk.blue.bold('\n🔍 Generated Query Review'));
            console.log(chalk.dim('='.repeat(50)));

            // Display the generated query
            console.log(chalk.cyan.bold('\n📝 Original Question:'));
            console.log(chalk.white(`  "${queryText}"`));

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
            const { action } = await inquirer.prompt([
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
              const queryStartTime = Date.now();
              const result = await dataSourceProvider.executeQuery({ query: nlQuery.generatedKQL });
              const executionTime = Date.now() - queryStartTime;
              await handleOutput(result, options, executionTime);
              return;
            }

            // For other actions, we need to implement them later or show a message
            console.log(chalk.yellow(`Action "${action}" is not yet implemented in the simplified mode.`));
            console.log(chalk.cyan('Executing query instead...'));
            
            const queryStartTime = Date.now();
            const result = await dataSourceProvider.executeQuery({ query: nlQuery.generatedKQL });
            const executionTime = Date.now() - queryStartTime;
            await handleOutput(result, options, executionTime);
            return;
          }

          // Normal execution (high confidence)
          Visualizer.displayKQLQuery(nlQuery.generatedKQL, nlQuery.confidence);

          // Validate query - for now use basic validation
          if (!nlQuery.generatedKQL || nlQuery.generatedKQL.trim() === '') {
            Visualizer.displayError('Generated query is empty or invalid');
            return;
          }

          // Execute query
          const queryStartTime = Date.now();
          const result = await dataSourceProvider.executeQuery({ query: nlQuery.generatedKQL });
          const executionTime = Date.now() - queryStartTime;

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
