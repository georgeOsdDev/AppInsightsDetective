import { Command } from 'commander';
import inquirer from 'inquirer';
import { AuthService } from '../../services/authService';
import { AppInsightsService } from '../../services/appInsightsService';
import { AIService } from '../../services/aiService';
import { StepExecutionService } from '../../services/stepExecutionService';
import { InteractiveService } from '../../services/interactiveService';
import { ExternalExecutionService } from '../../services/externalExecutionService';
import { ConfigManager } from '../../utils/config';
import { Visualizer } from '../../utils/visualizer';
import { OutputFormatter } from '../../utils/outputFormatter';
import { FileOutputManager } from '../../utils/fileOutput';
import { logger } from '../../utils/logger';
import { OutputFormat, QueryResult, AzureResourceInfo, ExternalExecutionTarget } from '../../types';
import chalk from 'chalk';

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
      resourceName: appInsights.resourceName
    };
  } catch (error) {
    logger.error('Failed to get enhanced Azure resource information:', error);
    return null;
  }
}

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
    // Determine if empty columns should be hidden (default: true, disabled with --show-empty-columns)
    const hideEmptyColumns = !options.showEmptyColumns;
    
    Visualizer.displayResult(result, { hideEmptyColumns });
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
        const hideEmptyColumns = !options.showEmptyColumns;
        Visualizer.displayResult(result, { hideEmptyColumns });
      }
    }
  }
}

/**
 * Handle direct external execution without interactive prompts
 */
async function handleDirectExternalExecution(
  target: ExternalExecutionTarget,
  queryText: string,
  options: any
): Promise<void> {
  try {
    const configManager = new ConfigManager();
    const authService = new AuthService();
    const appInsightsService = new AppInsightsService(authService, configManager);
    const aiService = new AIService(authService, configManager);

    // Initialize AI service
    Visualizer.displayInfo('Initializing AI services...');
    await aiService.initialize();

    let kqlQuery: string;

    if (options.raw) {
      // Use query text as raw KQL
      kqlQuery = queryText;
      Visualizer.displayInfo(`Using raw KQL query: ${kqlQuery}`);
    } else {
      // Generate KQL from natural language
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

    // Check if target is available
    const availableOptions = externalExecutionService.getAvailableOptions();
    const isTargetAvailable = availableOptions.some(option => option.target === target);

    if (!isTargetAvailable) {
      Visualizer.displayError(`External execution target '${target}' is not available.`);
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

  } catch (error) {
    logger.error('Direct external execution failed:', error);
    Visualizer.displayError(`External execution failed: ${error}`);
    process.exit(1);
  }
}

/**
 * Handle interactive external execution selection
 */
async function handleInteractiveExternalExecution(queryText: string, options: any): Promise<void> {
  try {
    const configManager = new ConfigManager();
    const authService = new AuthService();
    const appInsightsService = new AppInsightsService(authService, configManager);
    const aiService = new AIService(authService, configManager);

    // Initialize AI service
    Visualizer.displayInfo('Initializing AI services...');
    await aiService.initialize();

    let kqlQuery: string;

    if (options.raw) {
      // Use query text as raw KQL
      kqlQuery = queryText;
      Visualizer.displayInfo(`Using raw KQL query: ${kqlQuery}`);
    } else {
      // Generate KQL from natural language
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

    // Show interactive selection
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
    const result = await externalExecutionService.executeExternal(target as any, kqlQuery, true);

    if (result.launched) {
      const targetName = target === 'portal' ? 'Azure Portal' : 'Azure Data Explorer';
      console.log(chalk.green(`\n✅ Successfully opened query in ${targetName}`));
      console.log(chalk.dim('The query has been opened in your default browser.'));
    } else {
      Visualizer.displayError(`Failed to open external tool: ${result.error}`);
      console.log(chalk.cyan('\n💡 You can manually copy and paste the URL above to access the query.'));
    }

  } catch (error) {
    logger.error('Interactive external execution failed:', error);
    Visualizer.displayError(`External execution failed: ${error}`);
    process.exit(1);
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
    .option('--external', 'Show external execution options interactively')
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

        if (options.external) {
          await handleInteractiveExternalExecution(queryText, options);
          return;
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

            const stepResult = await stepExecutionService.executeStepByStep(nlQuery, queryText);

            if (stepResult) {
              await handleOutput(stepResult.result, options, stepResult.executionTime);
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
          const queryStartTime = Date.now();
          const result = await appInsightsService.executeQuery(nlQuery.generatedKQL);
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
