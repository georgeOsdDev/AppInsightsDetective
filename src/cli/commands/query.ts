import { Command } from 'commander';
import inquirer from 'inquirer';
import { AuthService } from '../../services/authService';
import { AppInsightsService } from '../../services/appInsightsService';
import { AIService } from '../../services/aiService';
import { StepExecutionService } from '../../services/stepExecutionService';
import { InteractiveService } from '../../services/interactiveService';
import { ConfigManager } from '../../utils/config';
import { Visualizer } from '../../utils/visualizer';
import { logger } from '../../utils/logger';

export function createQueryCommand(): Command {
  const queryCommand = new Command('query');

  queryCommand
    .description('Query Application Insights with natural language')
    .argument('[question]', 'Natural language question to ask')
    .option('-l, --language <language>', 'Language for explanations (en, ja, ko, zh, es, fr, de, etc.)')
    .option('-r, --raw', 'Execute raw KQL query')
    .option('--direct', 'Execute query directly without confirmation (bypass step mode)')
    .option('--no-cache', 'Disable query caching')
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

          Visualizer.displayResult(result);
          const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
          Visualizer.displaySummary(executionTime, totalRows);
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
              Visualizer.displayResult(result);
              const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
              Visualizer.displaySummary(executionTime, totalRows);

              // Display simple chart for numeric data results
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

          Visualizer.displayResult(result);
          const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
          Visualizer.displaySummary(executionTime, totalRows);

          // Display simple chart for numeric data results
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
        }

      } catch (error) {
        logger.error('Query execution failed:', error);
        Visualizer.displayError(`Query failed: ${error}`);
        process.exit(1);
      }
    });

  return queryCommand;
}
