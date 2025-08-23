import { 
  IOutputRenderer, 
  RenderOptions, 
  RenderedOutput 
} from '../../core/interfaces/IOutputRenderer';
import { QueryResult, AnalysisResult, OutputFormat } from '../../types';
import { Visualizer } from '../../utils/visualizer';
import { OutputFormatter } from '../../utils/outputFormatter';
import { FileOutputManager } from '../../utils/fileOutput';
import { detectTimeSeriesData } from '../../utils/chart';
import { logger } from '../../utils/logger';
import chalk from 'chalk';

/**
 * Console-based output renderer implementation
 */
export class ConsoleOutputRenderer implements IOutputRenderer {
  private outputFormatter: OutputFormatter;
  private fileOutputManager: FileOutputManager;

  constructor() {
    this.outputFormatter = new OutputFormatter();
    this.fileOutputManager = new FileOutputManager();
  }

  async renderQueryResult(
    result: QueryResult,
    options: RenderOptions = {}
  ): Promise<RenderedOutput> {
    const format = options.format || 'table';
    const timestamp = new Date();

    try {
      // Format the data using OutputFormatter
      const formattedData = OutputFormatter.formatResult(result, format, {
        pretty: options.prettyJson,
        includeHeaders: options.includeHeaders
      });

      // Prepare rendered output
      const renderedOutput: RenderedOutput = {
        content: formattedData.content,
        metadata: {
          format,
          timestamp,
          rowCount: result.tables.reduce((sum, table) => sum + table.rows.length, 0),
          outputFile: options.outputFile
        }
      };

      // Save to file if requested
      if (options.outputFile) {
        await this.saveToFile(renderedOutput, options.outputFile);
        renderedOutput.metadata.outputFile = options.outputFile;
      }

      return renderedOutput;
    } catch (error) {
      logger.error('Failed to render query result:', error);
      throw new Error(`Failed to render query result: ${error}`);
    }
  }

  async renderAnalysisResult(
    analysis: AnalysisResult,
    options: RenderOptions = {}
  ): Promise<RenderedOutput> {
    const format = options.format || 'table';
    const timestamp = new Date();

    try {
      // Use Visualizer to format analysis results
      let content: string;
      
      if (format === 'json') {
        content = JSON.stringify(analysis, null, options.prettyJson ? 2 : 0);
      } else {
        // Capture console output from Visualizer
        const originalConsoleLog = console.log;
        const capturedOutput: string[] = [];
        
        console.log = (...args: any[]) => {
          capturedOutput.push(args.join(' '));
        };

        try {
          Visualizer.displayAnalysisResult(analysis, 'analysis');
          content = capturedOutput.join('\\n');
        } finally {
          console.log = originalConsoleLog;
        }
      }

      const renderedOutput: RenderedOutput = {
        content,
        metadata: {
          format,
          timestamp,
          rowCount: 0, // Analysis doesn't have row count
          outputFile: options.outputFile
        }
      };

      // Save to file if requested
      if (options.outputFile) {
        await this.saveToFile(renderedOutput, options.outputFile);
        renderedOutput.metadata.outputFile = options.outputFile;
      }

      return renderedOutput;
    } catch (error) {
      logger.error('Failed to render analysis result:', error);
      throw new Error(`Failed to render analysis result: ${error}`);
    }
  }

  async saveToFile(output: RenderedOutput, filePath: string): Promise<void> {
    try {
      const formattedOutput = {
        content: output.content,
        extension: this.getFileExtension(output.metadata.format),
        mimeType: this.getMimeType(output.metadata.format)
      };

      await FileOutputManager.writeToFile(formattedOutput, filePath, 'utf8');
      logger.info(`Output saved to file: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to save output to file ${filePath}:`, error);
      throw error;
    }
  }

  displayInConsole(output: RenderedOutput): void {
    try {
      console.log(output.content);
      
      // Display metadata information
      console.log(chalk.dim('\\n' + '─'.repeat(50)));
      console.log(chalk.dim(`📊 Format: ${output.metadata.format}`));
      console.log(chalk.dim(`⏰ Generated: ${output.metadata.timestamp.toLocaleString()}`));
      
      if (output.metadata.rowCount > 0) {
        console.log(chalk.dim(`📈 Rows: ${output.metadata.rowCount.toLocaleString()}`));
      }
      
      if (output.metadata.outputFile) {
        console.log(chalk.dim(`💾 Saved to: ${output.metadata.outputFile}`));
      }
    } catch (error) {
      logger.error('Failed to display output in console:', error);
      console.error(chalk.red('Failed to display output in console'));
    }
  }

  /**
   * Display query result with enhanced formatting
   */
  async displayQueryResultWithChart(
    result: QueryResult,
    options: RenderOptions & { showChart?: boolean } = {}
  ): Promise<void> {
    try {
      // Render the main result
      const renderedOutput = await this.renderQueryResult(result, options);
      this.displayInConsole(renderedOutput);

      // Show chart if requested and data is suitable for time series
      if (options.showChart && result.tables.length > 0) {
        // Simple time series detection - look for timestamp/datetime columns
        const firstTable = result.tables[0];
        const hasTimeColumn = firstTable.columns.some(col => 
          col.name.toLowerCase().includes('timestamp') || 
          col.name.toLowerCase().includes('datetime') ||
          col.type.toLowerCase().includes('datetime')
        );
        
        if (hasTimeColumn && firstTable.rows.length > 0) {
          console.log(chalk.blue.bold('\\n📊 Chart Visualization:'));
          console.log(chalk.dim('Time series data detected - chart functionality available'));
        }
      }

    } catch (error) {
      logger.error('Failed to display query result with chart:', error);
      throw error;
    }
  }

  private displayExecutionStatistics(statistics: any): void {
    console.log(chalk.blue.bold('\\n⚡ Execution Statistics:'));
    console.log(chalk.dim('─'.repeat(30)));
    
    if (statistics.executionTime) {
      console.log(chalk.green(`⏱️  Execution Time: ${statistics.executionTime}ms`));
    }
    
    if (statistics.resultCount !== undefined) {
      console.log(chalk.green(`📊 Result Count: ${statistics.resultCount.toLocaleString()}`));
    }

    if (statistics.resourceUsage) {
      const usage = statistics.resourceUsage;
      if (usage.cpu_time_ms) {
        console.log(chalk.yellow(`🔧 CPU Time: ${usage.cpu_time_ms}ms`));
      }
      if (usage.memory_consumed_bytes) {
        const memoryMB = Math.round(usage.memory_consumed_bytes / 1024 / 1024 * 100) / 100;
        console.log(chalk.yellow(`💾 Memory Used: ${memoryMB}MB`));
      }
    }
  }

  private getFileExtension(format: OutputFormat): string {
    const extensions: Record<OutputFormat, string> = {
      'json': 'json',
      'csv': 'csv',
      'tsv': 'tsv', 
      'table': 'txt',
      'raw': 'txt'
    };
    return extensions[format] || 'txt';
  }

  private getMimeType(format: OutputFormat): string {
    const mimeTypes: Record<OutputFormat, string> = {
      'json': 'application/json',
      'csv': 'text/csv',
      'tsv': 'text/tab-separated-values',
      'table': 'text/plain',
      'raw': 'text/plain'
    };
    return mimeTypes[format] || 'text/plain';
  }
}