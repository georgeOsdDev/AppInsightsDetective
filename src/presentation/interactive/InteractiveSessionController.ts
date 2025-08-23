import inquirer from 'inquirer';
import chalk from 'chalk';
import { 
  ISessionController, 
  SessionOptions 
} from '../../core/interfaces/ISessionController';
import { 
  IQueryOrchestrator, 
  QueryExecutionRequest 
} from '../../core/interfaces/IQueryOrchestrator';
import { IOutputRenderer } from '../../core/interfaces/IOutputRenderer';
import { Visualizer } from '../../utils/visualizer';
import { logger } from '../../utils/logger';

/**
 * Interactive session controller for handling user interaction and UI/UX
 */
export class InteractiveSessionController implements ISessionController {
  constructor(
    private queryOrchestrator: IQueryOrchestrator,
    private outputRenderer: IOutputRenderer,
    private options: SessionOptions = {}
  ) {}

  async startSession(): Promise<void> {
    console.log(chalk.blue.bold('\\n🔍 AppInsights Detective - Interactive Mode 🕵'));
    console.log(chalk.dim('Ask questions about your application in natural language'));
    console.log(chalk.dim('Type "exit" or "quit" to end the session'));

    // Session loop
    while (true) {
      try {
        const { question } = await inquirer.prompt([
          {
            type: 'input',
            name: 'question',
            message: chalk.cyan('❓ What would you like to know?'),
            validate: (input) => {
              if (!input.trim()) {
                return 'Please enter a question or query';
              }
              return true;
            }
          }
        ]);

        if (this.isExitCommand(question)) {
          console.log(chalk.green('👋 Thanks for using AppInsights Detective!'));
          break;
        }

        await this.processUserInput(question.trim());

        console.log(chalk.dim('\\n' + '='.repeat(60) + '\\n'));

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

  async processUserInput(input: string): Promise<void> {
    try {
      // Determine if this is a raw KQL query or natural language
      const isRawKQL = this.detectRawKQL(input);
      
      let mode: 'direct' | 'step' | 'raw';
      
      if (isRawKQL) {
        mode = 'raw';
      } else {
        mode = await this.selectExecutionMode();
      }

      // Create execution request
      const request: QueryExecutionRequest = {
        mode,
        ...(mode === 'raw' ? { rawQuery: input } : { naturalLanguageQuery: input })
      };

      // Execute query
      let result;
      if (mode === 'raw') {
        result = await this.queryOrchestrator.executeRawQuery(input);
      } else if (mode === 'step') {
        result = await this.queryOrchestrator.executeStepByStepQuery(input);
        if (!result) {
          Visualizer.displayInfo('Query execution was cancelled.');
          return;
        }
      } else {
        result = await this.queryOrchestrator.executeNaturalLanguageQuery(request);
      }

      // Render and display results
      await this.displayResults(result);

    } catch (error) {
      logger.error('Failed to process user input:', error);
      Visualizer.displayError(`Query failed: ${error}`);
    }
  }

  async selectExecutionMode(): Promise<'direct' | 'step' | 'raw'> {
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
          }
        ],
        default: this.options.defaultMode || 'step' // Default is step mode
      }
    ]);

    return mode;
  }

  async endSession(): Promise<void> {
    console.log(chalk.blue('\\n📊 Session Summary:'));
    console.log(chalk.dim('Thank you for using AppInsights Detective!'));
    console.log(chalk.dim('Visit https://github.com/georgeOsdDev/AppInsightsDetective for more information.'));
  }

  private isExitCommand(input: string): boolean {
    const exitCommands = ['exit', 'quit', 'q', 'bye'];
    return exitCommands.includes(input.toLowerCase());
  }

  private detectRawKQL(input: string): boolean {
    // Simple heuristics to detect KQL queries
    const kqlKeywords = [
      'requests', 'dependencies', 'exceptions', 'pageViews', 'customEvents',
      'traces', 'performanceCounters', 'availabilityResults',
      '|', 'where', 'summarize', 'project', 'extend', 'join', 'union'
    ];

    const lowerInput = input.toLowerCase();
    const containsKQLKeywords = kqlKeywords.some(keyword => lowerInput.includes(keyword));
    const containsPipe = input.includes('|');
    const startsWithTable = /^\\s*(requests|dependencies|exceptions|pageViews|customEvents|traces|performanceCounters|availabilityResults)\\b/i.test(input);

    return containsPipe || startsWithTable || (containsKQLKeywords && input.length > 20);
  }

  private async displayResults(result: any): Promise<void> {
    try {
      // Display query information
      if (result.nlQuery) {
        console.log(chalk.blue.bold('\\n🤖 Generated Query:'));
        console.log(chalk.white(result.nlQuery.generatedKQL));
        console.log(chalk.dim(`💡 Reasoning: ${result.nlQuery.reasoning}`));
        console.log(chalk.dim(`🎯 Confidence: ${Math.round(result.nlQuery.confidence * 100)}%`));
      }

      // Render and display query results
      const renderedOutput = await this.outputRenderer.renderQueryResult(
        result.result,
        {
          format: this.options.outputFormat || 'table',
          outputFile: this.options.outputFile,
          prettyJson: this.options.prettyJson,
          includeHeaders: this.options.includeHeaders
        }
      );

      this.outputRenderer.displayInConsole(renderedOutput);

      // Display analysis results if available
      if (result.analysisResult) {
        console.log('\\n');
        const analysisOutput = await this.outputRenderer.renderAnalysisResult(result.analysisResult);
        this.outputRenderer.displayInConsole(analysisOutput);
      }

      // Display execution time
      console.log(chalk.green(`\\n⚡ Query executed in ${result.executionTime}ms`));

      // Offer additional actions
      await this.offerAdditionalActions(result);

    } catch (error) {
      logger.error('Failed to display results:', error);
      Visualizer.displayError(`Failed to display results: ${error}`);
    }
  }

  private async offerAdditionalActions(result: any): Promise<void> {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do next?',
        choices: [
          { name: '🔍 Ask another question', value: 'continue' },
          { name: '📊 Analyze results in detail', value: 'analyze' },
          { name: '💾 Export results', value: 'export' },
          { name: '❌ Continue to next query', value: 'skip' }
        ],
        default: 'continue'
      }
    ]);

    switch (action) {
      case 'analyze':
        await this.performDetailedAnalysis(result);
        break;
      case 'export':
        await this.exportResults(result);
        break;
      case 'skip':
      case 'continue':
      default:
        // Continue to next iteration
        break;
    }
  }

  private async performDetailedAnalysis(result: any): Promise<void> {
    try {
      console.log(chalk.blue.bold('\\n🧠 Performing detailed analysis...'));
      
      const analysisResult = await this.queryOrchestrator.analyzeResults(result.result, 'full');
      const analysisOutput = await this.outputRenderer.renderAnalysisResult(analysisResult);
      
      this.outputRenderer.displayInConsole(analysisOutput);
    } catch (error) {
      logger.error('Failed to perform detailed analysis:', error);
      Visualizer.displayError(`Analysis failed: ${error}`);
    }
  }

  private async exportResults(result: any): Promise<void> {
    try {
      const { format, filename } = await inquirer.prompt([
        {
          type: 'list',
          name: 'format',
          message: 'Select export format:',
          choices: [
            { name: '📄 JSON', value: 'json' },
            { name: '📊 CSV', value: 'csv' },
            { name: '📋 TSV', value: 'tsv' },
            { name: '📑 Table', value: 'table' }
          ]
        },
        {
          type: 'input',
          name: 'filename',
          message: 'Enter filename (optional):',
          default: `appinsights-results-${new Date().getTime()}`
        }
      ]);

      const extension = format === 'json' ? 'json' : 
                      format === 'csv' ? 'csv' :
                      format === 'tsv' ? 'tsv' : 'txt';
      
      const fullFilename = `${filename}.${extension}`;

      const renderedOutput = await this.outputRenderer.renderQueryResult(
        result.result,
        { 
          format, 
          outputFile: fullFilename,
          prettyJson: format === 'json'
        }
      );

      await this.outputRenderer.saveToFile(renderedOutput, fullFilename);
      console.log(chalk.green(`✅ Results exported to ${fullFilename}`));
    } catch (error) {
      logger.error('Failed to export results:', error);
      Visualizer.displayError(`Export failed: ${error}`);
    }
  }
}