import { Command } from 'commander';
import inquirer from 'inquirer';
import { AuthService } from '../../services/authService';
import { AppInsightsService } from '../../services/appInsightsService';
import { AIService } from '../../services/aiService';
import { StepExecutionService } from '../../services/stepExecutionService';
import { ConfigManager } from '../../utils/config';
import { Visualizer } from '../../utils/visualizer';
import { logger } from '../../utils/logger';

export function createQueryCommand(): Command {
  const queryCommand = new Command('query');

  queryCommand
    .description('Query Application Insights with natural language')
    .argument('[question]', 'Natural language question to ask')
    .option('-i, --interactive', 'Run in interactive mode')
    .option('-s, --step', 'Enable step-by-step execution with user confirmation')
    .option('-r, --raw', 'Execute raw KQL query')
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

        // インタラクティブモードまたは質問が提供されていない場合
        if (options.interactive || !queryText) {
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
          // 生のKQLクエリとして実行
          Visualizer.displayInfo(`Executing raw KQL query: ${queryText}`);
          const result = await appInsightsService.executeQuery(queryText);
          const executionTime = Date.now() - startTime;

          Visualizer.displayResult(result);
          const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
          Visualizer.displaySummary(executionTime, totalRows);
        } else {
          // 自然言語からKQLを生成して実行
          Visualizer.displayInfo(`Processing question: "${queryText}"`);

          // スキーマを取得（オプション）
          let schema;
          try {
            schema = await appInsightsService.getSchema();
            logger.debug('Schema retrieved for query generation');
          } catch (error) {
            logger.warn('Could not retrieve schema, proceeding without it');
          }

          // KQLクエリを生成
          const nlQuery = await aiService.generateKQLQuery(queryText, schema);

          // ステップ実行モードまたは信頼度が低い場合
          if (options.step || nlQuery.confidence < 0.7) {
            const stepExecutionService = new StepExecutionService(aiService, appInsightsService, {
              showConfidenceThreshold: 0.7,
              allowEditing: true,
              maxRegenerationAttempts: 3
            });

            const result = await stepExecutionService.executeStepByStep(nlQuery, queryText);

            if (result) {
              const executionTime = Date.now() - startTime;
              Visualizer.displayResult(result);
              const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
              Visualizer.displaySummary(executionTime, totalRows);

              // 結果が数値データの場合、簡単なチャートを表示
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

          // 通常の実行（高い信頼度の場合）
          Visualizer.displayKQLQuery(nlQuery.generatedKQL, nlQuery.confidence);

          // クエリを検証
          const validation = await aiService.validateQuery(nlQuery.generatedKQL);
          if (!validation.isValid) {
            Visualizer.displayError(`Generated query is invalid: ${validation.error}`);
            return;
          }

          // クエリを実行
          const result = await appInsightsService.executeQuery(nlQuery.generatedKQL);
          const executionTime = Date.now() - startTime;

          Visualizer.displayResult(result);
          const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
          Visualizer.displaySummary(executionTime, totalRows);

          // 結果が数値データの場合、簡単なチャートを表示
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
