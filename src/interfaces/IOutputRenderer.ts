import { QueryResult, OutputFormat, AnalysisResult, AnalysisType } from '../types';

/**
 * Interface for handling result presentation and output formatting
 */
export interface IOutputRenderer {
  /**
   * Display query result to console with summary information
   */
  displayResult(result: QueryResult, executionTime: number, originalQuery?: string): Promise<void>;

  /**
   * Show interactive chart if data is suitable for visualization
   */
  showChart(result: QueryResult): Promise<boolean>;

  /**
   * Prompt user for file output options and save if requested
   */
  handleFileOutput(result: QueryResult): Promise<void>;

  /**
   * Display analysis results in formatted manner
   */
  displayAnalysis(analysis: AnalysisResult, analysisType: AnalysisType): void;
}