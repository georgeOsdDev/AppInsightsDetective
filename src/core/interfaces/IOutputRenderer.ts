import { QueryResult, AnalysisResult, OutputFormat } from '../../types';

export interface RenderOptions {
  format?: OutputFormat;
  outputFile?: string;
  prettyJson?: boolean;
  includeHeaders?: boolean;
  encoding?: BufferEncoding;
  showChart?: boolean;
}

export interface RenderedOutput {
  content: string;
  metadata: {
    format: OutputFormat;
    timestamp: Date;
    rowCount: number;
    outputFile?: string;
  };
}

/**
 * Interface for output rendering and presentation
 */
export interface IOutputRenderer {
  /**
   * Render query results
   */
  renderQueryResult(
    result: QueryResult,
    options?: RenderOptions
  ): Promise<RenderedOutput>;

  /**
   * Render analysis results
   */
  renderAnalysisResult(
    analysis: AnalysisResult,
    options?: RenderOptions
  ): Promise<RenderedOutput>;

  /**
   * Save output to file
   */
  saveToFile(
    output: RenderedOutput,
    filePath: string
  ): Promise<void>;

  /**
   * Display output in console
   */
  displayInConsole(output: RenderedOutput): void;
}