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

      Visualizer.displayResult(result);
      const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
      Visualizer.displaySummary(executionTime, totalRows);
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
          Visualizer.displayResult(result);
          const totalRows = result.tables.reduce((sum: number, table: any) => sum + table.rows.length, 0);
          Visualizer.displaySummary(executionTime, totalRows);

          // Display simple chart for numeric data results
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
