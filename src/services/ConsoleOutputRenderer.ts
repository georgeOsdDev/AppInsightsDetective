import inquirer from 'inquirer';
import chalk from 'chalk';
import { QueryResult, OutputFormat, AnalysisResult, AnalysisType } from '../types';
import { IOutputRenderer } from '../interfaces/IOutputRenderer';
import { Visualizer } from '../utils/visualizer';
import { OutputFormatter } from '../utils/outputFormatter';
import { FileOutputManager } from '../utils/fileOutput';
import { detectTimeSeriesData } from '../utils/chart';
import { logger } from '../utils/logger';

/**
 * Implementation of IOutputRenderer that handles result presentation and output formatting
 */
export class ConsoleOutputRenderer implements IOutputRenderer {
  constructor(
    private options: {
      prettyJson?: boolean;
      includeHeaders?: boolean;
      encoding?: BufferEncoding;
    } = {}
  ) {}

  /**
   * Display query result to console with summary information
   */
  async displayResult(result: QueryResult, executionTime: number, originalQuery?: string): Promise<void> {
    const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);

    // Always display to console first (default: hide empty columns in interactive mode)
    Visualizer.displayResult(result);
    Visualizer.displaySummary(executionTime, totalRows);
  }

  /**
   * Show interactive chart if data is suitable for visualization
   */
  async showChart(result: QueryResult): Promise<boolean> {
    if (result.tables.length > 0 && result.tables[0].rows.length > 1) {
      const firstTable = result.tables[0];
      if (firstTable.columns.length >= 2) {
        const hasNumericData = firstTable.rows.some(row =>
          typeof row[1] === 'number' || !isNaN(Number(row[1]))
        );

        if (hasNumericData) {
          const { showChart } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'showChart',
              message: 'Would you like to see a simple chart of this data?',
              default: false
            }
          ]);

          if (showChart) {
            const chartData = firstTable.rows.slice(0, 10).map(row => ({
              label: String(row[0] || ''),
              value: Number(row[1]) || 0,
            }));

            // Auto-detect best chart type, but allow user to choose
            const isTimeSeries = detectTimeSeriesData(chartData);
            const defaultChartType = isTimeSeries ? 'line' : 'bar';

            const { chartType } = await inquirer.prompt([
              {
                type: 'list',
                name: 'chartType',
                message: 'Which chart type would you prefer?',
                choices: [
                  { name: `📈 Line Chart${isTimeSeries ? ' (recommended for time-series)' : ''}`, value: 'line' },
                  { name: '📊 Bar Chart', value: 'bar' }
                ],
                default: defaultChartType
              }
            ]);

            Visualizer.displayChart(chartData, chartType);
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Prompt user for file output options and save if requested
   */
  async handleFileOutput(result: QueryResult): Promise<void> {
    const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
    
    const outputChoice = await this.promptForOutputOptions(totalRows);

    if (outputChoice.saveToFile && outputChoice.format) {
      try {
        await this.saveResultToFile(result, {
          format: outputChoice.format,
          filePath: outputChoice.filePath,
          pretty: outputChoice.pretty,
          includeHeaders: outputChoice.includeHeaders,
          encoding: outputChoice.encoding
        });
      } catch (error) {
        logger.error('File save failed:', error);
        Visualizer.displayError(`Failed to save to file: ${error}`);
      }
    }
  }

  /**
   * Display analysis results in formatted manner
   */
  displayAnalysis(analysis: AnalysisResult, analysisType: AnalysisType): void {
    Visualizer.displayAnalysisResult(analysis, analysisType);
  }

  /**
   * Prompt user for output options
   */
  private async promptForOutputOptions(totalRows: number): Promise<{
    saveToFile: boolean;
    format?: OutputFormat;
    filePath?: string;
    pretty?: boolean;
    includeHeaders?: boolean;
    encoding?: BufferEncoding;
  }> {
    const { saveToFile } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'saveToFile',
        message: `Would you like to save these ${totalRows} rows to a file?`,
        default: false
      }
    ]);

    if (!saveToFile) {
      return { saveToFile: false };
    }

    const { format, filePath, pretty, includeHeaders, encoding } = await inquirer.prompt([
      {
        type: 'list',
        name: 'format',
        message: 'Select output format:',
        choices: [
          { name: '📊 JSON - Structured data format', value: 'json' },
          { name: '📋 CSV - Comma-separated values for spreadsheets', value: 'csv' },
          { name: '📑 TSV - Tab-separated values', value: 'tsv' },
          { name: '📄 Raw - Human-readable debug format', value: 'raw' }
        ],
        default: 'json'
      },
      {
        type: 'input',
        name: 'filePath',
        message: 'Enter output file path (or press Enter for auto-generated):',
        default: '',
        validate: (input: string) => {
          if (!input.trim()) return true; // Allow empty for auto-generation
          return input.length > 0 || 'Please enter a valid file path';
        }
      },
      {
        type: 'confirm',
        name: 'pretty',
        message: 'Pretty print JSON output?',
        default: this.options.prettyJson !== false,
        when: (answers) => answers.format === 'json'
      },
      {
        type: 'confirm',
        name: 'includeHeaders',
        message: 'Include column headers?',
        default: this.options.includeHeaders !== false,
        when: (answers) => answers.format === 'csv' || answers.format === 'tsv'
      },
      {
        type: 'list',
        name: 'encoding',
        message: 'Select file encoding:',
        choices: [
          { name: 'UTF-8 (recommended)', value: 'utf8' },
          { name: 'UTF-16 Little Endian', value: 'utf16le' },
          { name: 'ASCII', value: 'ascii' },
          { name: 'Latin-1', value: 'latin1' }
        ],
        default: this.options.encoding || 'utf8'
      }
    ]);

    return {
      saveToFile: true,
      format,
      filePath: filePath.trim() || undefined,
      pretty,
      includeHeaders,
      encoding
    };
  }

  /**
   * Save result to file with user-specified options
   */
  private async saveResultToFile(result: QueryResult, options: {
    format: OutputFormat;
    filePath?: string;
    pretty?: boolean;
    includeHeaders?: boolean;
    encoding?: BufferEncoding;
  }): Promise<void> {
    // Generate filename if not provided
    const outputPath = options.filePath || FileOutputManager.generateFileName({
      format: options.format,
      destination: 'file'
    });

    // Resolve and check path
    const resolvedPath = FileOutputManager.resolveOutputPath(outputPath, options.format);

    if (!FileOutputManager.checkWritePermission(resolvedPath)) {
      throw new Error(`Cannot write to file: ${resolvedPath}`);
    }

    // Format the output
    const formattedOutput = OutputFormatter.formatResult(result, options.format, {
      pretty: options.pretty,
      includeHeaders: options.includeHeaders
    });

    // Create backup if file exists
    FileOutputManager.createBackup(resolvedPath);

    // Write to file
    await FileOutputManager.writeToFile(formattedOutput, resolvedPath, options.encoding || 'utf8');

    // Show success message
    const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
    console.log(chalk.green(`✅ Successfully saved ${totalRows} rows to ${resolvedPath}`));
  }
}