import chalk from 'chalk';
import { 
  IOutputRenderer, 
  RenderOptions, 
  RenderedOutput 
} from '../../core/interfaces';
import { QueryResult, AnalysisResult, OutputFormat } from '../../types';
import { OutputFormatter } from '../../utils/outputFormatter';
import { Visualizer } from '../../utils/visualizer';
import { logger } from '../../utils/logger';

/**
 * Console-based output renderer implementation
 */
export class ConsoleOutputRenderer implements IOutputRenderer {

  /**
   * Render query result
   */
  async renderQueryResult(result: QueryResult, options: RenderOptions = {}): Promise<RenderedOutput> {
    logger.debug('ConsoleOutputRenderer: Rendering query result');

    const renderOptions = {
      format: 'table' as OutputFormat,
      includeHeaders: true,
      pretty: true,
      showCharts: true,
      maxColumns: 10,
      ...options
    };

    try {
      let content = '';
      let formatUsed = renderOptions.format!;
      let chartsGenerated = 0;
      let columnsHidden = 0;

      if (renderOptions.format === 'table') {
        // Use Visualizer for table rendering (restored functionality)
        content = Visualizer.formatResult(result, { 
          hideEmptyColumns: renderOptions.hideEmptyColumns !== false 
        });
        formatUsed = 'table';
      } else {
        // Use OutputFormatter for other formats
        const formattedOutput = OutputFormatter.formatResult(result, renderOptions.format || 'table', {
          pretty: renderOptions.pretty,
          includeHeaders: renderOptions.includeHeaders
        });

        content = formattedOutput.content;
      }

      // Handle chart generation placeholder
      if (renderOptions.format === 'table' && renderOptions.showCharts && result.tables && result.tables.length > 0) {
        logger.debug('Chart generation requested but not yet implemented in Phase 3');
      }

      return {
        content: content.trim(),
        metadata: {
          formatUsed,
          chartsGenerated,
          columnsHidden
        }
      };

    } catch (error) {
      logger.error('ConsoleOutputRenderer: Failed to render query result:', error);
      return {
        content: chalk.red(`Error rendering result: ${error}`),
        metadata: {
          formatUsed: 'error'
        }
      };
    }
  }

  /**
   * Render analysis result
   */
  async renderAnalysisResult(analysis: AnalysisResult, options: RenderOptions = {}): Promise<RenderedOutput> {
    logger.debug('ConsoleOutputRenderer: Rendering analysis result');

    try {
      let content = '';

      content += chalk.green.bold('\n🔍 Analysis Results:') + '\n';
      content += chalk.dim('='.repeat(50)) + '\n';

      // Statistical analysis
      if (analysis.statistical) {
        content += chalk.cyan.bold('\n📊 Statistical Summary:') + '\n';
        content += `Total Rows: ${analysis.statistical.summary.totalRows}\n`;
        
        if (analysis.statistical.numerical) {
          content += `Mean: ${analysis.statistical.numerical.mean.toFixed(2)}\n`;
          content += `Median: ${analysis.statistical.numerical.median.toFixed(2)}\n`;
          content += `Distribution: ${analysis.statistical.numerical.distribution}\n`;
        }
      }

      // Pattern analysis (simplified since summary property doesn't exist)
      if (analysis.patterns) {
        content += chalk.cyan.bold('\n🔍 Pattern Analysis:') + '\n';
        content += 'Pattern analysis completed\n';
      }

      // AI insights
      if (analysis.aiInsights) {
        content += chalk.cyan.bold('\n🤖 AI Insights:') + '\n';
        content += analysis.aiInsights + '\n';
      }

      // Recommendations
      if (analysis.recommendations && analysis.recommendations.length > 0) {
        content += chalk.cyan.bold('\n💡 Recommendations:') + '\n';
        for (let i = 0; i < analysis.recommendations.length; i++) {
          content += `${i + 1}. ${analysis.recommendations[i]}\n`;
        }
      }

      // Follow-up queries
      if (analysis.followUpQueries && analysis.followUpQueries.length > 0) {
        content += chalk.cyan.bold('\n🔗 Suggested Follow-up Queries:') + '\n';
        for (let i = 0; i < analysis.followUpQueries.length; i++) {
          const query = analysis.followUpQueries[i];
          content += `${i + 1}. ${query.purpose} (${query.priority})\n`;
          content += `   ${chalk.dim(query.query)}\n`;
        }
      }

      return {
        content: content.trim(),
        metadata: {
          formatUsed: 'analysis'
        }
      };

    } catch (error) {
      logger.error('ConsoleOutputRenderer: Failed to render analysis result:', error);
      return {
        content: chalk.red(`Error rendering analysis: ${error}`),
        metadata: {
          formatUsed: 'error'
        }
      };
    }
  }

  /**
   * Render query with metadata
   */
  renderQuery(query: string, confidence: number, reasoning?: string): RenderedOutput {
    let content = '';

    content += chalk.cyan.bold('\n📝 Generated KQL Query:') + '\n';
    content += chalk.dim('='.repeat(50)) + '\n';
    
    // Query content with basic highlighting
    content += this.highlightKQL(query) + '\n';
    
    // Confidence indicator
    const confidenceColor = confidence >= 0.8 ? chalk.green : confidence >= 0.6 ? chalk.yellow : chalk.red;
    const confidenceBar = '█'.repeat(Math.round(confidence * 10)) + '░'.repeat(10 - Math.round(confidence * 10));
    content += '\n' + chalk.cyan.bold('🎯 Confidence: ') + confidenceColor(`${(confidence * 100).toFixed(1)}%`) + ' ' + confidenceBar + '\n';

    // Reasoning
    if (reasoning) {
      content += chalk.cyan.bold('\n💭 AI Reasoning:') + '\n';
      content += chalk.dim(reasoning) + '\n';
    }

    return {
      content: content.trim(),
      metadata: {
        formatUsed: 'query'
      }
    };
  }

  /**
   * Render error message
   */
  renderError(error: string | Error): RenderedOutput {
    const message = error instanceof Error ? error.message : error;
    const content = chalk.red.bold('❌ Error: ') + chalk.red(message);

    return {
      content,
      metadata: {
        formatUsed: 'error'
      }
    };
  }

  /**
   * Render info message
   */
  renderInfo(message: string): RenderedOutput {
    const content = chalk.blue.bold('ℹ️  ') + chalk.white(message);

    return {
      content,
      metadata: {
        formatUsed: 'info'
      }
    };
  }

  /**
   * Render success message
   */
  renderSuccess(message: string): RenderedOutput {
    const content = chalk.green.bold('✅ ') + chalk.green(message);

    return {
      content,
      metadata: {
        formatUsed: 'success'
      }
    };
  }

  /**
   * Basic KQL syntax highlighting
   */
  private highlightKQL(query: string): string {
    // Basic syntax highlighting for KQL
    const keywords = [
      'where', 'summarize', 'project', 'extend', 'join', 'union', 'sort', 'order', 'take', 'limit',
      'count', 'sum', 'avg', 'min', 'max', 'bin', 'ago', 'now', 'datetime', 'timespan',
      'and', 'or', 'not', 'in', 'contains', 'startswith', 'endswith', 'matches', 'regex'
    ];

    let highlighted = query;

    // Highlight keywords
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      highlighted = highlighted.replace(regex, chalk.blue(keyword));
    });

    // Highlight table names (common Application Insights tables)
    const tables = ['requests', 'dependencies', 'exceptions', 'pageViews', 'traces', 'customEvents'];
    tables.forEach(table => {
      const regex = new RegExp(`\\b${table}\\b`, 'gi');
      highlighted = highlighted.replace(regex, chalk.magenta(table));
    });

    // Highlight strings
    highlighted = highlighted.replace(/(["'])((?:(?!\1)[^\\]|\\.)*)(\1)/g, chalk.green('$1$2$3'));

    // Highlight numbers
    highlighted = highlighted.replace(/\b\d+(\.\d+)?\b/g, chalk.yellow('$&'));

    return highlighted;
  }
}