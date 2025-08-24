import { QueryResult, AnalysisResult } from '../../types';

/**
 * Options for rendering output
 */
export interface RenderOptions {
  format?: 'table' | 'json' | 'csv' | 'tsv' | 'raw';
  includeHeaders?: boolean;
  pretty?: boolean;
  showCharts?: boolean;
  maxColumns?: number;
  language?: string;
  hideEmptyColumns?: boolean;
}

/**
 * Rendered output result
 */
export interface RenderedOutput {
  content: string;
  metadata?: {
    formatUsed: string;
    chartsGenerated?: number;
    columnsHidden?: number;
  };
}

/**
 * Output renderer interface
 */
export interface IOutputRenderer {
  /**
   * Render query result
   */
  renderQueryResult(result: QueryResult, options: RenderOptions): Promise<RenderedOutput>;
  
  /**
   * Render analysis result
   */
  renderAnalysisResult(analysis: AnalysisResult, options: RenderOptions): Promise<RenderedOutput>;
  
  /**
   * Render query with metadata
   */
  renderQuery(query: string, confidence: number, reasoning?: string): RenderedOutput;
  
  /**
   * Render error message
   */
  renderError(error: string | Error): RenderedOutput;
  
  /**
   * Render info message
   */
  renderInfo(message: string): RenderedOutput;
  
  /**
   * Render success message
   */
  renderSuccess(message: string): RenderedOutput;
}